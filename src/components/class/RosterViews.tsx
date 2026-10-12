import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import type { Student } from '../../types'
import { gradeColor } from '../../utils/marks'
import { cn } from '../../utils/cn'

export type RosterView = 'cards' | 'compact' | 'list' | 'faces' | 'standing'

export const ROSTER_VIEWS: { id: RosterView; label: string }[] = [
  { id: 'cards',    label: 'Cards' },
  { id: 'compact',  label: 'Compact' },
  { id: 'list',     label: 'List' },
  { id: 'faces',    label: 'Faces' },
  { id: 'standing', label: 'By standing' },
]

interface ViewProps {
  students: Student[]
  semesterMark: (studentId: string) => number | null
  projectMarks: (studentId: string) => { name: string; pct: number | null }[]
  /** The photo / initials circle, clickable to upload a photo. */
  avatar: (student: Student, size: number) => ReactNode
  cardColor: (studentId: string) => { cardBg: string; border: string }
  onSelect: (studentId: string) => void
  onDelete: (studentId: string) => void
}

// Same thresholds as the at-risk flag and high-achiever star on the student cards.
const STANDINGS = [
  { id: 'risk',       label: 'At risk',        range: 'under 50%', dot: 'bg-red-400',     pill: 'bg-red-400/15 text-red-400' },
  { id: 'borderline', label: 'Borderline',     range: '50–65%',    dot: 'bg-amber-400',   pill: 'bg-amber-400/15 text-amber-400' },
  { id: 'track',      label: 'On track',       range: '65–85%',    dot: 'bg-emerald-400', pill: 'bg-emerald-400/15 text-emerald-400' },
  { id: 'high',       label: 'High achiever',  range: '85%+',      dot: 'bg-indigo-400',  pill: 'bg-indigo-400/15 text-indigo-400' },
  { id: 'none',       label: 'Not marked yet', range: '',          dot: 'bg-gray-500',    pill: 'bg-gray-500/15 text-gray-400' },
] as const

function standingOf(mark: number | null) {
  const id = mark === null ? 'none' : mark < 50 ? 'risk' : mark < 65 ? 'borderline' : mark >= 85 ? 'high' : 'track'
  return STANDINGS.find(s => s.id === id)!
}

const fullName = (s: Student) => s.firstName ? `${s.firstName} ${s.name}` : s.name
const pctText = (v: number | null) => v === null ? '—' : `${v.toFixed(0)}%`
const markClass = (v: number | null) => v === null ? 'text-gray-400/60' : gradeColor(v)
const barClass = (v: number) => v >= 65 ? 'bg-emerald-400' : v >= 50 ? 'bg-amber-400' : 'bg-red-400'

// Keeps a photo click (upload) from also opening the student's details.
function Photo({ children }: { children: ReactNode }) {
  return <div className="group/avatar shrink-0" onClick={e => e.stopPropagation()}>{children}</div>
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title="Delete student"
      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700 text-gray-400 hover:text-red-400"
    >
      <Trash2 size={13} />
    </button>
  )
}

export function CompactCards({ students, semesterMark, projectMarks, avatar, cardColor, onSelect, onDelete }: ViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
      {students.map(s => {
        const sem = semesterMark(s.id)
        const color = cardColor(s.id)
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="group relative rounded-xl p-4 flex flex-col gap-3 cursor-pointer select-none shadow-sm shadow-black/10 hover:shadow-md transition-shadow"
            style={{ background: color.cardBg, border: `1px solid ${color.border}` }}
          >
            <div className="flex items-center gap-3">
              <Photo>{avatar(s, 48)}</Photo>
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-100 leading-tight truncate">{s.firstName ?? s.name}</p>
                {s.firstName && <p className="text-sm text-gray-400 truncate">{s.name}</p>}
              </div>
              <span className={cn('ml-auto text-2xl font-bold', markClass(sem))}>{pctText(sem)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {projectMarks(s.id).map(({ name, pct }) => (
                <div key={name} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-2 text-[11px] text-gray-400">
                  <span className="truncate" title={name}>{name}</span>
                  <span className="h-1.5 rounded-full bg-black/[0.07] dark:bg-white/10 overflow-hidden">
                    {pct !== null && <span className={cn('block h-full rounded-full', barClass(pct))} style={{ width: `${Math.min(100, pct)}%` }} />}
                  </span>
                  <span className={cn('text-right font-semibold', markClass(pct))}>{pctText(pct)}</span>
                </div>
              ))}
            </div>
            <div className="absolute top-2 right-2"><DeleteButton onClick={() => onDelete(s.id)} /></div>
          </div>
        )
      })}
    </div>
  )
}

