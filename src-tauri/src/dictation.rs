//! Dictation via the Windows speech recogniser (the engine behind Win+H voice typing).
//! WebView2 exposes the browser SpeechRecognition API but has no speech service behind
//! it — it always fails with a "network" error — so the frontend uses this instead.

use std::sync::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use windows::core::{Error, Ref, HRESULT};
use windows::Foundation::{TimeSpan, TypedEventHandler};
use windows::Media::SpeechRecognition::{
    SpeechContinuousRecognitionCompletedEventArgs, SpeechContinuousRecognitionResultGeneratedEventArgs,
    SpeechContinuousRecognitionSession, SpeechRecognitionResultStatus, SpeechRecognizer,
};

/// The active recogniser, tagged with the frontend's session id.
#[derive(Default)]
pub struct Dictation(Mutex<Option<(u32, SpeechRecognizer)>>);

#[derive(Clone, Serialize)]
struct TextEvent { id: u32, text: String }

#[derive(Clone, Serialize)]
struct EndedEvent { id: u32, error: Option<String> }

const PRIVACY_POLICY_NOT_ACCEPTED: HRESULT = HRESULT(0x8004_5509_u32 as i32);
const ACCESS_DENIED: HRESULT = HRESULT(0x8007_0005_u32 as i32);

fn friendly(e: &Error) -> String {
    match e.code() {
        PRIVACY_POLICY_NOT_ACCEPTED => "Turn on \"Online speech recognition\" in Windows Settings › Privacy & security › Speech.".into(),
        ACCESS_DENIED => "Microphone access is blocked. Allow desktop apps to use the microphone in Windows Settings › Privacy & security › Microphone.".into(),
        _ => format!("Dictation failed: {}", e.message()),
    }
}

fn stop_current(state: &Dictation) {
    let current = state.0.lock().unwrap().take();
    if let Some((_, r)) = current {
        // StopAsync waits for the speech service to finalise the last phrase, which can take a
        // long time on a slow connection — don't block the caller on it.
        std::thread::spawn(move || {
            if let Ok(op) = r.ContinuousRecognitionSession().and_then(|s| s.StopAsync()) { let _ = op.get(); }
            let _ = r.Close();
        });
    }
}

const ONE_DAY: TimeSpan = TimeSpan { Duration: 24 * 60 * 60 * 10_000_000 };

fn start_recognizer(app: &AppHandle, id: u32) -> windows::core::Result<SpeechRecognizer> {
    let r = SpeechRecognizer::new()?;
    // Defaults end the session if nothing is said in the first 5 seconds.
    let timeouts = r.Timeouts()?;
    timeouts.SetInitialSilenceTimeout(ONE_DAY)?;
    timeouts.SetBabbleTimeout(ONE_DAY)?;
    // No constraints added = the default free-form dictation grammar.
    let compiled = r.CompileConstraintsAsync()?.get()?;
    if compiled.Status()? != SpeechRecognitionResultStatus::Success {
        return Err(Error::new(HRESULT(-1), format!("could not load the dictation grammar ({:?})", compiled.Status()?)));
    }
    let session = r.ContinuousRecognitionSession()?;
    // Default is to stop after a few seconds of silence; keep listening until the user presses Stop.
    session.SetAutoStopSilenceTimeout(ONE_DAY)?;

    let a = app.clone();
    session.ResultGenerated(&TypedEventHandler::new(
        move |_: Ref<SpeechContinuousRecognitionSession>, args: Ref<SpeechContinuousRecognitionResultGeneratedEventArgs>| {
            let result = args.ok()?.Result()?;
            if result.Status()? == SpeechRecognitionResultStatus::Success {
                let text = result.Text()?.to_string();
                if !text.is_empty() { let _ = a.emit("dictation-text", TextEvent { id, text }); }
            }
            Ok(())
        },
    ))?;

    let a = app.clone();
    session.Completed(&TypedEventHandler::new(
        move |session: Ref<SpeechContinuousRecognitionSession>, args: Ref<SpeechContinuousRecognitionCompletedEventArgs>| {
            let status = args.ok()?.Status()?;
            let state = a.state::<Dictation>();
            let still_wanted = matches!(*state.0.lock().unwrap(), Some((cur, _)) if cur == id);
            // Silence/pause limits can still end the session; keep going until the user presses Stop.
            if still_wanted && matches!(status, SpeechRecognitionResultStatus::TimeoutExceeded | SpeechRecognitionResultStatus::PauseLimitExceeded) {
                if let Ok(s) = session.ok() { if s.StartAsync().is_ok() { return Ok(()); } }
            }
            let error = match status {
                SpeechRecognitionResultStatus::Success | SpeechRecognitionResultStatus::UserCanceled => None,
                SpeechRecognitionResultStatus::MicrophoneUnavailable => Some("No microphone found.".to_string()),
                SpeechRecognitionResultStatus::NetworkFailure => Some("Couldn't reach Microsoft's speech service. Check your internet connection — a VPN can block it.".to_string()),
                SpeechRecognitionResultStatus::AudioQualityFailure => Some("The microphone audio was too quiet or noisy to recognise.".to_string()),
                other => Some(format!("Dictation stopped ({other:?}).")),
            };
            let mut current = state.0.lock().unwrap();
            if matches!(*current, Some((cur, _)) if cur == id) { *current = None; }
            drop(current);
            let _ = a.emit("dictation-ended", EndedEvent { id, error });
            Ok(())
        },
    ))?;

    session.StartAsync()?.get()?;
    Ok(r)
}

#[tauri::command]
pub async fn dictation_start(app: AppHandle, state: State<'_, Dictation>, id: u32) -> Result<(), String> {
    stop_current(&state);
    let r = start_recognizer(&app, id).map_err(|e| friendly(&e))?;
    *state.0.lock().unwrap() = Some((id, r));
    Ok(())
}

#[tauri::command]
pub async fn dictation_stop(state: State<'_, Dictation>) -> Result<(), String> {
    stop_current(&state);
    Ok(())
}
