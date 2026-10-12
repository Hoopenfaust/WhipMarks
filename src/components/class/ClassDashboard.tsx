import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldCheck, ShieldAlert, CalendarClock, ChevronRight, Zap, Star, TrendingUp, AlertTriangle, Flag } from 'lucide-react'
import { db } from '../../db/db'
import type { Class, Student, Project, RubricCriterion, Mark } from '../../types'
import { calcProjectPercentage, calcStudentSemesterMark } from '../../utils/marks'
import { cn } from '../../utils/cn'
import { MaceArt } from './MaceArt'

const NUM_WEEKS = 13
const DAY = 86_400_000
const ACCENT = '#a78bfa'

interface Props {
  classObj: Class
  students: Student[]
  projects: Project[]
  allMarks: Mark[]
  allCriteria: RubricCriterion[]
}

function parseLocal(iso: string) { return new Date(iso + 'T00:00:00') }
function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return d.toLocaleDateString('en-CA', opts)
}

function Panel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gray-700/70 bg-gray-850/80 backdrop-blur p-7',
        onClick && 'cursor-pointer hover:border-orange-500/30 transition-colors',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[13px] uppercase tracking-[0.06em] text-gray-300">{children}</p>
}

function Ring({ pct, size, stroke = 7, children }: { pct: number; size: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2 - 4
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle
          className="accent-glow"
          cx={size / 2} cy={size / 2} r={r} stroke={ACCENT} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * Math.max(0, Math.min(1, pct))} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  )
}

