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

  function eventsOn(day: Date) {
    return projects.flatMap(p => [
      ...(p.startDate && sameDay(parseLocal(p.startDate), day) ? [{ project: p, kind: 'starts' as const }] : []),
      ...(p.dueDate && sameDay(parseLocal(p.dueDate), day) ? [{ project: p, kind: 'due' as const }] : []),
    ])
  }

  const shiftMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

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
          return (
            <div key={days[0].toISOString()} className="border-b border-gray-800 last:border-0">
              {topic && (
                <div className="pl-[4.5rem] pr-3 pt-1.5 text-xs text-gray-400 truncate" title={topic}>{topic}</div>
              )}
              <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))]">
                {/* Semester week */}
                <div className="flex items-start justify-center pt-2">
                  {weekNum && (
                    <span className="w-9 h-6 rounded bg-gray-800/70 border border-gray-700/50 flex items-center justify-center text-[11px] font-bold text-gray-100 tabular-nums" title={`Semester week ${weekNum}`}>
                      {weekNum}
                    </span>
                  )}
                </div>

                {days.map(day => {
                  const inMonth = day.getMonth() === month.getMonth()
                  const isToday = sameDay(day, today)
                  const events = eventsOn(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-24 px-1.5 py-1.5 border-l border-gray-800 flex flex-col gap-1',
                        !inMonth && 'opacity-40',
                        (day.getDay() === 0 || day.getDay() === 6) && 'bg-black/[0.03] dark:bg-white/[0.02]'
                      )}
                    >
                      <span className={cn(
                        'self-start text-xs tabular-nums w-6 h-6 flex items-center justify-center rounded-full',
                        isToday ? 'btn-accent font-semibold' : 'text-gray-400'
                      )}>
                        {day.getDate()}
                      </span>
                      {events.map(({ project, kind }) => (
                        <span
                          key={project.id + kind}
                          title={`${project.name} ${kind === 'due' ? 'due' : 'starts'}`}
                          className="text-[11px] font-medium leading-tight rounded px-1.5 py-1 truncate"
                          style={kind === 'due'
                            ? { background: barColor(project.id), color: '#fff' }
                            : { border: `1px solid ${barColor(project.id)}`, color: barColor(project.id) }}
                        >
                          {kind === 'due' ? 'Due: ' : 'Starts: '}{project.name}
                        </span>
                      ))}
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
