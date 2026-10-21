import { useSyncExternalStore } from 'react'

// Presentation mode: while on, anything marked `wm-private` is blurred (see index.css) so marks
// can't be read when WhipMarks is on a projector. Remembered across restarts, so it stays on if
// the app is reopened mid-class.
//
// One student can be revealed while presenting: every `wm-private` element tagged with
// `data-wm-student={id}` for that student unblurs, everyone else stays hidden. The reveal is
// never remembered, so reopening the app mid-class can't leave someone's marks on screen.
const KEY = 'whipmarks-presenting'

function read() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

let presenting = read()
let revealed: { id: string; name: string } | null = null
const listeners = new Set<() => void>()

const revealStyle = document.createElement('style')
document.head.appendChild(revealStyle)

function apply() {
  document.documentElement.classList.toggle('presenting', presenting)
  revealStyle.textContent = revealed
    ? `html.presenting .wm-private[data-wm-student="${CSS.escape(revealed.id)}"] { filter: none; opacity: 1; pointer-events: auto; user-select: auto; }`
    : ''
  listeners.forEach(l => l())
}
apply()

export function setPresenting(on: boolean) {
  presenting = on
  if (!on) revealed = null
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* not remembered */ }
  apply()
}

/** Show one student's marks while presenting; pass null to hide them again. */
export function setRevealed(student: { id: string; name: string } | null) {
  revealed = student
  apply()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function usePresenting() {
  return useSyncExternalStore(subscribe, () => presenting)
}

export function useRevealed() {
  return useSyncExternalStore(subscribe, () => revealed)
}
