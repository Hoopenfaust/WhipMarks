import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useScheduleWeeks } from '../../db/hooks/useSchedule'
import type { Project } from '../../types'
import { cn } from '../../utils/cn'
import { barColor } from './GanttChart'

const NUM_WEEKS = 13
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function parseLocal(iso: string): Date { return new Date(iso + 'T00:00:00') }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function sameDay(a: Date, b: Date): boolean { return a.toDateString() === b.toDateString() }

interface Props {
  classId: string
  startDate: string | undefined
  projects: Project[]
}

export function CalendarView({ classId, startDate, projects }: Props) {
  const savedWeeks = useScheduleWeeks(classId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const semesterStart = startDate ? parseLocal(startDate) : null
  const semesterEnd = semesterStart ? addDays(semesterStart, NUM_WEEKS * 7 - 1) : null

  // Open on the current month during the semester, otherwise on the month the semester starts.
  const [month, setMonth] = useState(() => {
    const inSemester = semesterStart && semesterEnd && today >= semesterStart && today <= semesterEnd
    const base = inSemester || !semesterStart ? today : semesterStart
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // Grid runs Monday → Sunday, from the week containing the 1st to the week containing the last day.
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const gridStart = addDays(first, -((first.getDay() + 6) % 7))
  const weekCount = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7)
  const weeks = Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d))
  )

  function semesterWeekOf(monday: Date): number | null {
    if (!semesterStart) return null
    const n = Math.floor(Math.round((monday.getTime() - semesterStart.getTime()) / 86_400_000) / 7) + 1
    return n >= 1 && n <= NUM_WEEKS ? n : null
  }

  // The part of each project (start → due) that falls in this Monday–Sunday week, as day columns 0–6.
  // Projects without a start date show on their due day only.
  function segmentsIn(days: Date[]) {
    const weekStart = days[0], weekEnd = days[6]
    return projects
      .filter(p => p.dueDate)
      .map(p => {
        const due = parseLocal(p.dueDate)
        const start = p.startDate ? parseLocal(p.startDate) : due
        return { project: p, start: start <= due ? start : due, due }
      })
      .filter(({ start, due }) => start <= weekEnd && due >= weekStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(({ project, start, due }) => {
        const from = start < weekStart ? 0 : days.findIndex(d => sameDay(d, start))
        const to = due > weekEnd ? 6 : days.findIndex(d => sameDay(d, due))
        return { project, from, to, isStart: start >= weekStart, isDue: due <= weekEnd }
      })
  }

  const shiftMonth = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <div className="pb-8">
      {/* Month navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => shiftMonth(-1)}
          title="Previous month"
          className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => shiftMonth(1)}
          title="Next month"
          className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <h3 className="text-lg font-semibold text-gray-100 ml-2">
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </h3>
        <button
          onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-100 hover:bg-gray-750 transition-colors"
        >
          Today
        </button>
      </div>

      {!semesterStart && (
        <p className="text-xs text-gray-400/70 mb-3">Set a semester start date in Weekly Schedule to see week numbers and topics.</p>
      )}

      <div className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden">
        {/* Day header */}
        <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] border-b border-gray-700 bg-gray-900/80">
          <div />
          {DAY_NAMES.map(d => (
            <div key={d} className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{d}</div>
          ))}
        </div>

        {weeks.map(days => {
          const weekNum = semesterWeekOf(days[0])
          const topic = weekNum ? savedWeeks.find(w => w.weekNumber === weekNum)?.title : undefined
          const segments = segmentsIn(days)
          // Row 1 holds the day numbers, then one row per project bar, then a spacer so empty weeks keep their height.
          const rowSpan = `1 / span ${segments.length + 2}`
          return (
            <div key={days[0].toISOString()} className="border-b border-gray-800 last:border-0">
              {topic && (
                <div className="pl-[4.5rem] pr-3 pt-1.5 text-xs text-gray-400 truncate" title={topic}>{topic}</div>
              )}
              <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))]">
                {/* Semester week */}
                <div className="flex items-start justify-center pt-2" style={{ gridColumn: 1, gridRow: rowSpan }}>
                  {weekNum && (
                    <span className="w-9 h-6 rounded bg-gray-800/70 border border-gray-700/50 flex items-center justify-center text-[11px] font-bold text-gray-100 tabular-nums" title={`Semester week ${weekNum}`}>
                      {weekNum}
                    </span>
                  )}
                </div>

                {days.map((day, i) => {
                  const inMonth = day.getMonth() === month.getMonth()
                  const isToday = sameDay(day, today)
                  return (
                    <div
                      key={day.toISOString()}
                      style={{ gridColumn: i + 2, gridRow: rowSpan }}
                      className={cn(
                        'min-h-24 px-1.5 py-1.5 border-l border-gray-800',
                        !inMonth && 'opacity-40',
                        (day.getDay() === 0 || day.getDay() === 6) && 'bg-black/[0.03] dark:bg-white/[0.02]'
                      )}
                    >
                      <span className={cn(
                        'text-xs tabular-nums w-6 h-6 flex items-center justify-center rounded-full',
                        isToday ? 'btn-accent font-semibold' : 'text-gray-400'
                      )}>
                        {day.getDate()}
                      </span>
                    </div>
                  )
                })}

                {/* Day-number row height, so bars start below the numbers */}
                <div className="h-9" style={{ gridColumn: 2, gridRow: 1 }} />

                {/* Project bars spanning the days they run */}
                {segments.map(({ project, from, to, isStart, isDue }, lane) => {
                  const color = barColor(project.id)
                  return (
                    <div
                      key={project.id}
                      title={`${project.name}${project.startDate ? ` · ${project.startDate} → ${project.dueDate}` : ` · due ${project.dueDate}`}`}
                      style={{
                        gridColumn: `${from + 2} / ${to + 3}`,
                        gridRow: lane + 2,
                        background: `${color}2e`,
                        borderLeft: isStart ? `3px solid ${color}` : undefined,
                        color,
                      }}
                      className={cn(
                        'relative z-10 mb-1 flex items-center gap-2 px-2 py-1 text-[11px] font-semibold leading-tight min-w-0',
                        isStart ? 'ml-1 rounded-l' : '',
                        isDue ? 'mr-1 rounded-r' : ''
                      )}
                    >
                      <span className="truncate">{project.name}</span>
                      {isDue && (
                        <span className="ml-auto shrink-0 rounded px-1.5 py-px text-[10px] text-white" style={{ background: color }}>Due</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
