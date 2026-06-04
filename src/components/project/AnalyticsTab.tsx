import type { Student, RubricCriterion, Mark } from '../../types'
import { calcProjectPercentage } from '../../utils/marks'
import { cn } from '../../utils/cn'

interface Props {
  students: Student[]
  criteria: RubricCriterion[]
  marks: Mark[]
}

const BINS = [
  { label: '≥ 90%',  min: 90,  max: 101, color: 'bg-emerald-500' },
  { label: '80–89%', min: 80,  max: 90,  color: 'bg-emerald-700' },
  { label: '70–79%', min: 70,  max: 80,  color: 'bg-blue-600' },
  { label: '65–69%', min: 65,  max: 70,  color: 'bg-blue-800' },
  { label: '50–64%', min: 50,  max: 65,  color: 'bg-amber-600' },
  { label: '< 50%',  min: -1,  max: 50,  color: 'bg-red-700' },
]

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function stdDev(nums: number[], mean: number): number {
  if (nums.length < 2) return 0
  return Math.sqrt(nums.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / nums.length)
}

export function AnalyticsTab({ students, criteria, marks }: Props) {
  // Only students who are fully marked
  const complete = students.filter(s =>
    criteria.every(c => marks.some(m => m.studentId === s.id && m.criterionId === c.id))
  )

  if (complete.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-8">
        <p className="text-sm font-medium text-gray-300">No fully-marked students yet</p>
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
          Analytics appear once at least one student has every criterion marked. Head to the Marking Grid to get started.
        </p>
      </div>
    )
  }

  // Overall percentages
  const overallPcts = complete.map(s => calcProjectPercentage(marks.filter(m => m.studentId === s.id), criteria))
  const mean   = overallPcts.reduce((a, b) => a + b, 0) / overallPcts.length
  const med    = median(overallPcts)
  const high   = Math.max(...overallPcts)
  const low    = Math.min(...overallPcts)
  const sd     = stdDev(overallPcts, mean)
  const passes = overallPcts.filter(p => p >= 65).length

  // Per-criterion stats
  const criterionStats = criteria.map(c => {
    const cMarks = marks.filter(m => m.criterionId === c.id && complete.some(s => s.id === m.studentId))
    const pcts   = cMarks.map(m => (m.score / c.maxMarks) * 100)
    const cMean  = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0
    return { criterion: c, pcts, mean: cMean }
  }).sort((a, b) => a.mean - b.mean)  // weakest first

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-8">

      {/* ── Summary stats ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Overall — {complete.length} student{complete.length !== 1 ? 's' : ''}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Mean',    value: `${mean.toFixed(1)}%` },
            { label: 'Median',  value: `${med.toFixed(1)}%` },
            { label: 'High',    value: `${high.toFixed(1)}%` },
            { label: 'Low',     value: `${low.toFixed(1)}%` },
            { label: 'Pass rate', value: `${Math.round((passes / complete.length) * 100)}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-xl font-bold text-gray-100">{value}</p>
            </div>
          ))}
        </div>
        {sd > 0 && (
          <p className="text-xs text-gray-400/60 mt-2 px-1">Std dev {sd.toFixed(1)}%</p>
        )}
      </div>

      {/* ── Grade distribution ─────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Grade Distribution</p>
        <div className="flex flex-col gap-2">
          {BINS.map(bin => {
            const count = overallPcts.filter(p => p >= bin.min && p < bin.max).length
            const pct   = complete.length > 0 ? (count / complete.length) * 100 : 0
            return (
              <div key={bin.label} className="flex items-center gap-3">
                <span className="w-16 text-right text-xs text-gray-400 shrink-0">{bin.label}</span>
                <div className="flex-1 h-7 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                  <div
                    className={cn('h-full rounded-lg transition-all', bin.color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-xs font-semibold text-gray-300 shrink-0">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Per-criterion breakdown ────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Per Criterion</p>
        <p className="text-xs text-gray-400/60 mb-3">Sorted weakest first</p>
        <div className="flex flex-col gap-3">
          {criterionStats.map(({ criterion, pcts, mean: cMean }) => {
            const barColor = cMean >= 65 ? 'bg-blue-600' : cMean >= 45 ? 'bg-amber-600' : 'bg-red-700'
            return (
              <div key={criterion.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-100">{criterion.name}</p>
                    {criterion.description && <p className="text-xs text-gray-400/70 mt-0.5">{criterion.description}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className={cn('text-lg font-bold', cMean >= 65 ? 'text-emerald-400' : cMean >= 45 ? 'text-amber-400' : 'text-red-400')}>
                      {cMean.toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-400">mean</p>
                  </div>
                </div>

                {/* Mean bar */}
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
                  <div className={cn('h-full rounded-full', barColor)} style={{ width: `${cMean}%` }} />
                </div>

                {/* Score dots — larger, labelled, with full tooltip */}
                <div className="flex items-end gap-2 flex-wrap">
                  {pcts.map((p, i) => {
                    const s = complete[i]
                    const displayName = s.firstName ? s.firstName : s.name.split(' ')[0]
                    const fullName = s.firstName ? `${s.firstName} ${s.name}` : s.name
                    const dotColor = p >= 65 ? 'bg-emerald-500' : p >= 45 ? 'bg-amber-500' : 'bg-red-500'
                    return (
                      <div key={s.id}
                        title={`${fullName} — ${p.toFixed(0)}%`}
                        className="flex flex-col items-center gap-1 cursor-default"
                      >
                        <span className="text-[10px] text-gray-400 tabular-nums">{p.toFixed(0)}%</span>
                        <div className={cn('w-3 h-3 rounded-full', dotColor)} />
                        <span className="text-[9px] text-gray-500 max-w-[28px] truncate text-center">{displayName}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
