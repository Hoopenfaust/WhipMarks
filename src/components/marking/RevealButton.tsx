import { Eye, EyeOff } from 'lucide-react'
import type { Student } from '../../types'
import { usePresenting, useRevealed, setRevealed } from '../../utils/presentation'
import { cn } from '../../utils/cn'

/** In presentation mode, shows or hides just this student's marks. Renders nothing otherwise. */
export function RevealButton({ student, className, size = 16 }: { student: Student; className?: string; size?: number }) {
  const presenting = usePresenting()
  const revealed = useRevealed()
  if (!presenting) return null
  const on = revealed?.id === student.id
  const name = student.firstName ? `${student.firstName} ${student.name}` : student.name
  return (
    <button
      onClick={e => { e.stopPropagation(); setRevealed(on ? null : { id: student.id, name }) }}
      title={on ? `Hide ${name}'s marks` : `Show only ${name}'s marks`}
      aria-pressed={on}
      className={cn(
        'p-1.5 rounded-lg transition-all hover:scale-110',
        on ? 'text-orange-300 bg-orange-500/15' : 'text-gray-500 hover:text-orange-300 hover:bg-orange-500/10',
        className
      )}
    >
      {on ? <Eye size={size} /> : <EyeOff size={size} />}
    </button>
  )
}
