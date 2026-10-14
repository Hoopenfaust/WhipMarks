import { useState, useRef, useEffect } from 'react'
import { Volume2, Square, Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

interface Props {
  text: string
  isTouch?: boolean
}

// Reads the comment aloud in the user's cloned ElevenLabs voice via /api/speak (key stays server-side).
// Pressing again while loading or playing stops it.
export function ReadAloudButton({ text, isTouch }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setState('idle')
  }

  useEffect(() => () => {
    abortRef.current?.abort()
    audioRef.current?.pause()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  async function play() {
    const controller = new AbortController()
    abortRef.current = controller
    setState('loading')
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const result = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(result.error ?? `Server error ${res.status}`)
      }
      const url = URL.createObjectURL(await res.blob())
      if (controller.signal.aborted) { URL.revokeObjectURL(url); return }
      urlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = stop
      audio.onerror = () => { stop(); alert("Couldn't play the audio.") }
      await audio.play()
      setState('playing')
    } catch (err) {
      if (controller.signal.aborted) return
      stop()
      alert(`Couldn't read aloud: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const active = state !== 'idle'
  const size = isTouch ? 14 : 12
  return (
    <button
      onClick={() => (active ? stop() : play())}
      disabled={!active && !text.trim()}
      title={active ? 'Stop reading' : 'Read aloud'}
      className={cn(
        'flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        isTouch ? 'px-3 py-2 text-sm' : 'px-2.5 py-1 text-xs',
        active
          ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600'
      )}
    >
      {state === 'loading' ? <Loader2 size={size} className="animate-spin" /> : state === 'playing' ? <Square size={size} /> : <Volume2 size={size} />}
      {active ? 'Stop' : 'Read'}
    </button>
  )
}
