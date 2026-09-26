use std::fs;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{command, AppHandle, Manager};
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use rfd::FileDialog;

/// Write bytes to a temp file. Returns the absolute path.
#[command]
fn write_temp_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    path.push(&filename);
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Show a native save dialog and write the PDF bytes to the chosen path.
/// Returns the path if saved, or None if the user cancelled.
#[command]
fn save_pdf(filename: String, data: Vec<u8>) -> Result<Option<String>, String> {
    let path = FileDialog::new()
        .set_file_name(&filename)
        .add_filter("PDF", &["pdf"])
        .save_file();
    match path {
        Some(p) => {
            fs::write(&p, &data).map_err(|e| e.to_string())?;
            Ok(Some(p.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

/// Show a native save dialog, then write the current page straight to PDF with WebView2's
/// PrintToPdf (uses the page's print CSS, no print dialog or printer driver).
/// Returns the path if saved, or None if the user cancelled.
#[command]
async fn save_page_pdf(window: tauri::WebviewWindow, filename: String) -> Result<Option<String>, String> {
    let Some(path) = FileDialog::new()
        .set_file_name(&filename)
        .add_filter("PDF", &["pdf"])
        .save_file()
    else {
        return Ok(None);
    };
    write_page_pdf(window, path.clone()).await?;
    Ok(Some(path.to_string_lossy().to_string()))
}

/// Write the current page to a PDF in the temp folder (no dialog). Returns the path.
#[command]
async fn page_pdf_to_temp(window: tauri::WebviewWindow, filename: String) -> Result<String, String> {
    let path = std::env::temp_dir().join(filename);
    write_page_pdf(window, path.clone()).await?;
    Ok(path.to_string_lossy().to_string())
}

async fn write_page_pdf(window: tauri::WebviewWindow, path: std::path::PathBuf) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let target = path;
    window
        .with_webview(move |wv| {
            #[cfg(windows)]
            if let Err(e) = print_to_pdf(&wv.controller(), &target, tx.clone()) {
                let _ = tx.send(Err(e.message().to_string()));
            }
        })
        .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || rx.recv())
        .await
        .map_err(|e| e.to_string())?
        .map_err(|_| "PDF export didn't finish".to_string())?
}

#[cfg(windows)]
fn print_to_pdf(
    controller: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller,
    path: &std::path::Path,
    tx: std::sync::mpsc::Sender<Result<(), String>>,
) -> windows::core::Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::*;
    use windows::core::{Interface, HSTRING};
    unsafe {
        let webview = controller.CoreWebView2()?;
        let env: ICoreWebView2Environment6 = webview.cast::<ICoreWebView2_2>()?.Environment()?.cast()?;
        let settings = env.CreatePrintSettings()?;
        settings.SetShouldPrintHeaderAndFooter(false)?;
        settings.SetShouldPrintBackgrounds(true)?;
        settings.SetPageWidth(8.5)?; // letter, matching @page in index.css
        settings.SetPageHeight(11.0)?;
        for set in [ICoreWebView2PrintSettings::SetMarginTop, ICoreWebView2PrintSettings::SetMarginBottom,
                    ICoreWebView2PrintSettings::SetMarginLeft, ICoreWebView2PrintSettings::SetMarginRight] {
            set(&settings, 0.5)?;
        }
        let handler = webview2_com::PrintToPdfCompletedHandler::create(Box::new(move |result, ok| {
            let _ = tx.send(match result {
                Err(e) => Err(e.message().to_string()),
                Ok(()) if !ok => Err("WebView2 couldn't write the PDF".to_string()),
                Ok(()) => Ok(()),
            });
            Ok(())
        }));
        webview.cast::<ICoreWebView2_7>()?.PrintToPdf(&HSTRING::from(path.as_os_str()), &settings, &handler)
    }
}

/// Open the default mail client (new Outlook, classic Outlook, etc.) with a
/// pre-filled email. Creates a standards-compliant .eml file and opens it via
/// the Windows shell, so whichever app handles .eml is used — no COM needed.
#[command]
fn open_outlook(
    to: String,
    subject: String,
    body: String,
    attachment_paths: Vec<String>,
) -> Result<(), String> {
    let boundary = "WhipMarksMIMEBoundary20250101";

    // One base64 PDF part per attachment, chunked into 76-char lines (RFC 2045)
    let mut parts = String::new();
    for path in &attachment_paths {
        let encoded = BASE64.encode(fs::read(path).map_err(|e| e.to_string())?);
        let filename = std::path::Path::new(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let chunked: String = encoded
            .as_bytes()
            .chunks(76)
            .map(|c| std::str::from_utf8(c).unwrap_or(""))
            .collect::<Vec<_>>()
            .join("\r\n");
        parts.push_str(&format!(
            "--{boundary}\r\n\
             Content-Type: application/pdf; name=\"{filename}\"\r\n\
             Content-Transfer-Encoding: base64\r\n\
             Content-Disposition: attachment; filename=\"{filename}\"\r\n\
             \r\n\
             {chunked}\r\n\
             \r\n"
        ));
    }

    let eml = if !parts.is_empty() {
        // Multipart/mixed with PDF attachments
        format!(
            "To: {to}\r\n\
             Subject: {subject}\r\n\
             MIME-Version: 1.0\r\n\
             Content-Type: multipart/mixed; boundary=\"{boundary}\"\r\n\
             \r\n\
             --{boundary}\r\n\
             Content-Type: text/plain; charset=utf-8\r\n\
             \r\n\
             {body}\r\n\
             \r\n\
             {parts}\
             --{boundary}--\r\n",
            to = to,
            subject = subject,
            boundary = boundary,
            body = body,
            parts = parts,
        )
    } else {
        // Plain text only
        format!(
            "To: {to}\r\n\
             Subject: {subject}\r\n\
             MIME-Version: 1.0\r\n\
             Content-Type: text/plain; charset=utf-8\r\n\
             \r\n\
             {body}\r\n",
            to = to,
            subject = subject,
            body = body,
        )
    };

    // Write the .eml file to temp
    let mut eml_path = std::env::temp_dir();
    eml_path.push("whipmarks_email.eml");
    fs::write(&eml_path, eml.as_bytes()).map_err(|e| e.to_string())?;

    // Open with the default mail handler (new Outlook, classic, etc.)
    std::process::Command::new("cmd")
        .args(["/c", "start", "", &eml_path.to_string_lossy()])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Transcribe a 16 kHz mono WAV with a local whisper.cpp install:
/// <app local data>/whisper/Release/whisper-cli.exe and <app local data>/whisper/ggml-base.en.bin.
#[command]
async fn transcribe(app: AppHandle, wav: Vec<u8>) -> Result<String, String> {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("whisper");
    let cli = dir.join("Release").join("whisper-cli.exe");
    let model = dir.join("ggml-base.en.bin");
    if !cli.exists() || !model.exists() {
        return Err(format!("Whisper isn't installed — expected {} and {}", cli.display(), model.display()));
    }
    let wav_path = std::env::temp_dir().join(format!("whipmarks-dictation-{}.wav", NEXT.fetch_add(1, Ordering::Relaxed)));
    fs::write(&wav_path, &wav).map_err(|e| e.to_string())?;
    let mut cmd = std::process::Command::new(&cli);
    cmd.arg("-m").arg(&model).arg("-f").arg(&wav_path).args(["-l", "en", "-nt", "-np"]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd.output();
    let _ = fs::remove_file(&wav_path);
    let out = out.map_err(|e| format!("Couldn't run Whisper: {e}"))?;
    if !out.status.success() {
        return Err(format!("Whisper failed: {}", String::from_utf8_lossy(&out.stderr).lines().last().unwrap_or("")));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![write_temp_file, open_outlook, save_pdf, save_page_pdf, page_pdf_to_temp, transcribe])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
