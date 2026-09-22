import { useState, useRef, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// In the desktop app, WebView2 exposes SpeechRecognition but has no speech service behind it
// (it always fails with a "network" error), so we use the Windows recogniser via Rust
// (src-tauri/src/dictation.rs). In a plain browser we fall back to the Web Speech API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
let nextSessionId = 1

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any

// Web Speech errors that won't fix themselves by restarting — give up instead of looping.
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'])

// Filler words (um, umm, uh, er, erm, hmm, mm) plus any comma the recogniser attached to them.
const FILLERS = /\b(?:u+m+|u+h+|e+r+m*|h+m+|m{2,})\b[,.]?/gi

function stripFillers(text: string) {
  return text.replace(FILLERS, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
}

export function useDictation(onText: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const wantedRef = useRef(false)
  const recognitionRef = useRef<Recognition>(null)   // web path
  const sessionRef = useRef<number | null>(null)     // native path
  const stoppingRef = useRef<number | null>(null)    // stopped session still delivering its last phrase
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText })

  const emit = useCallback((raw: string) => {
    const text = stripFillers(raw)
    if (text) onTextRef.current(text)
  }, [])

  // Native events are broadcast; each hook only reacts to its own session id.
  useEffect(() => {
    if (!isTauri) return
    const unlisteners = [
      listen<{ id: number; text: string }>('dictation-text', e => {
        if (e.payload.id === sessionRef.current || e.payload.id === stoppingRef.current) emit(e.payload.text)
      }),
      listen<{ id: number; error: string | null }>('dictation-ended', e => {
        if (e.payload.id === stoppingRef.current) stoppingRef.current = null
        if (e.payload.id !== sessionRef.current) return
        sessionRef.current = null
        wantedRef.current = false
        setRecording(false)
        if (e.payload.error) alert(e.payload.error)
      }),
    ]
    return () => { unlisteners.forEach(p => p.then(off => off())) }
  }, [emit])

  const stop = useCallback(() => {
    wantedRef.current = false
    if (sessionRef.current !== null) { stoppingRef.current = sessionRef.current; sessionRef.current = null; invoke('dictation_stop') }
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecording(false)
  }, [])

  const startNative = useCallback(() => {
    const id = nextSessionId++
    sessionRef.current = id
    wantedRef.current = true
    setRecording(true)
    invoke('dictation_start', { id })
      .then(() => { if (sessionRef.current === null) invoke('dictation_stop') }) // Stop pressed while starting
      .catch(err => {
        if (sessionRef.current !== id) return
        sessionRef.current = null
        wantedRef.current = false
        setRecording(false)
        alert(String(err))
      })
  }, [])

  const startWeb = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    const r: Recognition = new SR()
    r.continuous = true
    r.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emit(Array.from({ length: e.results.length - e.resultIndex }, (_: any, i: number) =>
        e.results[e.resultIndex + i][0].transcript
      ).join(' '))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => { if (FATAL_ERRORS.has(e.error)) wantedRef.current = false }
    // Chromium ends a session after a pause even with `continuous`, so restart until stopped.
    r.onend = () => {
      if (wantedRef.current && recognitionRef.current === r) {
        try { r.start(); return } catch { /* fall through and stop */ }
      }
      if (recognitionRef.current === r) { recognitionRef.current = null; wantedRef.current = false; setRecording(false) }
    }
    wantedRef.current = true
    recognitionRef.current = r
    r.start()
    setRecording(true)
  }, [emit])

  const toggle = useCallback(() => {
    if (wantedRef.current) stop()
    else if (isTauri) startNative()
    else startWeb()
  }, [startNative, startWeb, stop])

  useEffect(() => () => {
    wantedRef.current = false
    if (sessionRef.current !== null) { sessionRef.current = null; invoke('dictation_stop') }
    recognitionRef.current?.stop()
  }, [])

  return { recording, toggle, stop }
}
