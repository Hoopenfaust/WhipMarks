import { useState, useEffect } from 'react'
import { Calendar, FileText } from 'lucide-react'
import { useScheduleWeeks, upsertScheduleWeek } from '../../db/hooks/useSchedule'
import { updateClassStartDate } from '../../db/hooks/useClasses'
import type { Project, ScheduleWeek } from '../../types'
import { cn } from '../../utils/cn'

const NUM_WEEKS = 13
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function fmt(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function weekRangeLabel(start: Date, weekNum: number): string {
  const s = addDays(start, (weekNum - 1) * 7)
  const e = addDays(s, 6)
  return `${fmt(s)} – ${fmt(e)}`
}

function projectsDueInWeek(start: Date, weekNum: number, projects: Project[]): Project[] {
  return projects.filter(p => {
    if (!p.dueDate) return false
    const due = new Date(p.dueDate + 'T00:00:00')
    const ws = addDays(start, (weekNum - 1) * 7)
    const we = addDays(ws, 6)
    return due >= ws && due <= we
  })
}

// ─── Week row ────────────────────────────────────────────────────────────────

interface WeekRowProps {
  weekNum: number
  dateLabel: string
  savedWeek: ScheduleWeek | undefined
  classId: string
  dueProjects: Project[]
}

function WeekRow({ weekNum, dateLabel, savedWeek, classId, dueProjects }: WeekRowProps) {
  const [title, setTitle] = useState(savedWeek?.title ?? '')
  const [notes, setNotes] = useState(savedWeek?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(false)

  // Sync state when DB record first loads (undefined → record)
  useEffect(() => {
    if (savedWeek) {
      setTitle(savedWeek.title)
      setNotes(savedWeek.notes)
      if (savedWeek.notes) setNotesOpen(true)
    }
  }, [savedWeek?.id])

  async function save() {
    await upsertScheduleWeek(classId, weekNum, title.trim(), notes.trim(), savedWeek?.id)
  }

  const hasNotes = !!notes

  return (
    <div className={cn(
      'border-b border-gray-800 last:border-0',
      weekNum % 2 === 0 ? 'bg-gray-900/20' : ''
    )}>
      <div className="flex items-center gap-3 px-5 py-3">
        {/* Week badge */}
        <div className="shrink-0 w-9 h-6 rounded bg-gray-800/70 border border-gray-700/50 flex items-center justify-center">
          <span className="text-[11px] font-bold text-gray-100 tabular-nums leading-none">{weekNum}</span>
        </div>

        {/* Date range */}
        <span className="shrink-0 w-36 text-xs text-gray-400 tabular-nums font-mono">{dateLabel}</span>

        {/* Title input */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="Week topic or activity…"
          className="flex-1 bg-transparent text-sm text-gray-100 placeholder-chiffon-muted/50 focus:outline-none"
        />

        {/* Due project badges */}
        {dueProjects.map(p => (
          <span
            key={p.id}
            title={`${p.name} due this week`}
            className="shrink-0 text-[10px] font-semibold bg-gray-800/60 text-gray-100 border border-gray-700/40 rounded px-1.5 py-0.5 max-w-[96px] truncate"
          >
            {p.name}
          </span>
        ))}

        {/* Notes toggle */}
        <button
          onClick={() => setNotesOpen(o => !o)}
          title={notesOpen ? 'Hide notes' : 'Add notes'}
          className={cn(
            'shrink-0 p-1.5 rounded transition-colors',
            notesOpen
              ? 'text-blue-400 bg-blue-950/40 border border-blue-900/40'
              : hasNotes
              ? 'text-blue-500/60 hover:text-blue-400'
              : 'text-gray-400/50 hover:text-gray-400 hover:bg-gray-800'
          )}
        >
          <FileText size={13} />
        </button>
      </div>

      {notesOpen && (
        <div className="px-5 pb-3" style={{ paddingLeft: '4.75rem' }}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={save}
            placeholder="Notes, readings, resources, or reminders for this week…"
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-chiffon-muted/50 resize-none focus:outline-none focus:border-gray-600 transition-colors"
          />
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  classId: string
  startDate: string | undefined
  projects: Project[]
}

export function ClassSchedule({ classId, startDate, projects }: Props) {
  const savedWeeks = useScheduleWeeks(classId)
  const weekMap: Record<number, ScheduleWeek> = Object.fromEntries(
    savedWeeks.map(w => [w.weekNumber, w])
  )

  // Parse start date as local midnight (avoid UTC timezone shifts)
  const startDateObj = startDate ? new Date(startDate + 'T00:00:00') : null

  return (
    <div className="max-w-4xl mx-auto pb-8">

      {/* Start date config bar */}
      <div className="flex items-center gap-4 mb-5 px-4 py-3 bg-gray-900/60 border border-gray-800 rounded-xl">
        <Calendar size={15} className="shrink-0" style={{ color: '#c2410c' }} />
        <span className="text-sm text-gray-400 shrink-0">Semester start date:</span>
        <input
          type="date"
          value={startDate ?? ''}
          onChange={e => updateClassStartDate(classId, e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-gray-200 transition-colors"
        />
        {startDate && startDateObj && (
          <span className="text-xs text-gray-400/70 ml-1">
            Week 1 starts {fmt(startDateObj)} · Week {NUM_WEEKS} ends {fmt(addDays(startDateObj, NUM_WEEKS * 7 - 1))}
          </span>
        )}
        {!startDate && (
          <span className="text-xs text-gray-400/70">Set a date to see week-by-week dates and project due indicators</span>
        )}
      </div>

      {/* Schedule grid */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-700 bg-gray-900/80">
          <div className="w-9 shrink-0" />
          <span className="w-36 shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Dates</span>
          <span className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Topic / Activity</span>
          <div className="w-8 shrink-0" />
        </div>

        {Array.from({ length: NUM_WEEKS }, (_, i) => i + 1).map(n => (
          <WeekRow
            key={`${n}-${weekMap[n]?.id ?? 'empty'}`}
            weekNum={n}
            dateLabel={startDateObj ? weekRangeLabel(startDateObj, n) : '—'}
            savedWeek={weekMap[n]}
            classId={classId}
            dueProjects={startDateObj ? projectsDueInWeek(startDateObj, n, projects) : []}
          />
        ))}
      </div>

      <p className="text-[11px] text-gray-400/50 mt-3 text-center">
        Click a row to type · <FileText size={10} className="inline mb-px" /> to add notes · Saves automatically
      </p>
    </div>
  )
}
