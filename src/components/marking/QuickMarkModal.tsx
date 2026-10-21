import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, CheckCircle2, Mic, Square, FileText, Upload, Mail, MailCheck, MailWarning, Minus, Plus, Users } from 'lucide-react'
import type { Student, RubricCriterion, Mark, RubricDescriptor, Snippet, Group, GroupMark } from '../../types'
import { upsertMark, deleteMark } from '../../db/hooks/useMarks'
import { upsertGroupMark, deleteGroupMark } from '../../db/hooks/useGroups'
import { upsertImprovementNote } from '../../db/hooks/useImprovementNotes'
import { useSubmission, useSubmissionAnnotation, saveSubmission, parseAnnotations } from '../../db/hooks/useSubmissions'
import { useProject } from '../../db/hooks/useProjects'
import { db } from '../../db/db'
import { LEVELS } from '../../utils/levels'
import { calcProjectPercentage, gradeColor } from '../../utils/marks'
import { cn } from '../../utils/cn'
import { SnippetPicker } from './SnippetPicker'
import { ReadAloudButton } from './ReadAloudButton'
import { LevelButton } from './LevelButton'
import { StudentAvatar } from './StudentAvatar'
import { addSnippet } from '../../db/hooks/useSnippets'
import { useIsTouch } from '../../utils/useIsTouch'
import { useDictation } from '../../utils/useDictation'
import { AnnotatorView } from '../annotator/AnnotatorView'
import { emailStudentMark, emailGroupMark } from '../../utils/emailStudent'
import { useProjectEmailLogs, emailStatus, formatEmailedAt } from '../../db/hooks/useEmailLogs'
import { useProjectImprovementNotes } from '../../db/hooks/useImprovementNotes'
import { RevealButton } from './RevealButton'

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
  /** Mark whole groups instead of `students`. Marks go through the group (copied to every member), and
   *  Room for Improvement and email go to every member. initialStudentIdx then indexes `groups`. */
  groups?: { group: Group; members: Student[] }[]
  groupMarks?: GroupMark[]
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
  groups,
  groupMarks = [],
}: Props) {
  const isTouch = useIsTouch()
  const count = groups ? groups.length : students.length
  const [studentIdx, setStudentIdx] = useState(Math.max(0, Math.min(initialStudentIdx, count - 1)))
  const [annotating, setAnnotating] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [savingSnippetFor, setSavingSnippetFor] = useState<string | null>(null) // criterionId
  const [snippetLabel, setSnippetLabel] = useState('')
  const [markError, setMarkError] = useState<string | null>(null)
  const [improvementText, setImprovementText] = useState('')
  const [savedImprovementText, setSavedImprovementText] = useState('')
  const { recording, toggle: toggleRecording, stop: stopRecording } =  // Room for Improvement
    useDictation(t => setImprovementText(prev => prev ? prev + ' ' + t : t))
  const { recording: feedbackRecording, toggle: toggleFeedbackRecording, stop: stopFeedbackRecording } =  // per-criterion feedback
    useDictation(t => setFeedbackText(prev => prev ? prev + ' ' + t : t))
  const criterionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Swipe tracking
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  // In group mode the "student" is undefined and everything goes through the current group.
  const group = groups?.[studentIdx]
  const student: Student | undefined = groups ? undefined : students[studentIdx]
  const itemId = group ? group.group.id : student!.id
  const itemName = group ? group.group.name
    : student!.firstName ? `${student!.firstName} ${student!.name}` : student!.name
  const marksOf = (i: number) => groups
    ? groupMarks.filter(m => m.groupId === groups[i].group.id)
    : marks.filter(m => m.studentId === students[i].id)
  const itemMarks = marksOf(studentIdx)
  const markFor = (criterionId: string) => itemMarks.find(m => m.criterionId === criterionId)
  const saveMark = (criterionId: string, score: number, feedback: string) => group
    ? upsertGroupMark(group.group.id, projectId, criterionId, score, feedback)
    : upsertMark(student!.id, projectId, criterionId, score, feedback)
  const removeMark = (criterionId: string) => group
    ? deleteGroupMark(group.group.id, projectId, criterionId)
    : deleteMark(student!.id, projectId, criterionId)

  const [emailing, setEmailing] = useState(false)
  const emailLogs = useProjectEmailLogs(projectId)
  const improvementNotes = useProjectImprovementNotes(projectId)
  const statusOf = (s: Student) => emailStatus(
    emailLogs.find(l => l.studentId === s.id),
    marks.filter(m => m.studentId === s.id),
    improvementNotes.find(n => n.studentId === s.id)?.text,
  )
  // A group counts as emailed once every member with an address has been, and as changed if any member's marks changed.
  const emailRecipients = group ? group.members.filter(s => s.email) : student!.email ? [student!] : []
  const memberStatuses = emailRecipients.map(statusOf)
  const email = memberStatuses.some(st => st.state === 'changed') ? memberStatuses.find(st => st.state === 'changed')!
    : memberStatuses.length > 0 && memberStatuses.every(st => st.state === 'sent') ? memberStatuses[0]
    : { state: 'none' as const }
  const emailTo = group
    ? `${emailRecipients[0]?.email}${emailRecipients.length > 1 ? `, CC ${emailRecipients.length - 1} more` : ''}`
    : student!.email
  const submission = useSubmission(student?.id, projectId)
  const submissionAnnotation = useSubmissionAnnotation(student?.id, projectId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const project = useProject(projectId)

  async function handleUploadSubmission(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!student || !file || file.type !== 'application/pdf') return
    const data = await file.arrayBuffer()
    const base = file.name.replace(/\.pdf$/i, '')
    const fullName = student.firstName ? `${student.firstName} ${student.name}` : student.name
    const filename = [base, fullName, project?.name].filter(Boolean).join('_') + '.pdf'
    await saveSubmission(student.id, projectId, data, filename)
    setAnnotating(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const prev = useCallback(() => setStudentIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setStudentIdx(i => Math.min(count - 1, i + 1)), [count])

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

  // Students whose Room for Improvement note this window edits: the student, or every group member.
  const noteStudentIds = group ? group.members.map(s => s.id) : [student!.id]

  // Load improvement note when student/group changes. A group shows its first member's note.
  useEffect(() => {
    stopRecording()
    db.improvementNotes.where('[studentId+projectId]').equals([noteStudentIds[0] ?? '', projectId]).first()
      .then(note => { setImprovementText(note?.text ?? ''); setSavedImprovementText(note?.text ?? '') })
      .catch(() => { setImprovementText(''); setSavedImprovementText('') })
  }, [itemId, projectId, stopRecording]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function saveImprovement() {
    if (improvementText === savedImprovementText) return
    // Like group marks, a member whose note was edited individually (it no longer matches) keeps it.
    for (const id of noteStudentIds) {
      const current = improvementNotes.find(n => n.studentId === id)?.text ?? ''
      if (!group || current === '' || current === savedImprovementText) await upsertImprovementNote(id, projectId, improvementText)
    }
    setSavedImprovementText(improvementText)
  }

  async function applyLevel(criterion: RubricCriterion, levelId: string) {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return
    const descriptor = descriptors.find(d => d.criterionId === criterion.id && d.level === levelId)
    const fraction = descriptor?.score ?? level.defaultScore
    const score = Math.round(criterion.maxMarks * fraction)
    const existingMark = markFor(criterion.id)
    setSaving(criterion.id)
    try {
      await saveMark(criterion.id, score, existingMark?.feedback ?? '')
      setMarkError(null)
    } catch {
      setMarkError('Failed to save mark — please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function adjustMark(criterion: RubricCriterion, delta: number) {
    const existingMark = markFor(criterion.id)
    const score = Math.min(criterion.maxMarks, Math.max(0, (existingMark?.score ?? 0) + delta))
    setSaving(criterion.id)
    try {
      await saveMark(criterion.id, score, existingMark?.feedback ?? '')
      setMarkError(null)
    } catch {
      setMarkError('Failed to save mark — please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function clearMark(criterion: RubricCriterion) {
    setSaving(criterion.id)
    try {
      await removeMark(criterion.id)
      setMarkError(null)
    } catch {
      setMarkError('Failed to clear mark — please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function saveFeedback(criterion: RubricCriterion) {
    const score = markFor(criterion.id)?.score ?? 0
    try {
      await saveMark(criterion.id, score, feedbackText)
      setMarkError(null)
    } catch {
      setMarkError('Failed to save feedback — please try again.')
    }
    setFeedbackOpen(null)
  }

  function openFeedback(criterion: RubricCriterion) {
    setFeedbackText(markFor(criterion.id)?.feedback ?? '')
    setFeedbackOpen(criterion.id)
  }

  const pct = criteria.length > 0 ? calcProjectPercentage(itemMarks, criteria) : null
  const isComplete = criteria.every(c => itemMarks.some(m => m.criterionId === c.id))
  const completedCount = criteria.filter(c => itemMarks.some(m => m.criterionId === c.id)).length
  const showDots = count <= 24

  // ─── Email to Outlook ──────────────────────────────────────────────────────
  async function sendEmail() {
    setEmailing(true)
    try {
      if (group) await emailGroupMark(group.group, group.members, projectId, criteria, marks)
      else await emailStudentMark(student!, projectId, criteria, marks)
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
          'relative bg-gray-900/95 backdrop-blur-xl border border-gray-700/70 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(139,92,246,0.08)] w-full z-10 flex flex-col overflow-hidden',
          isTouch ? 'max-w-3xl max-h-[95vh]' : 'max-w-3xl max-h-[90vh]'
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 border-b border-gray-700/60 shrink-0',
          isTouch ? 'px-3 py-3' : 'px-4 py-4'
        )}>
          <button onClick={prev} disabled={studentIdx === 0} className={navBtnClass}>
            <ChevronLeft size={isTouch ? 24 : 20} />
          </button>

          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            {group ? (
              <div
                className={cn('shrink-0 rounded-full flex items-center justify-center ring-2 ring-orange-500/40', isTouch ? 'w-14 h-14' : 'w-12 h-12')}
                style={{ background: group.group.color + '33', color: group.group.color }}
              >
                <Users size={isTouch ? 24 : 20} />
              </div>
            ) : (
              <StudentAvatar student={student!} className={cn('ring-2 ring-orange-500/40 shadow-[0_0_16px_rgba(139,92,246,0.25)]', isTouch ? 'w-14 h-14 text-lg' : 'w-12 h-12 text-base')} />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <p className={cn('font-semibold text-gray-100 truncate', isTouch ? 'text-lg' : 'text-base')}>
                  {itemName}
                </p>
                {student && <RevealButton student={student} />}
              </div>
              {group && (
                <p className={cn('text-gray-400 truncate', isTouch ? 'text-sm' : 'text-xs')}>
                  {group.members.map(s => s.firstName || s.name).join(', ')}
                </p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-gray-400/70', isTouch ? 'text-sm' : 'text-xs')}>
                  {studentIdx + 1} of {count}
                </span>
                {isComplete ? (
                  <span className={cn('font-semibold flex items-center gap-1 wm-private', gradeColor(pct!), isTouch ? 'text-sm' : 'text-xs')} data-wm-student={student?.id}>
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
          </div>

          <button onClick={next} disabled={studentIdx === count - 1} className={navBtnClass}>
            <ChevronRight size={isTouch ? 24 : 20} />
          </button>

          {/* Email student, or the whole group in one email */}
          {emailRecipients.length > 0 && (
            <button
              onClick={sendEmail}
              disabled={emailing}
              title={email.state === 'sent' ? `Emailed ${formatEmailedAt(email.emailedAt)} — click to email ${emailTo} again`
                : email.state === 'changed' ? `Marks changed since emailed ${formatEmailedAt(email.emailedAt)} — click to email ${emailTo} again`
                : `Email ${emailTo}`}
              className={cn('rounded-full flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50',
                isTouch ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs',
                email.state === 'changed'
                  ? 'bg-amber-950/60 border border-amber-800/50 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/60'
              )}
            >
              {email.state === 'sent' ? <MailCheck size={isTouch ? 16 : 13} /> : email.state === 'changed' ? <MailWarning size={isTouch ? 16 : 13} /> : <Mail size={isTouch ? 16 : 13} />}
              {emailing ? 'Opening…'
                : email.state === 'sent' ? `Emailed ${new Date(email.emailedAt).toLocaleDateString('en-CA', { day: 'numeric', month: 'short' })}`
                : email.state === 'changed' ? 'Changed — re-email'
                : 'Email'}
            </button>
          )}

          {/* Annotate / upload submission (submissions belong to each student, so not in group mode) */}
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUploadSubmission} />
          {group ? null : submission ? (
            <button
              onClick={() => setAnnotating(true)}
              title="Open annotated submission"
              className={cn('rounded-full flex items-center gap-1.5 font-medium transition-colors',
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
              className={cn('rounded-full flex items-center gap-1.5 font-medium transition-colors',
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
        <div className="h-1 bg-white/[0.04] shrink-0">
          <div
            className="h-full bg-orange-400 shadow-[0_0_10px_rgba(167,139,250,0.7)] transition-all duration-300"
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
        <div ref={scrollContainerRef} className={cn('overflow-y-auto flex flex-col wm-private', isTouch ? 'p-3 gap-3' : 'p-4 gap-3')} data-wm-student={student?.id}>
          {criteria.map((c) => {
            const mark = markFor(c.id)
            const isSaving = saving === c.id
            const isEditingFeedback = feedbackOpen === c.id
            const hasFeedback = !!(mark?.feedback)
            const scorePct = mark ? (mark.score / c.maxMarks) * 100 : null

            return (
              <div
                key={c.id}
                ref={el => { if (el) criterionRefs.current.set(c.id, el); else criterionRefs.current.delete(c.id) }}
                className={cn(
                  'bg-white/[0.025] border rounded-2xl transition-colors',
                  mark ? 'border-gray-700/80' : 'border-gray-700/40',
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
                  <div className="shrink-0 flex items-start gap-2">
                    {mark !== undefined ? (
                      <>
                        <button
                          onClick={() => adjustMark(c, -0.5)}
                          disabled={isSaving || mark.score <= 0}
                          title="Subtract half a point"
                          className="p-1 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus size={isTouch ? 16 : 14} />
                        </button>
                        {/* Fixed width (fits e.g. "99.5 / 100") so the −/+ buttons don't shift as the score changes */}
                        <div className="flex flex-col items-center gap-0.5" style={{ width: `${String(c.maxMarks).length * 2 + 5}ch` }}>
                          <span className={cn('font-light tabular-nums', scorePct !== null ? gradeColor(scorePct) : 'text-gray-400', isTouch ? 'text-xl' : 'text-lg')}>
                            {mark.score} / {c.maxMarks}
                          </span>
                          {scorePct !== null && (
                            <span className={cn('text-gray-400/70', isTouch ? 'text-sm' : 'text-xs')}>{scorePct.toFixed(0)}%</span>
                          )}
                        </div>
                        <button
                          onClick={() => adjustMark(c, 0.5)}
                          disabled={isSaving || mark.score >= c.maxMarks}
                          title="Add half a point"
                          className="p-1 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus size={isTouch ? 16 : 14} />
                        </button>
                        <button
                          onClick={() => clearMark(c)}
                          disabled={isSaving}
                          title="Clear this mark"
                          className={cn(
                            'p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/40 transition-colors',
                            isSaving && 'opacity-50 cursor-wait'
                          )}
                        >
                          <X size={isTouch ? 16 : 14} />
                        </button>
                      </>
                    ) : (
                      <span className={cn('text-gray-400/50 mt-0.5', isTouch ? 'text-sm' : 'text-xs')}>not marked</span>
                    )}
                  </div>
                </div>

                {/* Level buttons — bigger on touch */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {LEVELS.map(level => {
                    const descriptor = descriptors.find(d => d.criterionId === c.id && d.level === level.id)
                    const pts = Math.round(c.maxMarks * (descriptor?.score ?? level.defaultScore))
                    return (
                      <LevelButton
                        key={level.id}
                        level={level}
                        points={pts}
                        maxMarks={c.maxMarks}
                        active={mark !== undefined && mark.score === pts}
                        disabled={isSaving}
                        title={descriptor?.text || level.label}
                        large={isTouch}
                        onClick={() => applyLevel(c, level.id)}
                      />
                    )
                  })}
                </div>

                {/* Feedback */}
                {isEditingFeedback ? (
                  <div className="flex flex-col gap-2 mt-2">
                    {/* Snippets toolbar */}
                    <div className="flex items-center gap-2">
                      <SnippetPicker
                        projectId={projectId}
                        snippets={snippets}
                        onInsert={text => setFeedbackText(prev => prev ? prev + ' ' + text : text)}
                      />
                    </div>

                    <textarea
                      autoFocus
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { stopFeedbackRecording(); setFeedbackOpen(null) }
                        if (e.key === 'Enter' && e.metaKey) saveFeedback(c)
                      }}
                      rows={isTouch ? 4 : 2}
                      placeholder={feedbackRecording ? 'Listening…' : 'Feedback for this criterion…'}
                      className={cn(
                        'w-full bg-black/20 border rounded-xl px-3 py-3 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-gray-400',
                        feedbackRecording ? 'border-red-500/50' : 'border-gray-600'
                      )}
                    />

                    {/* Save as snippet — inline label prompt */}
                    {savingSnippetFor === c.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          autoFocus
                          value={snippetLabel}
                          onChange={e => setSnippetLabel(e.target.value)}
                          placeholder="Snippet label…"
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && snippetLabel.trim()) {
                              await addSnippet(projectId, snippetLabel.trim(), feedbackText.trim())
                              setSavingSnippetFor(null); setSnippetLabel('')
                            }
                            if (e.key === 'Escape') { setSavingSnippetFor(null); setSnippetLabel('') }
                          }}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                        />
                        <button
                          onClick={async () => {
                            if (snippetLabel.trim()) {
                              await addSnippet(projectId, snippetLabel.trim(), feedbackText.trim())
                              setSavingSnippetFor(null); setSnippetLabel('')
                            }
                          }}
                          disabled={!snippetLabel.trim()}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-full btn-accent disabled:opacity-40 transition-colors"
                        >
                          Save snippet
                        </button>
                        <button onClick={() => { setSavingSnippetFor(null); setSnippetLabel('') }}
                          className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => saveFeedback(c)}
                          className={cn(
                            'btn-accent font-medium rounded-full transition-colors',
                            isTouch ? 'px-5 py-3 text-sm' : 'px-3 py-1 text-xs'
                          )}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { stopFeedbackRecording(); setFeedbackOpen(null) }}
                          className={cn(
                            'text-gray-400 hover:text-gray-100 rounded-xl transition-colors',
                            isTouch ? 'px-4 py-3 text-sm' : 'px-3 py-1 text-xs'
                          )}
                        >
                          Cancel
                        </button>
                        <div className="ml-auto flex items-center gap-2">
                          {feedbackText.trim() && (
                            <button
                              onClick={() => { setSavingSnippetFor(c.id); setSnippetLabel('') }}
                              className={cn(
                                'text-gray-400 hover:text-gray-100 border border-gray-700 hover:border-gray-500 rounded-lg transition-colors',
                                isTouch ? 'px-3 py-2 text-sm' : 'px-2.5 py-1 text-xs'
                              )}
                            >
                              + Save as snippet
                            </button>
                          )}
                          <ReadAloudButton text={feedbackText} isTouch={isTouch} />
                          <button
                            onClick={toggleFeedbackRecording}
                            className={cn(
                              'flex items-center gap-1.5 rounded-lg font-medium transition-colors',
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
                    )}
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
          <div className={cn('bg-white/[0.025] border border-gray-700/80 rounded-2xl', isTouch ? 'p-4' : 'p-4')}>
            <div className="flex items-center justify-between mb-2">
              <p className={cn('font-semibold text-gray-100', isTouch ? 'text-base' : 'text-sm')}>Room for Improvement</p>
              <div className="flex items-center gap-2">
                <SnippetPicker
                  projectId={projectId}
                  snippets={snippets}
                  onInsert={text => setImprovementText(prev => prev ? prev + ' ' + text : text)}
                />
                <ReadAloudButton text={improvementText} isTouch={isTouch} />
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
                'w-full bg-black/20 border rounded-xl px-3 py-3 text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500',
                isTouch ? 'text-sm' : 'text-sm',
                recording ? 'border-red-500/50' : 'border-gray-700'
              )}
            />
            <button
              onClick={saveImprovement}
              disabled={improvementText === savedImprovementText}
              className={cn(
                'mt-2 w-full font-medium rounded-full transition-colors',
                isTouch ? 'py-3 text-sm' : 'py-1.5 text-xs',
                improvementText === savedImprovementText
                  ? 'bg-white/[0.04] text-gray-500 cursor-default'
                  : 'btn-accent'
              )}
            >
              {improvementText === savedImprovementText ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          'border-t border-gray-700/60 flex items-center shrink-0',
          isTouch ? 'px-4 py-4 justify-center gap-4' : 'px-4 py-3 justify-between'
        )}>
          {!isTouch && <p className="text-[11px] text-gray-400/50">← → navigate · Esc close</p>}
          {isTouch && (
            <p className="text-xs text-gray-400/50">Swipe left/right to change {group ? 'group' : 'student'}</p>
          )}
          {showDots ? (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {Array.from({ length: count }, (_, i) => {
                const sm = marksOf(i)
                const done = criteria.every(c => sm.some(m => m.criterionId === c.id))
                const s = groups ? undefined : students[i]
                return (
                  <button
                    key={i}
                    onClick={() => setStudentIdx(i)}
                    className={cn(
                      'rounded-full transition-all duration-200',
                      isTouch
                        ? i === studentIdx ? 'w-6 h-2.5 bg-orange-400 shadow-[0_0_8px_rgba(167,139,250,0.7)]' : done ? 'w-2.5 h-2.5 bg-emerald-500' : 'w-2.5 h-2.5 bg-gray-700'
                        : i === studentIdx ? 'w-4 h-1.5 bg-orange-400 shadow-[0_0_8px_rgba(167,139,250,0.7)]' : done ? 'w-1.5 h-1.5 bg-emerald-600' : 'w-1.5 h-1.5 bg-gray-700'
                    )}
                    title={groups ? groups[i].group.name : s!.firstName ? `${s!.firstName} ${s!.name}` : s!.name}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full transition-all"
                  style={{ width: `${count > 0 ? ((studentIdx + 1) / count) * 100 : 0}%` }}
                />
              </div>
              <span className={cn('tabular-nums text-gray-400/70', isTouch ? 'text-sm' : 'text-[11px]')}>
                {studentIdx + 1}/{count}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Full-screen annotator — shown when submission exists and annotate is clicked */}
    {annotating && submission && student && (
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