export function ClassDashboard({ classObj, students, projects, allMarks, allCriteria }: Props) {
  const navigate = useNavigate()
  const projectIds = projects.map(p => p.id)
  const emailLogs = useLiveQuery(() => projectIds.length ? db.emailLogs.where('projectId').anyOf(projectIds).toArray() : [], [projectIds.join(',')]) ?? []
  const submissionCounts = useLiveQuery(async () => {
    const subs = projectIds.length ? await db.studentSubmissions.where('projectId').anyOf(projectIds).toArray() : []
    const counts: Record<string, number> = {}
    for (const s of subs) counts[s.projectId] = (counts[s.projectId] ?? 0) + 1
    return counts
  }, [projectIds.join(',')]) ?? {}

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const openProject = (p: Project, tab = 'marking') => navigate(`/classes/${classObj.id}/projects/${p.id}?tab=${tab}`)

  // ── Per-project marking ──────────────────────────────────────────────────
  const criteriaOf = (p: Project) => allCriteria.filter(c => c.projectId === p.id)
  const isFullyMarked = (studentId: string, p: Project) => {
    const criteria = criteriaOf(p)
    return criteria.length > 0 && criteria.every(c => allMarks.some(m => m.studentId === studentId && m.criterionId === c.id))
  }
  const markedCount = (p: Project) => students.filter(s => isFullyMarked(s.id, p)).length
  const markable = projects.filter(p => criteriaOf(p).length > 0)
  const dated = markable.filter(p => p.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const past = dated.filter(p => parseLocal(p.dueDate) <= today)
  const upcoming = dated.filter(p => parseLocal(p.dueDate) >= today)

  // Marking focus: the latest past-due project still being marked, else the latest past-due, else the next one due.
  const focus = [...past].reverse().find(p => markedCount(p) < students.length) ?? past[past.length - 1] ?? upcoming[0]
  const focusMarked = focus ? markedCount(focus) : 0
  const focusPct = focus && students.length ? focusMarked / students.length : 0

  const nextDue = upcoming[0]
  const afterNext = upcoming[1]
  const daysToNext = nextDue ? Math.round((parseLocal(nextDue.dueDate).getTime() - today.getTime()) / DAY) : null

  // ── Semester ─────────────────────────────────────────────────────────────
  const semStart = classObj.startDate ? parseLocal(classObj.startDate) : null
  const daysIn = semStart ? Math.floor((today.getTime() - semStart.getTime()) / DAY) : null
  const semWeek = daysIn === null ? null : Math.min(NUM_WEEKS, Math.max(1, Math.floor(daysIn / 7) + 1))
  const semPct = daysIn === null ? null : Math.min(1, Math.max(0, (daysIn + 1) / (NUM_WEEKS * 7)))

  // ── Standing ─────────────────────────────────────────────────────────────
  const semMarks = students.map(s => calcStudentSemesterMark(s.id, projects, allMarks, allCriteria))
  const standing = {
    high: semMarks.filter(m => m !== null && m >= 85).length,
    track: semMarks.filter(m => m !== null && m >= 65 && m < 85).length,
    borderline: semMarks.filter(m => m !== null && m >= 50 && m < 65).length,
    risk: semMarks.filter(m => m !== null && m < 50).length,
  }
  const needCheckIn = standing.risk + standing.borderline
  const marked = semMarks.filter((m): m is number => m !== null)
  const classAvg = marked.length ? marked.reduce((a, b) => a + b, 0) / marked.length : null

  // ── Average per project, in due order ────────────────────────────────────
  const trend = (dated.length ? dated : markable).map(p => {
    const done = students.filter(s => isFullyMarked(s.id, p))
    const avg = done.length ? done.reduce((sum, s) => sum + calcProjectPercentage(allMarks.filter(m => m.studentId === s.id && m.projectId === p.id), criteriaOf(p)), 0) / done.length : null
    return { name: p.name, avg }
  }).filter((t): t is { name: string; avg: number } => t.avg !== null)
  const lastAvg = trend.length ? trend[trend.length - 1].avg : null
  const delta = trend.length > 1 ? trend[trend.length - 1].avg - trend[trend.length - 2].avg : null
  const completeProjects = markable.filter(p => students.length > 0 && markedCount(p) === students.length).length

  // ── Marked but not yet emailed ───────────────────────────────────────────
  const unsent = markable.map(p => ({
    p, count: students.filter(s => isFullyMarked(s.id, p) && !emailLogs.some(l => l.projectId === p.id && l.studentId === s.id)).length,
  })).filter(x => x.count > 0).sort((a, b) => b.count - a.count)
  const unsentTotal = unsent.reduce((n, x) => n + x.count, 0)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,'

  // Trend chart geometry
  const W = 300, H = 120, PAD = 40
  const pts = trend.map((t, i) => [
    PAD + (trend.length === 1 ? (W - 2 * PAD) / 2 : (i * (W - 2 * PAD)) / (trend.length - 1)),
    H - 24 - (Math.max(0, Math.min(100, t.avg)) / 100) * (H - 40),
  ])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

  return (
    <div className="pb-10">
      {/* Greeting + semester */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <div className="pt-2">
          <div className="flex gap-5 text-sm text-gray-400 mb-6">
            <span>{fmtDate(now, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span className="border-l border-gray-700 pl-5">{now.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <h2 className="text-4xl font-light leading-tight text-gray-100">
            {greeting}<br />
            {students.length === 0 ? `${classObj.name} is ready to set up.`
              : needCheckIn > 0 ? `${needCheckIn} ${needCheckIn === 1 ? 'student needs' : 'students need'} a check-in.`
              : `${classObj.name} is on track.`}
          </h2>
          <p className="mt-4 text-[15px] text-gray-300 leading-relaxed">Real-time overview of your class<br />and marking progress.</p>
        </div>

        <Panel>
          <Label>Semester</Label>
          {semWeek !== null ? (
            <>
              <p className="mt-5 text-5xl font-light tracking-tight text-gray-100">Week {semWeek}<span className="text-xl text-gray-400 ml-1">of {NUM_WEEKS}</span></p>
              <p className="mt-4 text-sm text-gray-300">
                <span className="text-2xl font-light text-orange-400 mr-2">{Math.round(semPct! * 100)}%</span>of the semester complete
              </p>
              <svg viewBox="0 0 260 120" className="absolute -right-2 -bottom-2 w-60 opacity-90 pointer-events-none">
                <defs><linearGradient id="semcurve" x1="0" x2="1"><stop offset="0" stopColor={ACCENT} stopOpacity="0" /><stop offset="1" stopColor={ACCENT} /></linearGradient></defs>
                <path d="M10 110 C 90 105, 70 60, 140 55 S 220 20, 255 5" stroke="url(#semcurve)" strokeWidth="4" fill="none" className="accent-glow" />
              </svg>
            </>
          ) : (
            <p className="mt-5 text-sm text-gray-400">Set a semester start date in Schedule → Weekly Schedule to track the semester.</p>
          )}
        </Panel>
      </div>

      {/* Marking progress · class status · next due */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[300px_1fr_420px] gap-6 mt-6">
        <Panel onClick={focus ? () => openProject(focus) : undefined}>
          <Label>Marking progress</Label>
          <div className="flex justify-center my-6">
            <Ring pct={focusPct} size={190}>
              <p className="text-5xl font-light text-gray-100">{Math.round(focusPct * 100)}<span className="text-xl text-gray-400">%</span></p>
              <p className="mt-1 text-[13px] text-gray-400">{focusMarked} of {students.length}</p>
            </Ring>
          </div>
          <div className="border-t border-gray-700/70 pt-4">
            {focus ? (
              <>
                <p className="text-[15px] text-orange-400">{focus.name}</p>
                <p className="mt-1 text-[13px] text-gray-300">
                  {students.length - focusMarked === 0 ? 'Everyone is marked' : `${students.length - focusMarked} ${students.length - focusMarked === 1 ? 'student' : 'students'} left to mark`}
                </p>
                {/* Who's left: click one to open Quick Mark on them */}
                <div className="mt-3 flex flex-col gap-1">
                  {students.filter(s => !isFullyMarked(s.id, focus)).map(s => {
                    const criteria = criteriaOf(focus)
                    const done = criteria.filter(c => allMarks.some(m => m.studentId === s.id && m.criterionId === c.id)).length
                    return (
                      <button
                        key={s.id}
                        onClick={e => { e.stopPropagation(); navigate(`/classes/${classObj.id}/projects/${focus.id}?tab=marking&student=${s.id}`) }}
                        title={`Mark ${s.firstName ?? s.name} on ${focus.name}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left text-[13px] text-gray-200 hover:bg-orange-500/10 hover:text-gray-100 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(167,139,250,0.8)] shrink-0" />
                        <span className="truncate">{s.firstName ? `${s.firstName} ${s.name}` : s.name}</span>
                        <span className="ml-auto text-[11px] text-gray-400 tabular-nums shrink-0">{done === 0 ? 'not started' : `${done}/${criteria.length}`}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : <p className="text-[13px] text-gray-400">Add a project with a rubric and due date to track marking.</p>}
          </div>
        </Panel>

        <div className="relative flex flex-col items-center text-center min-h-[530px] pt-2">
          <div className="relative z-10 flex flex-col items-center">
          {needCheckIn > 0
            ? <ShieldAlert size={36} strokeWidth={1.6} className="text-amber-400" />
            : <ShieldCheck size={36} strokeWidth={1.6} className="text-orange-400 accent-glow" />}
          <p className={cn('mt-3 text-sm tracking-[0.08em]', needCheckIn > 0 ? 'text-amber-400' : 'text-orange-400')}>
            {needCheckIn > 0 ? 'NEEDS ATTENTION' : 'CLASS ON TRACK'}
          </p>
          <p className="mt-2 text-[13px] text-gray-400 leading-relaxed">
            {classAvg !== null ? <>Class average {classAvg.toFixed(0)}% · {standing.track + standing.high} of {students.length} students<br />on track or above.</> : 'No marks yet this semester.'}
          </p>
          </div>
          {/* The WhipMarks mace, standing on the platform like the car in a vehicle dashboard */}
          <MaceArt className="relative w-[290px] max-w-full -mt-3 -mb-3 pointer-events-none" />
          {/* One block per project: lit once everyone is marked */}
          <div className="relative z-10 flex gap-2.5">
            {markable.slice(0, 8).map(p => {
              const done = students.length > 0 && markedCount(p) === students.length
              return (
                <button
                  key={p.id}
                  onClick={() => openProject(p)}
                  title={`${p.name} — ${markedCount(p)} of ${students.length} marked`}
                  className={cn('w-12 h-16 rounded-lg -skew-x-12 transition-transform hover:-translate-y-1',
                    done ? 'bg-gradient-to-b from-orange-400 to-orange-500/40 shadow-[0_0_28px_rgba(139,92,246,0.5)]' : 'bg-white/[0.05] border border-gray-700')}
                />
              )
            })}
          </div>
          <p className="relative z-10 mt-4 text-xs text-gray-400">Projects fully marked · {completeProjects} of {markable.length}</p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[min(520px,100%)] h-44 rounded-[50%] border border-orange-500/20 pointer-events-none"
            style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.16), transparent)' }}>
            <div className="absolute inset-x-16 inset-y-6 rounded-[50%] border border-dashed border-orange-500/25" />
          </div>
        </div>

        <Panel onClick={nextDue ? () => openProject(nextDue, 'marking') : undefined}>
          <Label>Next due</Label>
          {nextDue ? (
            <>
              <div className="flex items-center mt-5">
                <div>
                  <p className="text-5xl font-light text-gray-100 flex items-center">
                    <Zap size={34} className="text-orange-400 fill-orange-400 accent-glow mr-2" />
                    {daysToNext === 0 ? 'Today' : <>{daysToNext}<span className="text-xl text-gray-400 ml-1">{daysToNext === 1 ? 'day' : 'days'}</span></>}
                  </p>
                  <p className="mt-4 text-[13px] text-gray-300 leading-relaxed">{nextDue.name}<br />Due {fmtDate(parseLocal(nextDue.dueDate))}</p>
                </div>
                <div className="ml-auto">
                  <Ring pct={nextDue.startDate ? Math.min(1, Math.max(0, (today.getTime() - parseLocal(nextDue.startDate).getTime()) / Math.max(DAY, parseLocal(nextDue.dueDate).getTime() - parseLocal(nextDue.startDate).getTime()))) : 0} size={120} stroke={6} />
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-gray-700/70 bg-white/[0.02] px-5 py-4 grid gap-3 text-[13px]">
                <div className="flex justify-between text-gray-300">Submissions uploaded<span className="text-gray-100 font-medium">{submissionCounts[nextDue.id] ?? 0} of {students.length}</span></div>
                <div className="flex justify-between text-gray-300">Weight<span className="text-gray-100 font-medium">{Math.round(nextDue.semesterWeight * 100)}% of semester</span></div>
                <div className="flex justify-between text-gray-300">Started<span className="text-gray-100 font-medium">{nextDue.startDate ? fmtDate(parseLocal(nextDue.startDate)) : '—'}</span></div>
              </div>
            </>
          ) : <p className="mt-5 text-sm text-gray-400">Nothing due. Add due dates on the Projects tab.</p>}
        </Panel>
      </div>

      {/* Trend + standing */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.35fr] gap-6 mt-6">
        <Panel className="grid grid-cols-[170px_1fr] gap-4 items-center">
          <div>
            <Label>Class average<br />trend</Label>
            <p className="mt-4 text-4xl font-light text-orange-400">{lastAvg !== null ? `${lastAvg.toFixed(0)}%` : '—'}</p>
            <p className="mt-1.5 text-[13px] text-gray-400">
              {delta !== null ? <><span className={delta >= 0 ? 'text-orange-400' : 'text-amber-400'}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)} {Math.abs(delta).toFixed(0) === "1" ? "pt" : "pts"}</span> vs last project</> : 'Latest marked project'}
            </p>
          </div>
          {trend.length > 0 ? (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-40">
              <defs><linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ACCENT} stopOpacity=".35" /><stop offset="1" stopColor={ACCENT} stopOpacity="0" /></linearGradient></defs>
              {[50, 75].map(v => { const y = H - 24 - (v / 100) * (H - 40); return <g key={v}><line x1={PAD} x2={W - 6} y1={y} y2={y} stroke="rgba(255,255,255,.12)" strokeDasharray="2 4" /><text x={PAD - 22} y={y + 3} fontSize="9" fill="#918CAB">{v}%</text></g> })}
              {pts.length > 1 && <path d={`${line} L${pts[pts.length - 1][0]} ${H - 22} L${pts[0][0]} ${H - 22}Z`} fill="url(#trendfill)" />}
              {pts.length > 1 && <path d={line} stroke={ACCENT} strokeWidth="2" fill="none" className="accent-glow" />}
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2.5} fill={ACCENT} />)}
              {trend.map((t, i) => <text key={i} x={pts[i][0]} y={H - 6} fontSize="10" fill="#918CAB" textAnchor="middle">{t.name.length > 12 ? t.name.slice(0, 11) + "…" : t.name}</text>)}
            </svg>
          ) : <p className="text-sm text-gray-400">The trend appears once a project is fully marked for at least one student.</p>}
        </Panel>

        <Panel>
          <Label>Class standing summary</Label>
          <div className="grid grid-cols-4 gap-3 mt-6 text-center text-[13px] text-gray-300">
            {[
              { n: standing.high, label: 'High achievers', range: '85%+', icon: Star, rgb: '167,139,250' },
              { n: standing.track, label: 'On track', range: '65–85%', icon: TrendingUp, rgb: '52,211,153' },
              { n: standing.borderline, label: 'Borderline', range: '50–65%', icon: AlertTriangle, rgb: '251,191,36' },
              { n: standing.risk, label: 'At risk', range: 'under 50%', icon: Flag, rgb: '248,113,113' },
            ].map(({ n, label, range, icon: Icon, rgb }) => (
              <div key={label} className={cn('flex flex-col items-center', n === 0 && 'opacity-40')}>
                <div
                  className="w-14 h-14 rounded-full grid place-items-center border"
                  style={{
                    color: `rgb(${rgb})`,
                    background: `radial-gradient(circle at 50% 35%, rgba(${rgb},0.22), rgba(${rgb},0.06))`,
                    borderColor: `rgba(${rgb},0.3)`,
                    boxShadow: n > 0 ? `0 0 22px rgba(${rgb},0.25)` : undefined,
                  }}
                >
                  <Icon size={22} strokeWidth={1.7} />
                </div>
                <p className="mt-3 text-3xl font-light leading-none" style={{ color: n > 0 ? `rgb(${rgb})` : undefined }}>{n}</p>
                <p className="mt-2 text-gray-200">{label}</p>
                <p className="text-gray-400">{range}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Emails + next deadline */}
      <Panel
        className="mt-6 py-5 flex items-center gap-6 bg-gradient-to-r from-orange-500/[0.06] to-orange-500/[0.12]"
        onClick={unsent[0] ? () => openProject(unsent[0].p) : undefined}
      >
        <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-300 grid place-items-center shrink-0"><CalendarClock size={20} /></div>
        <p className="text-[13px] uppercase tracking-[0.06em] text-gray-300 w-56 shrink-0">Marks to email</p>
        <p className="text-gray-300">
          {unsentTotal === 0 ? 'Everyone marked has been emailed'
            : `${unsentTotal} marked ${unsentTotal === 1 ? 'student hasn’t' : 'students haven’t'} been emailed yet${unsent[0] ? ` · most on ${unsent[0].p.name}` : ''}`}
        </p>
        <div className="ml-auto border-l border-gray-700 pl-7 text-sm leading-relaxed text-gray-300 shrink-0">
          {afterNext ? <>Following deadline<br /><span className="text-gray-100">{afterNext.name} · {fmtDate(parseLocal(afterNext.dueDate), { month: 'short', day: 'numeric' })}</span></> : <>No further deadlines<br /><span className="text-gray-400">this semester</span></>}
        </div>
        {unsent[0] && <ChevronRight size={22} className="text-gray-400 shrink-0" />}
      </Panel>
    </div>
  )
}