export function RosterList({ students, semesterMark, projectMarks, avatar, onSelect, onDelete }: ViewProps) {
  const projectNames = students.length ? projectMarks(students[0].id).map(p => p.name) : []
  const th = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap'
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700 shadow-md shadow-black/30">
      <table className="w-full text-sm">
        <thead className="bg-gray-850 border-b border-gray-700">
          <tr>
            <th className={th}>Student</th>
            <th className={th}>Email</th>
            <th className={th}>Semester</th>
            {projectNames.map(n => <th key={n} className={th}>{n}</th>)}
            <th className={th}>Standing</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const sem = semesterMark(s.id)
            const standing = standingOf(sem)
            return (
              <tr key={s.id} onClick={() => onSelect(s.id)} className="group border-b border-gray-700 last:border-0 cursor-pointer hover:bg-gray-200/5 transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3 font-medium text-gray-100 whitespace-nowrap">
                    <Photo>{avatar(s, 40)}</Photo>
                    {fullName(s)}
                  </div>
                </td>
                <td className="px-4 py-2 text-xs whitespace-nowrap">
                  {s.email ? <span className="text-gray-400">{s.email}</span> : <span className="text-red-400">No email</span>}
                </td>
                <td className={cn('px-4 py-2 font-semibold tabular-nums', markClass(sem))}>{pctText(sem)}</td>
                {projectMarks(s.id).map(({ name, pct }) => (
                  <td key={name} className={cn('px-4 py-2 font-semibold tabular-nums', markClass(pct))}>{pctText(pct)}</td>
                ))}
                <td className="px-4 py-2">
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', standing.pill)}>{standing.label}</span>
                </td>
                <td className="px-2 py-2 text-right"><DeleteButton onClick={() => onDelete(s.id)} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function FaceWall({ students, semesterMark, avatar, onSelect }: ViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-6">
      {students.map(s => {
        const sem = semesterMark(s.id)
        return (
          <div key={s.id} onClick={() => onSelect(s.id)} className="flex flex-col items-center text-center cursor-pointer select-none group">
            <div className="relative">
              <Photo>{avatar(s, 112)}</Photo>
              {sem !== null && (
                <span className={cn('absolute -bottom-1 -right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-850 border border-gray-700 shadow-sm', gradeColor(sem))}>
                  {pctText(sem)}
                </span>
              )}
            </div>
            <p className="mt-3 text-base font-semibold text-gray-100 leading-tight group-hover:underline underline-offset-2">{s.firstName ?? s.name}</p>
            {s.firstName && <p className="text-sm text-gray-400">{s.name}</p>}
          </div>
        )
      })}
    </div>
  )
}

export function StandingBoard({ students, semesterMark, avatar, onSelect }: ViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
      {STANDINGS.map(col => {
        const list = students.filter(s => standingOf(semesterMark(s.id)).id === col.id)
        return (
          <div key={col.id} className="rounded-xl bg-black/[0.04] dark:bg-white/[0.03] border border-gray-700 p-2.5">
            <div className="flex items-center gap-2 px-1 pb-2.5">
              <span className={cn('w-2 h-2 rounded-full', col.dot)} />
              <span className="text-sm font-semibold text-gray-100">{col.label}</span>
              <span className="ml-auto text-xs text-gray-400">{col.range}{col.range && ' · '}{list.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map(s => {
                const sem = semesterMark(s.id)
                return (
                  <div
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className="flex items-center gap-2.5 rounded-lg bg-white/80 dark:bg-gray-850 border border-gray-700 px-2.5 py-2 cursor-pointer hover:border-gray-600 transition-colors"
                  >
                    <Photo>{avatar(s, 40)}</Photo>
                    <span className="text-sm text-gray-100 truncate">{fullName(s)}</span>
                    <span className={cn('ml-auto text-sm font-bold', markClass(sem))}>{pctText(sem)}</span>
                  </div>
                )
              })}
              {list.length === 0 && <p className="text-xs text-gray-400/60 px-1 pb-1">Nobody</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
