import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, CheckCircle2, Mic, Square } from 'lucide-react'
import type { Student, RubricCriterion, Mark, RubricDescriptor, Snippet } from '../../types'
import { upsertMark } from '../../db/hooks/useMarks'
import { upsertImprovementNote } from '../../db/hooks/useImprovementNotes'
import { db } from '../../db/db'
import { LEVELS } from '../../utils/levels'
import { calcProjectPercentage, gradeColor } from '../../utils/marks'
import { cn } from '../../utils/cn'
import { SnippetPicker } from './SnippetPicker'

interface Props {
  students: Student[]
  criteria: RubricCriterion[]
  marks: Mark[]
  projectId: string
  descriptors: RubricDescriptor[]
  snippets: Snippet[]
  initialStudentIdx?: number
  onClose: () => void
}

export function QuickMarkModal({
  students,
  criteria,
  marks,
  projectId,
  descriptors,
  snippets,
  initialStudentIdx = 0,
  onClose,
}: Props) {
  const [studentIdx, setStudentIdx] = useState(Math.max(0, Math.min(initialStudentIdx, students.length - 1)))
  const [saving, setSaving] = useState<string | null>(null) // criterionId being saved
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [markError, setMarkError] = useState<string | null>(null)
  const [improvementText, setImprovementText] = useState('')
  const [recording, setRecording] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const student = students[studentIdx]

  const prev = useCallback(() => setStudentIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setStudentIdx(i => Math.min(students.length - 1, i + 1)), [students.length])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't navigate when user is typing in feedback
      if (feedbackOpen) { if (e.key === 'Escape') setFeedbackOpen(null); return }
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') { saveImprovement(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose, feedbackOpen])

  useEffect(() => {
    recognitionRef.current?.stop()
    setRecording(false)
    db.improvementNotes.where('[studentId+projectId]').equals([student.id, projectId]).first()
      .then(note => setImprovementText(note?.text ?? ''))
      .catch(() => setImprovementText(''))
  }, [student.id, projectId])

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = true
    r.interimResults = false
    r.onresult = (e: any) => {
      const transcript = Array.from({ length: e.results.length - e.resultIndex }, (_: any, i: number) =>
        e.results[e.resultIndex + i][0].transcript
      ).join(' ').trim()
      setImprovementText((prev: string) => prev ? prev + ' ' + transcript : transcript)
    }
    r.onend = () => setRecording(false)
    r.onerror = () => setRecording(false)
    recognitionRef.current = r
    r.start()
    setRecording(true)
  }

  async function saveImprovement() {
    await upsertImprovementNote(student.id, projectId, improvementText)
  }

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
      setMarkError(null)
    } catch (err) {
      setMarkError('Failed to save mark — please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function saveFeedback(criterion: RubricCriterion) {
    const mark = marks.find(m => m.studentId === student.id && m.criterionId === criterion.id)
    const score = mark?.score ?? 0
    try {
      await upsertMark(student.id, projectId, criterion.id, score, feedbackText)
      setMarkError(null)
    } catch (err) {
      setMarkError('Failed to save feedback — please try again.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { saveImprovement(); onClose() }}>
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
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className="text-base font-semibold text-gray-100 truncate">
              {student.firstName ? `${student.firstName} ${student.name}` : student.name}
            </p>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400/70">{studentIdx + 1} of {students.length}</span>
              {isComplete ? (
                <span className={cn('text-xs font-semibold flex items-center gap-1', gradeColor(pct!))}>
                  <CheckCircle2 size={11} />
                  {pct!.toFixed(1)}%
                </span>
              ) : (
                <span className="text-xs text-gray-400/70">
                  {completedCount}/{criteria.length} criteria
                </span>
              )}
            </div>
          </div>

          <button
            onClick={next}
            disabled={studentIdx === students.length - 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={() => { saveImprovement(); onClose() }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors ml-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-gray-800 shrink-0">
          <div
            className="h-full bg-gray-100 transition-all duration-300"
            style={{ width: criteria.length > 0 ? `${(completedCount / criteria.length) * 100}%` : '0%' }}
          />
        </div>

        {/* Inline error banner */}
        {markError && (
          <div className="shrink-0 mx-4 mt-3 px-3 py-2 rounded-lg bg-red-950/50 border border-red-800/60 flex items-center justify-between gap-2">
            <p className="text-xs text-red-300">{markError}</p>
            <button onClick={() => setMarkError(null)} className="text-red-400 hover:text-red-200"><X size={12} /></button>
          </div>
        )}

        {/* Criteria cards + improvement note */}
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
                    <p className="text-sm font-semibold text-gray-100">{c.name}</p>
                    {c.description && (
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{c.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {mark !== undefined ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={cn('text-sm font-bold tabular-nums', scorePct !== null ? gradeColor(scorePct) : 'text-gray-400')}>
                          {mark.score} / {c.maxMarks}
                        </span>
                        {scorePct !== null && (
                          <span className="text-xs text-gray-400/70">{scorePct.toFixed(0)}%</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400/50">not marked</span>
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
                            ? cn('border-gray-200/60 ring-1 ring-chiffon/30 scale-[1.03]', level.bgColor)
                            : cn('border-gray-700 hover:border-gray-200-muted', level.bgColor, 'hover:scale-[1.02]'),
                          isSaving && 'opacity-50 cursor-wait'
                        )}
                      >
                        <span className={cn('text-xs font-bold leading-tight', level.textColor)}>
                          {level.shortLabel.split(' ')[0]}
                        </span>
                        <span className="text-[11px] text-gray-400 tabular-nums font-medium">
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
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-100 placeholder-chiffon-muted/50 resize-none focus:outline-none focus:border-gray-200-muted"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveFeedback(c)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-100/90 text-gray-900 text-xs font-medium rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setFeedbackOpen(null)}
                        className="px-3 py-1 text-gray-400 hover:text-gray-100 text-xs rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="ml-auto text-[10px] text-gray-400/50 self-center">⌘↵ to save</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openFeedback(c)}
                    className={cn(
                      'mt-1 text-xs transition-colors',
                      hasFeedback
                        ? 'text-gray-100 hover:text-gray-100'
                        : 'text-gray-400/50 hover:text-gray-400'
                    )}
                  >
                    {hasFeedback ? `✦ ${mark!.feedback}` : '+ add feedback'}
                  </button>
                )}
              </div>
            )
          })}

          {/* Room for Improvement */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-100">Room for Improvement</p>
              <div className="flex items-center gap-2">
                <SnippetPicker
                  projectId={projectId}
                  snippets={snippets}
                  onInsert={text => setImprovementText(prev => prev ? prev + ' ' + text : text)}
                />
                <button
                  onClick={toggleRecording}
                  title={recording ? 'Stop recording' : 'Dictate'}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    recording
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600'
                  )}
                >
                  {recording ? <Square size={12} /> : <Mic size={12} />}
                  {recording ? 'Stop' : 'Dictate'}
                </button>
              </div>
            </div>
            <textarea
              value={improvementText}
              onChange={e => setImprovementText(e.target.value)}
              onBlur={saveImprovement}
              placeholder={recording ? 'Listening…' : 'Overall room for improvement…'}
              rows={3}
              className={cn(
                'w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500',
                recording ? 'border-red-500/50' : 'border-gray-700'
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-gray-400/50">← → navigate · Esc close</p>
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
                        ? 'w-4 h-1.5 bg-gray-100'
                        : done
                        ? 'w-1.5 h-1.5 bg-emerald-600 hover:bg-emerald-400'
                        : 'w-1.5 h-1.5 bg-gray-700 hover:bg-gray-700'
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
              <span className="text-[11px] text-gray-400/70 tabular-nums">{studentIdx + 1}/{students.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
