import { useState } from 'react'
import { Upload, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Student, RubricCriterion, Mark, TaMark } from '../../types'
import { calcProjectPercentage, gradeColor } from '../../utils/marks'
import { cn } from '../../utils/cn'
import { openFilePicker, parseTaResultsFile } from '../../utils/taExport'
import { db } from '../../db/db'
import { newId } from '../../utils/id'

interface Props {
  students: Student[]
  criteria: RubricCriterion[]
  teacherMarks: Mark[]
  taMarks: TaMark[]
  projectId: string
  onTaMarksImported: () => void
}

export function TaModerationView({ students, criteria, teacherMarks, taMarks, projectId, onTaMarksImported }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmReimport, setConfirmReimport] = useState(false)

  const hasTaMarks = taMarks.length > 0
  const taName     = taMarks[0]?.taName ?? ''

  function getTeacherMark(studentId: string, criterionId: string) {
    return teacherMarks.find(m => m.studentId === studentId && m.criterionId === criterionId)
  }
  function getTaMark(studentId: string, criterionId: string) {
    return taMarks.find(m => m.studentId === studentId && m.criterionId === criterionId)
  }

  function toggleExpand(studentId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(studentId) ? next.delete(studentId) : next.add(studentId)
      return next
    })
  }

  async function importResults() {
    setImportError(null)
    setImporting(true)
    try {
      const json = await openFilePicker('.whipmarks-taresults')
      const file = parseTaResultsFile(json)
      if (file.projectId !== projectId) throw new Error('This results file is for a different project.')

      await db.transaction('rw', db.taMarks, async () => {
        await db.taMarks.where('projectId').equals(projectId).delete()
        const records: TaMark[] = file.marks.map(m => ({
          id:          newId(),
          studentId:   m.studentId,
          projectId,
          criterionId: m.criterionId,
          score:       m.score,
          feedback:    m.feedback,
          taName:      file.taName,
          updatedAt:   Date.now(),
        }))
        await db.taMarks.bulkAdd(records)
      })
      onTaMarksImported()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!hasTaMarks) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
          <Upload size={22} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-100">No TA results yet</p>
          <p className="text-xs text-gray-400 mt-1">Import the results file your TA sent back</p>
        </div>
        {importError && <p className="text-xs text-red-400">{importError}</p>}
        <button
          onClick={importResults}
          disabled={importing}
          className="btn-accent flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
        >
          <Upload size={14} />
          {importing ? 'Importing…' : 'Import TA Results'}
        </button>
      </div>
    )
  }

  // ── Moderation table ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-100">Moderation — {taName}</p>
          <p className="text-xs text-gray-400 mt-0.5">Your mark is final. Expand each student to see criterion-level comments.</p>
        </div>
        {confirmReimport ? (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
            <p className="text-xs text-red-300 mr-1">This will overwrite all current TA marks. Continue?</p>
            <button
              onClick={() => { setConfirmReimport(false); importResults() }}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors"
            >
              Yes, re-import
            </button>
            <button
              onClick={() => setConfirmReimport(false)}
              className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReimport(true)}
            disabled={importing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition-colors"
          >
            <Upload size={12} />
            Re-import results
          </button>
        )}
      </div>

      {importError && <p className="text-xs text-red-400 px-1">{importError}</p>}

      {/* Student rows */}
      <div className="rounded-xl border border-gray-700 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_120px_80px] bg-gray-850 border-b border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <span>Student</span>
          <span className="text-center">Your mark</span>
          <span className="text-center">{taName}</span>
          <span className="text-center">Gap</span>
        </div>

        {students.map((s, si) => {
          const sTeacher = teacherMarks.filter(m => m.studentId === s.id)
          const sTa      = taMarks.filter(m => m.studentId === s.id)
          const tPct     = sTeacher.length > 0 ? calcProjectPercentage(sTeacher, criteria) : null
          const taPct    = sTa.length > 0      ? calcProjectPercentage(sTa, criteria)      : null
          const gap      = tPct !== null && taPct !== null ? Math.abs(tPct - taPct) : null
          const isOpen   = expanded.has(s.id)
          const displayName = s.firstName ? `${s.firstName} ${s.name}` : s.name
          const rowBg    = si % 2 === 0 ? 'bg-gray-900/30' : ''

          return (
            <div key={s.id} className={cn('border-b border-gray-700 last:border-0', rowBg)}>

              {/* Summary row */}
              <button
                onClick={() => toggleExpand(s.id)}
                className="w-full grid grid-cols-[1fr_120px_120px_80px] px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  <span className="text-sm text-gray-100">{displayName}</span>
                </div>
                <span className={cn('text-sm font-semibold text-center', tPct !== null ? gradeColor(tPct) : 'text-gray-400')}>
                  {tPct !== null ? `${tPct.toFixed(1)}%` : '—'}
                </span>
                <span className={cn('text-sm font-semibold text-center', taPct !== null ? gradeColor(taPct) : 'text-gray-400')}>
                  {taPct !== null ? `${taPct.toFixed(1)}%` : '—'}
                </span>
                <span className={cn('text-sm font-semibold text-center',
                  gap === null ? 'text-gray-400' :
                  gap > 15    ? 'text-red-400' :
                  gap > 8     ? 'text-amber-400' : 'text-emerald-400'
                )}>
                  {gap !== null ? (
                    <span className="flex items-center justify-center gap-1">
                      {gap > 15 && <AlertTriangle size={11} />}
                      {gap === 0 ? <CheckCircle2 size={11} /> : null}
                      {gap.toFixed(1)}%
                    </span>
                  ) : '—'}
                </span>
              </button>

              {/* Criterion detail */}
              {isOpen && (
                <div className="border-t border-gray-700/50 bg-gray-850/40">
                  {criteria.map(c => {
                    const tm = getTeacherMark(s.id, c.id)
                    const am = getTaMark(s.id, c.id)
                    const tScore  = tm?.score
                    const aScore  = am?.score
                    const cGap    = tScore !== undefined && aScore !== undefined
                      ? Math.abs((tScore / c.maxMarks - aScore / c.maxMarks) * 100) : null

                    return (
                      <div key={c.id} className="px-8 py-3 border-b border-gray-700/30 last:border-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-300">{c.name}</p>
                            {c.description && <p className="text-xs text-gray-400/70 mt-0.5">{c.description}</p>}
                          </div>
                          <div className="flex items-center gap-4 shrink-0 text-xs tabular-nums">
                            <span className="text-gray-400">You: <span className="font-semibold text-gray-100">{tScore ?? '—'}/{c.maxMarks}</span></span>
                            <span className="text-gray-400">{taName}: <span className="font-semibold text-gray-100">{aScore ?? '—'}/{c.maxMarks}</span></span>
                            {cGap !== null && (
                              <span className={cn('font-semibold', cGap > 20 ? 'text-red-400' : cGap > 10 ? 'text-amber-400' : 'text-emerald-400')}>
                                Δ {cGap.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Your feedback', text: tm?.feedback },
                            { label: `${taName}'s feedback`, text: am?.feedback },
                          ].map(({ label, text }) => (
                            <div key={label}>
                              <p className="text-[10px] font-semibold text-gray-400/70 uppercase tracking-wider mb-1">{label}</p>
                              {text
                                ? <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
                                : <p className="text-xs text-gray-400/40 italic">No feedback</p>
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400/60 text-center">
        Gap &gt;15% flagged in red · &gt;8% in amber · Your marks are always final
      </p>
    </div>
  )
}
