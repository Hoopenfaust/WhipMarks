import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, CheckCircle2, Mic, Square, FileText, Upload, Mail } from 'lucide-react'
import type { Student, RubricCriterion, Mark, RubricDescriptor, Snippet } from '../../types'
import { upsertMark } from '../../db/hooks/useMarks'
import { upsertImprovementNote } from '../../db/hooks/useImprovementNotes'
import { useSubmission, useSubmissionAnnotation, saveSubmission, parseAnnotations } from '../../db/hooks/useSubmissions'
import { db } from '../../db/db'
import { LEVELS } from '../../utils/levels'
import { calcProjectPercentage, gradeColor } from '../../utils/marks'
import { cn } from '../../utils/cn'
import { SnippetPicker } from './SnippetPicker'
import { useIsTouch } from '../../utils/useIsTouch'
import { AnnotatorView } from '../annotator/AnnotatorView'

interface Props {
  students: Student[]
  criteria: RubricCriterion[]
  marks: Mark[]
  projectId: string
  descriptors: RubricDescriptor[]
  snippets: Snippet[]
  initialStudentIdx?: number
  initialCriterionIdx?: number
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
  initialCriterionIdx,
  onClose,
}: Props) {
  const isTouch = useIsTouch()
  const [studentIdx, setStudentIdx] = useState(Math.max(0, Math.min(initialStudentIdx, students.length - 1)))
  const [annotating, setAnnotating] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [markError, setMarkError] = useState<string | null>(null)
  const [improvementText, setImprovementText] = useState('')
  const [recording, setRecording] = useState(false)       // Room for Improvement
  const [feedbackRecording, setFeedbackRecording] = useState(false) // per-criterion feedback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feedbackRecognitionRef = useRef<any>(null)
  const criterionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Swipe tracking
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const student = students[studentIdx]
  const [emailing, setEmailing] = useState(false)
  const submission = useSubmission(student.id, projectId)
  const submissionAnnotation = useSubmissionAnnotation(student.id, projectId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUploadSubmission(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') return
    const data = await file.arrayBuffer()
    await saveSubmission(student.id, projectId, data, file.name)
    setAnnotating(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const prev = useCallback(() => setStudentIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setStudentIdx(i => Math.min(students.length - 1, i + 1)), [students.length])

  // Keyboard navigation (desktop)
  useEffect(() => {
    if (isTouch) return
    function handler(e: KeyboardEvent) {
      if (feedbackOpen) { if (e.key === 'Escape') setFeedbackOpen(null); return }
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') { saveImprovement(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose, feedbackOpen, isTouch])

  // Load improvement note when student changes
  useEffect(() => {
    recognitionRef.current?.stop()
    setRecording(false)
    db.improvementNotes.where('[studentId+projectId]').equals([student.id, projectId]).first()
      .then(note => setImprovementText(note?.text ?? ''))
      .catch(() => setImprovementText(''))
  }, [student.id, projectId])

  // Scroll to initial criterion on first open
  useEffect(() => {
    if (initialCriterionIdx === undefined) return
    const c = criteria[initialCriterionIdx]
    if (!c) return
    const el = criterionRefs.current.get(c.id)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    // Only swipe horizontally if it's more horizontal than vertical (not a scroll)
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      if (dx < 0) next()
      else prev()
    }
  }

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

  function toggleFeedbackRecording() {
    if (feedbackRecording) {
      feedbackRecognitionRef.current?.stop()
      setFeedbackRecording(false)
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
      setFeedbackText((prev: string) => prev ? prev + ' ' + transcript : transcript)
    }
    r.onend = () => setFeedbackRecording(false)
    r.onerror = () => setFeedbackRecording(false)
    feedbackRecognitionRef.current = r
    r.start()
    setFeedbackRecording(true)
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
    } catch {
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
    } catch {
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

  // ─── Email to Outlook ──────────────────────────────────────────────────────
  async function sendEmail() {
    if (!student.email) return
    setEmailing(true)
    try {
      const firstName = student.firstName || student.name.split(' ')[0]
      const studentMarksLocal = marks.filter(m => m.studentId === student.id)
      const pct = calcProjectPercentage(studentMarksLocal, criteria)
      const isComplete = criteria.every(c => studentMarksLocal.some(m => m.criterionId === c.id))

      // Build mark breakdown lines
      const lines = criteria.map(c => {
        const mark = studentMarksLocal.find(m => m.criterionId === c.id)
        const scoreLine = mark
          ? `${c.name.padEnd(30)} ${String(mark.score).padStart(3)} / ${c.maxMarks}  (${((mark.score / c.maxMarks) * 100).toFixed(0)}%)`
          : `${c.name.padEnd(30)} not marked`
        const feedback = mark?.feedback ? `   > ${mark.feedback}` : ''
        return [scoreLine, feedback].filter(Boolean).join('\n')
      }).join('\n')

      // Improvement note
      const improvement = await db.improvementNotes.where('[studentId+projectId]').equals([student.id, projectId]).first()

      const body = [
        `Dear ${firstName},`,
        '',
        'Please find your assessment feedback below.',
        '',
        '─'.repeat(50),
        isComplete ? `OVERALL MARK: ${pct.toFixed(1)}%` : 'MARKING IN PROGRESS',
        '─'.repeat(50),
        '',
        lines,
        '',
        ...(improvement?.text ? ['─'.repeat(50), 'ROOM FOR IMPROVEMENT:', improvement.text, ''] : []),
        ...(submission ? ['Your annotated submission is attached.', ''] : []),
        'Kind regards',
      ].join('\n')

      const subject = `Assessment Feedback: ${student.firstName ? `${student.firstName} ${student.name}` : student.name}`

      // Desktop (Tauri): open Outlook with attachment
      const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core')
        let attachmentPath: string | undefined

        if (submission) {
          // Export annotated PDF if annotations exist, otherwise use raw submission
          const pdfBytes = new Uint8Array(submission.data)
          const safeName = `${student.name.replace(/[^a-z0-9]/gi, '_')}_submission.pdf`
          attachmentPath = await invoke<string>('write_temp_file', { filename: safeName, data: Array.from(pdfBytes) })
        }

        await invoke('open_outlook', {
          to: student.email,
          subject,
          body,
          attachmentPath: attachmentPath ?? null,
        })
      } else {
        // PWA / iPad fallback: mailto link (no attachment)
        const encodedSubject = encodeURIComponent(subject)
        const encodedBody = encodeURIComponent(body)
        window.location.href = `mailto:${student.email}?subject=${encodedSubject}&body=${encodedBody}`
      }
    } finally {
      setEmailing(false)
    }
  }

  // Touch-friendly sizes
  const navBtnClass = isTouch
    ? 'p-3 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors'
    : 'p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors'

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => { saveImprovement(); onClose() }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={cn(
          'relative bg-gray-850 border border-gray-700 rounded-xl shadow-2xl w-full z-10 flex flex-col',
          isTouch ? 'max-w-2xl max-h-[95vh]' : 'max-w-2xl max-h-[90vh]'
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 border-b border-gray-800 shrink-0',
          isTouch ? 'px-3 py-3' : 'px-4 py-4'
        )}>
          <button onClick={prev} disabled={studentIdx === 0} className={navBtnClass}>
            <ChevronLeft size={isTouch ? 24 : 20} />
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className={cn('font-semibold text-gray-100 truncate', isTouch ? 'text-lg' : 'text-base')}>
              {student.firstName ? `${student.firstName} ${student.name}` : student.name}
            </p>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className={cn('text-gray-400/70', isTouch ? 'text-sm' : 'text-xs')}>
                {studentIdx + 1} of {students.length}
              </span>
              {isComplete ? (
                <span className={cn('font-semibold flex items-center gap-1', gradeColor(pct!), isTouch ? 'text-sm' : 'text-xs')}>
                  <CheckCircle2 size={isTouch ? 14 : 11} />
                  {pct!.toFixed(1)}%
                </span>
              ) : (
                <span className={cn('text-gray-400/70', isTouch ? 'text-sm' : 'text-xs')}>
                  {completedCount}/{criteria.length} criteria
                </span>
              )}
            </div>
          </div>

          <button onClick={next} disabled={studentIdx === students.length - 1} className={navBtnClass}>
            <ChevronRight size={isTouch ? 24 : 20} />
          </button>

          {/* Email student */}
          {student.email && (
            <button
              onClick={sendEmail}
              disabled={emailing}
              title={`Email ${student.email}`}
              className={cn('rounded-xl flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50',
                isTouch ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs',
                'bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/60'
              )}
            >
              <Mail size={isTouch ? 16 : 13} />
              {emailing ? 'Opening…' : 'Email'}
            </button>
          )}

          {/* Annotate / upload submission */}
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUploadSubmission} />
          {submission ? (
            <button
              onClick={() => setAnnotating(true)}
              title="Open annotated submission"
              className={cn('rounded-xl flex items-center gap-1.5 font-medium transition-colors',
                isTouch ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs',
                'bg-blue-950/60 border border-blue-800/50 text-blue-300 hover:bg-blue-900/60'
              )}
            >
              <FileText size={isTouch ? 16 : 13} />
              Annotate
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload student submission PDF"
              className={cn('rounded-xl flex items-center gap-1.5 font-medium transition-colors',
                isTouch ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs',
                'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600'
              )}
            >
              <Upload size={isTouch ? 16 : 13} />
              Upload PDF
            </button>
          )}

          <button
            onClick={() => { saveImprovement(); onClose() }}
            className={cn('rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors ml-1',
              isTouch ? 'p-3' : 'p-1.5')}
          >
            <X size={isTouch ? 22 : 16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800 shrink-0">
          <div
            className="h-full bg-orange-500/60 transition-all duration-300"
            style={{ width: criteria.length > 0 ? `${(completedCount / criteria.length) * 100}%` : '0%' }}
          />
        </div>

        {markError && (
          <div className="shrink-0 mx-4 mt-3 px-3 py-2 rounded-lg bg-red-950/50 border border-red-800/60 flex items-center justify-between gap-2">
            <p className="text-xs text-red-300">{markError}</p>
            <button onClick={() => setMarkError(null)} className="text-red-400 hover:text-red-200"><X size={12} /></button>
          </div>
        )}

        {/* Criteria cards */}
        <div ref={scrollContainerRef} className={cn('overflow-y-auto flex flex-col', isTouch ? 'p-3 gap-3' : 'p-4 gap-3')}>
          {criteria.map((c, _ci) => {
            const mark = marks.find(m => m.studentId === student.id && m.criterionId === c.id)
            const isSaving = saving === c.id
            const isEditingFeedback = feedbackOpen === c.id
            const hasFeedback = !!(mark?.feedback)
            const scorePct = mark ? (mark.score / c.maxMarks) * 100 : null

            return (
              <div
                key={c.id}
                ref={el => { if (el) criterionRefs.current.set(c.id, el); else criterionRefs.current.delete(c.id) }}
                className={cn(
                  'bg-gray-900 border rounded-xl transition-colors',
                  mark ? 'border-gray-700' : 'border-gray-800',
                  isTouch ? 'p-4' : 'p-4'
                )}
              >
                {/* Criterion header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className={cn('font-semibold text-gray-100', isTouch ? 'text-base' : 'text-sm')}>{c.name}</p>
                    {c.description && (
                      <p className={cn('text-gray-400 mt-0.5 leading-snug', isTouch ? 'text-sm' : 'text-xs')}>{c.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {mark !== undefined ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={cn('font-bold tabular-nums', scorePct !== null ? gradeColor(scorePct) : 'text-gray-400', isTouch ? 'text-base' : 'text-sm')}>
                          {mark.score} / {c.maxMarks}
                        </span>
                        {scorePct !== null && (
                          <span className={cn('text-gray-400/70', isTouch ? 'text-sm' : 'text-xs')}>{scorePct.toFixed(0)}%</span>
                        )}
                      </div>
                    ) : (
                      <span className={cn('text-gray-400/50', isTouch ? 'text-sm' : 'text-xs')}>not marked</span>
                    )}
                  </div>
                </div>

                {/* Level buttons — bigger on touch */}
                <div className="grid grid-cols-4 gap-2 mb-3">
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
                          'flex flex-col items-center gap-1 px-2 rounded-xl border text-center transition-all duration-100',
                          isTouch ? 'py-4' : 'py-2.5',
                          isActive
                            ? cn('border-gray-200/60 ring-1 ring-white/20 scale-[1.03]', level.bgColor)
                            : cn('border-gray-700 hover:border-gray-500', level.bgColor),
                          isSaving && 'opacity-50 cursor-wait'
                        )}
                      >
                        <span className={cn('font-bold leading-tight', level.textColor, isTouch ? 'text-sm' : 'text-xs')}>
                          {level.shortLabel.split(' ')[0]}
                        </span>
                        <span className={cn('text-gray-400 tabular-nums font-medium', isTouch ? 'text-sm' : 'text-[11px]')}>
                          {pts}/{c.maxMarks}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Feedback */}
                {isEditingFeedback ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <textarea
                      autoFocus
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { feedbackRecognitionRef.current?.stop(); setFeedbackRecording(false); setFeedbackOpen(null) }
                        if (e.key === 'Enter' && e.metaKey) saveFeedback(c)
                      }}
                      rows={isTouch ? 4 : 2}
                      placeholder={feedbackRecording ? 'Listening…' : 'Feedback for this criterion…'}
                      className={cn(
                        'w-full bg-gray-800 border rounded-xl px-3 py-3 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-gray-400',
                        feedbackRecording ? 'border-red-500/50' : 'border-gray-600'
                      )}
                    />
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => saveFeedback(c)}
                        className={cn(
                          'bg-gray-100 hover:bg-gray-100/90 text-gray-900 font-medium rounded-xl transition-colors',
                          isTouch ? 'px-5 py-3 text-sm' : 'px-3 py-1 text-xs'
                        )}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { feedbackRecognitionRef.current?.stop(); setFeedbackRecording(false); setFeedbackOpen(null) }}
                        className={cn(
                          'text-gray-400 hover:text-gray-100 rounded-xl transition-colors',
                          isTouch ? 'px-4 py-3 text-sm' : 'px-3 py-1 text-xs'
                        )}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={toggleFeedbackRecording}
                        className={cn(
                          'ml-auto flex items-center gap-1.5 rounded-lg font-medium transition-colors',
                          isTouch ? 'px-3 py-2 text-sm' : 'px-2.5 py-1 text-xs',
                          feedbackRecording
                            ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600'
                        )}
                      >
                        {feedbackRecording ? <Square size={isTouch ? 14 : 12} /> : <Mic size={isTouch ? 14 : 12} />}
                        {feedbackRecording ? 'Stop' : 'Dictate'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openFeedback(c)}
                    className={cn(
                      'mt-1 text-left w-full transition-colors rounded-lg',
                      isTouch ? 'py-2 px-1 text-sm' : 'text-xs',
                      hasFeedback ? 'text-gray-300 hover:text-gray-100' : 'text-gray-400/50 hover:text-gray-400'
                    )}
                  >
                    {hasFeedback ? `✦ ${mark!.feedback}` : '+ add feedback'}
                  </button>
                )}
              </div>
            )
          })}

          {/* Room for Improvement */}
          <div className={cn('bg-gray-900 border border-gray-700 rounded-xl', isTouch ? 'p-4' : 'p-4')}>
            <div className="flex items-center justify-between mb-2">
              <p className={cn('font-semibold text-gray-100', isTouch ? 'text-base' : 'text-sm')}>Room for Improvement</p>
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
                    'flex items-center gap-1.5 rounded-lg font-medium transition-colors',
                    isTouch ? 'px-3 py-2 text-sm' : 'px-2.5 py-1 text-xs',
                    recording
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600'
                  )}
                >
                  {recording ? <Square size={isTouch ? 14 : 12} /> : <Mic size={isTouch ? 14 : 12} />}
                  {recording ? 'Stop' : 'Dictate'}
                </button>
              </div>
            </div>
            <textarea
              value={improvementText}
              onChange={e => setImprovementText(e.target.value)}
              onBlur={saveImprovement}
              placeholder={recording ? 'Listening…' : 'Overall room for improvement…'}
              rows={isTouch ? 4 : 3}
              className={cn(
                'w-full bg-gray-800 border rounded-xl px-3 py-3 text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500',
                isTouch ? 'text-sm' : 'text-sm',
                recording ? 'border-red-500/50' : 'border-gray-700'
              )}
            />
            <button
              onClick={saveImprovement}
              className={cn(
                'mt-2 w-full font-medium rounded-xl transition-colors',
                isTouch ? 'py-3 text-sm' : 'py-1.5 text-xs',
                'bg-gray-100 hover:bg-gray-100/90 text-gray-900'
              )}
            >
              Save
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          'border-t border-gray-800 flex items-center shrink-0',
          isTouch ? 'px-4 py-4 justify-center' : 'px-4 py-3 justify-between'
        )}>
          {!isTouch && <p className="text-[11px] text-gray-400/50">← → navigate · Esc close</p>}
          {isTouch && (
            <p className="text-xs text-gray-400/50">Swipe left/right to change student</p>
          )}
          {showDots ? (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {students.map((_, i) => {
                const sm = marks.filter(m => m.studentId === students[i].id)
                const done = criteria.every(c => sm.some(m => m.criterionId === c.id))
                return (
                  <button
                    key={i}
                    onClick={() => setStudentIdx(i)}
                    className={cn(
                      'rounded-full transition-all duration-200',
                      isTouch
                        ? i === studentIdx ? 'w-6 h-2.5 bg-gray-100' : done ? 'w-2.5 h-2.5 bg-emerald-500' : 'w-2.5 h-2.5 bg-gray-700'
                        : i === studentIdx ? 'w-4 h-1.5 bg-gray-100' : done ? 'w-1.5 h-1.5 bg-emerald-600' : 'w-1.5 h-1.5 bg-gray-700'
                    )}
                    title={students[i].firstName ? `${students[i].firstName} ${students[i].name}` : students[i].name}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500/60 rounded-full transition-all"
                  style={{ width: `${students.length > 0 ? ((studentIdx + 1) / students.length) * 100 : 0}%` }}
                />
              </div>
              <span className={cn('tabular-nums text-gray-400/70', isTouch ? 'text-sm' : 'text-[11px]')}>
                {studentIdx + 1}/{students.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Full-screen annotator — shown when submission exists and annotate is clicked */}
    {annotating && submission && (
      <AnnotatorView
        student={student}
        projectId={projectId}
        pdfData={submission.data}
        filename={submission.filename}
        initialAnnotations={parseAnnotations(submissionAnnotation)}
        onClose={() => setAnnotating(false)}
      />
    )}
    </>
  )
}
