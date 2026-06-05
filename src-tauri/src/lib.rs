use std::fs;
use tauri::command;
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;

/// Write bytes to a temp file. Returns the absolute path.
#[command]
fn write_temp_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    path.push(&filename);
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![write_temp_file, open_outlook])
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
