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

/// Open the default mail client (new Outlook, classic Outlook, etc.) with a
/// pre-filled email. Creates a standards-compliant .eml file and opens it via
/// the Windows shell, so whichever app handles .eml is used — no COM needed.
#[command]
fn open_outlook(
    to: String,
    subject: String,
    body: String,
    attachment_path: Option<String>,
) -> Result<(), String> {
    let boundary = "WhipMarksMIMEBoundary20250101";

    let eml = if let Some(ref path) = attachment_path {
        // Multipart/mixed with PDF attachment
        let attachment_bytes = fs::read(path).map_err(|e| e.to_string())?;
        let encoded = BASE64.encode(&attachment_bytes);
        let filename = std::path::Path::new(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Chunk base64 into 76-char lines (RFC 2045)
        let chunked: String = encoded
            .as_bytes()
            .chunks(76)
            .map(|c| std::str::from_utf8(c).unwrap_or(""))
            .collect::<Vec<_>>()
            .join("\r\n");

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
             --{boundary}\r\n\
             Content-Type: application/pdf; name=\"{filename}\"\r\n\
             Content-Transfer-Encoding: base64\r\n\
             Content-Disposition: attachment; filename=\"{filename}\"\r\n\
             \r\n\
             {chunked}\r\n\
             \r\n\
             --{boundary}--\r\n",
            to = to,
            subject = subject,
            boundary = boundary,
            body = body,
            filename = filename,
            chunked = chunked,
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
        .invoke_handler(tauri::generate_handler![write_temp_file, open_outlook, save_pdf, transcribe])
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
