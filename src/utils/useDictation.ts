import { useState, useRef, useEffect, useCallback } from 'react'

// WebView2/Chromium ends a recognition session after a pause in speech (and after ~60s)
// even with `continuous = true`, so we restart it until the user explicitly stops.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any

// Errors that won't fix themselves by restarting — give up instead of looping.
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'])

// Filler words (um, umm, uh, er, erm, hmm, mm) plus any comma the recogniser attached to them.
const FILLERS = /\b(?:u+m+|u+h+|e+r+m*|h+m+|m{2,})\b[,.]?/gi

function stripFillers(text: string) {
  return text.replace(FILLERS, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
}

export function useDictation(onText: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const wantedRef = useRef(false)
  const recognitionRef = useRef<Recognition>(null)
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText })

  const stop = useCallback(() => {
    wantedRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecording(false)
  }, [])

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    const r: Recognition = new SR()
    r.continuous = true
    r.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = stripFillers(Array.from({ length: e.results.length - e.resultIndex }, (_: any, i: number) =>
        e.results[e.resultIndex + i][0].transcript
      ).join(' '))
      if (transcript) onTextRef.current(transcript)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => { if (FATAL_ERRORS.has(e.error)) wantedRef.current = false }
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
  }, [])

  const toggle = useCallback(() => { if (wantedRef.current) stop(); else start() }, [start, stop])

  useEffect(() => () => { wantedRef.current = false; recognitionRef.current?.stop() }, [])

  return { recording, toggle, stop }
}
