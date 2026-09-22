import { useState, useRef, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

// In the desktop app, WebView2's SpeechRecognition fails with a "network" error, so we record
// the mic ourselves and transcribe each phrase with a local Whisper (src-tauri `transcribe`).
// In a plain browser we use the Web Speech API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'

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

// Whisper marks non-speech as e.g. "[BLANK_AUDIO]" or "(wind blowing)".
function stripWhisperTags(text: string) {
  return text.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
}

const SAMPLE_RATE = 16000
const SPEECH_RMS = 0.01          // buffer loudness that counts as speech
const PAUSE_MS = 700             // silence after speech that ends a phrase
const MAX_PHRASE_MS = 25000      // Whisper handles up to 30s per call

function toWav(chunks: Float32Array[]) {
  const n = chunks.reduce((a, c) => a + c.length, 0)
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, n * 2, true)
  let o = 44
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 0x7fff, true)
  return new Uint8Array(buf)
}

export function useDictation(onText: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const wantedRef = useRef(false)
  const recognitionRef = useRef<Recognition>(null)   // web path
  const recorderRef = useRef<(() => void) | null>(null) // native path: stops the mic
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText })

  const stop = useCallback(() => {
    wantedRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    recorderRef.current?.()
    recorderRef.current = null
    setRecording(false)
  }, [])

  const startWhisper = useCallback(async () => {
    wantedRef.current = true
    setRecording(true)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch (err) {
      stop()
      alert(`Couldn't open the microphone: ${err}`)
      return
    }
    if (!wantedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    const source = ctx.createMediaStreamSource(stream)
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    let phrase: Float32Array[] = []
    let heardSpeech = false
    let silentMs = 0
    let phraseMs = 0
    // Phrases are transcribed one at a time so text lands in the order it was spoken.
    let queue = Promise.resolve()

    const flush = () => {
      const chunks = phrase
      const hasSpeech = heardSpeech
      phrase = []; heardSpeech = false; silentMs = 0; phraseMs = 0
      if (!hasSpeech) return
      const wav = toWav(chunks)
      queue = queue.then(async () => {
        try {
          const text = stripFillers(stripWhisperTags(await invoke<string>('transcribe', { wav: Array.from(wav) })))
          if (text) onTextRef.current(text)
        } catch (err) {
          stop()
          alert(String(err))
        }
      })
    }

    proc.onaudioprocess = e => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0))
      const ms = (data.length / SAMPLE_RATE) * 1000
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      const loud = Math.sqrt(sum / data.length) > SPEECH_RMS
      if (loud) { heardSpeech = true; silentMs = 0 } else silentMs += ms
      // Keep a little leading silence so the first word isn't clipped, but don't pile up quiet audio.
      if (!heardSpeech && phrase.length >= 2) phrase.shift()
      phrase.push(data)
      phraseMs += ms
      if (heardSpeech && (silentMs >= PAUSE_MS || phraseMs >= MAX_PHRASE_MS)) flush()
    }
    source.connect(proc)
    proc.connect(ctx.destination)

    recorderRef.current = () => {
      proc.onaudioprocess = null
      source.disconnect(); proc.disconnect()
      stream.getTracks().forEach(t => t.stop())
      ctx.close()
      flush()
    }
  }, [stop])

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

  const toggle = useCallback(() => {
    if (wantedRef.current) stop()
    else if (isTauri) startWhisper()
    else startWeb()
  }, [startWhisper, startWeb, stop])

  useEffect(() => () => {
    wantedRef.current = false
    recognitionRef.current?.stop()
    recorderRef.current?.()
  }, [])

  return { recording, toggle, stop }
}
