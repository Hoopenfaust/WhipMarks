import { useSyncExternalStore } from 'react'

// Presentation mode: while on, anything marked `wm-private` is blurred (see index.css) so marks
// can't be read when WhipMarks is on a projector. Remembered across restarts, so it stays on if
// the app is reopened mid-class.
const KEY = 'whipmarks-presenting'

function read() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

let presenting = read()
const listeners = new Set<() => void>()

function apply() {
  document.documentElement.classList.toggle('presenting', presenting)
}
apply()

export function setPresenting(on: boolean) {
  presenting = on
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* not remembered */ }
  apply()
  listeners.forEach(l => l())
}

export function usePresenting() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => presenting,
  )
}
