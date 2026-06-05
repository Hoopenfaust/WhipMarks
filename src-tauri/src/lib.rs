use std::fs;
use tauri::command;

/// Write bytes to a temp file. Returns the absolute path.
#[command]
fn write_temp_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    path.push(&filename);
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Open Outlook (Windows) with a pre-filled email.
/// Writes a temporary .ps1 script and executes it via PowerShell.
#[command]
fn open_outlook(
    to: String,
    subject: String,
    body: String,
    attachment_path: Option<String>,
) -> Result<(), String> {
    let attach_line = match &attachment_path {
        Some(p) if !p.is_empty() => format!(
            "$mail.Attachments.Add(@\"\n{}\n\"@.Trim())",
            p
        ),
        _ => String::new(),
    };

    let script = format!(
        r#"
$ol = New-Object -ComObject Outlook.Application
$mail = $ol.CreateItem(0)
$mail.To = @"
{to}
"@.Trim()
$mail.Subject = @"
{subject}
"@.Trim()
$mail.Body = @"
{body}
"@
{attach}
$mail.Display()
"#,
        to = to,
        subject = subject,
        body = body,
        attach = attach_line,
    );

    let mut script_path = std::env::temp_dir();
    script_path.push("whipmarks_outlook.ps1");
    fs::write(&script_path, &script).map_err(|e| e.to_string())?;

    std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script_path.to_str().unwrap_or(""),
        ])
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
