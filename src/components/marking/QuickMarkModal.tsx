import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react'
import type { Student, RubricCriterion, Mark, RubricDescriptor } from '../../types'
import { upsertMark } from '../../db/hooks/useMarks'
import { LEVELS } from '../../utils/levels'
import { calcProjectPercentage, gradeColor } from '../../utils/marks'
import { cn } from '../../utils/cn'

interface Props {
  students: Student[]
  criteria: RubricCriterion[]
  marks: Mark[]
  projectId: string
  descriptors: RubricDescriptor[]
  initialStudentIdx?: number
  onClose: () => void
}

export function QuickMarkModal({
  students,
  criteria,
  marks,
  projectId,
  descriptors,
  initialStudentIdx = 0,
  onClose,
}: Props) {
  const [studentIdx, setStudentIdx] = useState(Math.max(0, Math.min(initialStudentIdx, students.length - 1)))
  const [saving, setSaving] = useState<string | null>(null) // criterionId being saved
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')

  const student = students[studentIdx]

  const prev = useCallback(() => setStudentIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setStudentIdx(i => Math.min(students.length - 1, i + 1)), [students.length])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't navigate when user is typing in feedback
      if (feedbackOpen) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose, feedbackOpen])

  async function applyLevel(criterion: RubricCriterion, levelId: string) {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return
    const descriptor = descriptors.find(d => d.criterionId === criterion.id && d.level === levelId)
    const fraction = descriptor?.score ?? level.defaultScore
    const score = Math.round(criterion.maxMarks * fraction)
    const existingMark = marks.find(m => m.studentId === student.id && m.criterionId === criterion.id)
    setSaving(criterion.id)
    try {
      await upsertMark(student.id, projectId, criterion.id, score, existingMark?.feedback ?? '')
    } catch (err) {
      alert('Failed to save mark: ' + String(err))
    } finally {
      setSaving(null)
    }
  }

  async function saveFeedback(criterion: RubricCriterion) {
    const mark = marks.find(m => m.studentId === student.id && m.criterionId === criterion.id)
    const score = mark?.score ?? 0
    try {
      await upsertMark(student.id, projectId, criterion.id, score, feedbackText)
    } catch (err) {
      alert('Failed to save feedback: ' + String(err))
    }
    setFeedbackOpen(null)
  }

  function openFeedback(criterion: RubricCriterion) {
    const mark = marks.find(m => m.studentId === student.id && m.criterionId === criterion.id)
    setFeedbackText(mark?.feedback ?? '')
    setFeedbackOpen(criterion.id)
  }

  const studentMarks = marks.filter(m => m.studentId === student.id)
  const pct = criteria.length > 0 ? calcProjectPercentage(studentMarks, criteria) : null
  const isComplete = criteria.every(c => studentMarks.some(m => m.criterionId === c.id))
  const completedCount = criteria.filter(c => studentMarks.some(m => m.criterionId === c.id)).length
  const showDots = students.length <= 24

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-gray-850 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl z-10 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800 shrink-0">
          <button
            onClick={prev}
            disabled={studentIdx === 0}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className="text-base font-semibold text-gray-100 truncate">
              {student.firstName ? `${student.firstName} ${student.name}` : student.name}
            </p>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-xs text-gray-600">{studentIdx + 1} of {students.length}</span>
              {isComplete ? (
                <span className={cn('text-xs font-semibold flex items-center gap-1', gradeColor(pct!))}>
                  <CheckCircle2 size={11} />
                  {pct!.toFixed(1)}%
                </span>
              ) : (
                <span className="text-xs text-gray-600">
                  {completedCount}/{criteria.length} criteria
                </span>
              )}
            </div>
          </div>

          <button
            onClick={next}
            disabled={studentIdx === students.length - 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors ml-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-gray-800 shrink-0">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: criteria.length > 0 ? `${(completedCount / criteria.length) * 100}%` : '0%' }}
          />
        </div>

        {/* Criteria cards */}
        <div className="overflow-y-auto p-4 flex flex-col gap-3">
          {criteria.map(c => {
            const mark = marks.find(m => m.studentId === student.id && m.criterionId === c.id)
            const isSaving = saving === c.id
            const isEditingFeedback = feedbackOpen === c.id
            const hasFeedback = !!(mark?.feedback)
            const scorePct = mark ? (mark.score / c.maxMarks) * 100 : null

            return (
              <div key={c.id} className={cn(
                'bg-gray-900 border rounded-xl p-4 transition-colors',
                mark ? 'border-gray-700' : 'border-gray-800'
              )}>
                {/* Criterion header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-200">{c.name}</p>
                    {c.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{c.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {mark !== undefined ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={cn('text-sm font-bold tabular-nums', scorePct !== null ? gradeColor(scorePct) : 'text-gray-400')}>
                          {mark.score} / {c.maxMarks}
                        </span>
                        {scorePct !== null && (
                          <span className="text-xs text-gray-600">{scorePct.toFixed(0)}%</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-700">not marked</span>
                    )}
                  </div>
                </div>

                {/* Level buttons */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {LEVELS.map(level => {
                    const descriptor = descriptors.find(d => d.criterionId === c.id && d.level === level.id)
                    const fraction = descriptor?.score ?? level.defaultScore
                    const pts = Math.round(c.maxMarks * fraction)
                    const isActive = mark !== undefined && mark.score === pts

                    return (
                      <button
                        key={level.id}
                        onClick={() => applyLevel(c, level.id)}
                        disabled={isSaving}
                        title={descriptor?.text || level.label}
                        className={cn(
                          'flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-center transition-all duration-100',
                          isActive
                            ? cn('border-orange-500/60 ring-1 ring-orange-500/30 scale-[1.03]', level.bgColor)
                            : cn('border-gray-700 hover:border-gray-500', level.bgColor, 'hover:scale-[1.02]'),
                          isSaving && 'opacity-50 cursor-wait'
                        )}
                      >
                        <span className={cn('text-xs font-bold leading-tight', level.textColor)}>
                          {level.shortLabel.split(' ')[0]}
                        </span>
                        <span className="text-[11px] text-gray-500 tabular-nums font-medium">
                          {pts} / {c.maxMarks}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Feedback toggle */}
                {isEditingFeedback ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <textarea
                      autoFocus
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setFeedbackOpen(null)
                        if (e.key === 'Enter' && e.metaKey) saveFeedback(c)
                      }}
                      rows={2}
                      placeholder="Feedback for this criterion…"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveFeedback(c)}
                        className="px-3 py-1 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setFeedbackOpen(null)}
                        className="px-3 py-1 text-gray-500 hover:text-gray-300 text-xs rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="ml-auto text-[10px] text-gray-700 self-center">⌘↵ to save</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openFeedback(c)}
                    className={cn(
                      'mt-1 text-xs transition-colors',
                      hasFeedback
                        ? 'text-orange-400 hover:text-orange-300'
                        : 'text-gray-700 hover:text-gray-500'
                    )}
                  >
                    {hasFeedback ? `✦ ${mark!.feedback}` : '+ add feedback'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-gray-700">← → navigate · Esc close</p>
          {showDots ? (
            <div className="flex items-center gap-1">
              {students.map((_, i) => {
                const sm = marks.filter(m => m.studentId === students[i].id)
                const done = criteria.every(c => sm.some(m => m.criterionId === c.id))
                return (
                  <button
                    key={i}
                    onClick={() => setStudentIdx(i)}
                    className={cn(
                      'rounded-full transition-all duration-200',
                      i === studentIdx
                        ? 'w-4 h-1.5 bg-orange-500'
                        : done
                        ? 'w-1.5 h-1.5 bg-emerald-600 hover:bg-emerald-400'
                        : 'w-1.5 h-1.5 bg-gray-700 hover:bg-gray-500'
                    )}
                    title={students[i].firstName ? `${students[i].firstName} ${students[i].name}` : students[i].name}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{ width: `${students.length > 0 ? ((studentIdx + 1) / students.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-600 tabular-nums">{studentIdx + 1}/{students.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
