import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Student } from '../../types'
import { cn } from '../../utils/cn'

interface Props {
  student: Student
  /** Tailwind size + text classes, e.g. 'w-7 h-7 text-xs' */
  className: string
}

/** Round photo (click to enlarge) or initials when there's no photo. */
export function StudentAvatar({ student, className }: Props) {
  const [enlarged, setEnlarged] = useState(false)
  const name = student.firstName ? `${student.firstName} ${student.name}` : student.name

  useEffect(() => {
    if (!enlarged) return
    // Capture phase so Esc/arrows don't also reach Quick Mark's window listener underneath.
    function handler(e: KeyboardEvent) {
      e.stopPropagation()
      if (e.key === 'Escape') setEnlarged(false)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [enlarged])

  if (!student.photo) {
    return (
      <div className={cn('rounded-full flex items-center justify-center font-semibold shrink-0 bg-gray-800 text-gray-400', className)}>
        {[student.firstName, student.name].filter(Boolean).map(n => n![0].toUpperCase()).join('').slice(0, 2) || '?'}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setEnlarged(true) }}
        title={`Enlarge photo of ${name}`}
        className={cn('rounded-full overflow-hidden shrink-0 cursor-zoom-in hover:ring-2 hover:ring-orange-500/60 transition-shadow', className)}
      >
        <img src={student.photo} alt="" className="w-full h-full object-cover" />
      </button>
      {enlarged && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={e => { e.stopPropagation(); setEnlarged(false) }}
        >
          <div className="relative flex flex-col items-center gap-3">
            <img src={student.photo} alt={name} className="max-w-[80vw] max-h-[75vh] w-96 object-contain rounded-xl shadow-2xl" />
            <p className="text-sm font-medium text-white">{name}</p>
            <button
              onClick={() => setEnlarged(false)}
              title="Close"
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-gray-850 border border-gray-700 text-gray-400 hover:text-gray-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
