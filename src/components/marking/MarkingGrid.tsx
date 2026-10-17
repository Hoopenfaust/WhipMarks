import { useState, useRef, useEffect } from 'react'
import { Mic, Square, FileDown, Mail, MailCheck, MailWarning, Zap, X, Minus, Plus, Users } from 'lucide-react'
import type { Student, RubricCriterion, Mark, RubricDescriptor, Snippet, Group } from '../../types'
import { upsertMark, deleteMark } from '../../db/hooks/useMarks'
import { useProject } from '../../db/hooks/useProjects'
import { useGroups, useGroupMembers, useGroupMarks } from '../../db/hooks/useGroups'
import { calcProjectPercentage, gradeColor } from '../../utils/marks'
import { LEVELS } from '../../utils/levels'
import { cn } from '../../utils/cn'
import { QuickMarkModal } from './QuickMarkModal'
import { StudentAvatar } from './StudentAvatar'
import { SnippetPicker } from './SnippetPicker'
import { ReadAloudButton } from './ReadAloudButton'
import { LevelButton } from './LevelButton'
import { useIsTouch } from '../../utils/useIsTouch'
import { useDictation } from '../../utils/useDictation'
import { emailStudentMark, emailGroupMark } from '../../utils/emailStudent'
import { useProjectEmailLogs, emailStatus, formatEmailedAt } from '../../db/hooks/useEmailLogs'
import { useProjectImprovementNotes } from '../../db/hooks/useImprovementNotes'


interface CellPopoverProps {
  title: string
  criterion: RubricCriterion
  mark: Pick<Mark, 'score' | 'feedback'> | undefined
  criterionDescriptors: RubricDescriptor[]
  projectId: string
  snippets: Snippet[]
  onSave: (score: number, feedback: string) => Promise<void>
  onClear: () => Promise<void>
  onClose: () => void
  onNavigate: (dir: 'next' | 'prev') => void
}

function CellPopover({ title, criterion, mark, criterionDescriptors, projectId, snippets, onSave, onClear, onClose, onNavigate }: CellPopoverProps) {
  const [score, setScore] = useState(mark?.score?.toString() ?? '')
  const [feedback, setFeedback] = useState(mark?.feedback ?? '')
  const { recording, toggle: toggleRecording, stop: stopRecording } = useDictation(t => setFeedback(prev => prev ? prev + ' ' + t : t))
  const [saveError, setSaveError] = useState<string | null>(null)
  const scoreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scoreRef.current?.focus()
    scoreRef.current?.select()
  }, [])

  async function save() {
    stopRecording()
    const num = parseFloat(score)
    if (!isNaN(num)) {
      try {
        await onSave(Math.min(criterion.maxMarks, Math.max(0, num)), feedback)
        setSaveError(null)
      } catch {
        setSaveError('Failed to save — please try again.')
        return
      }
    }
    onClose()
  }

  async function clearMark() {
    stopRecording()
    try {
      await onClear()
      setSaveError(null)
    } catch {
      setSaveError('Failed to clear mark — please try again.')
      return
    }
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save(); onNavigate('next') }
    if (e.key === 'Escape') { onClose() }
    if (e.key === 'Tab') {
      e.preventDefault()
      save()
      onNavigate(e.shiftKey ? 'prev' : 'next')
    }
  }

  // +/- buttons save straight away, so the change sticks even if the popover is closed without Save.
  async function adjustScore(delta: number) {
    const current = parseFloat(score)
    const next = Math.min(criterion.maxMarks, Math.max(0, (isNaN(current) ? 0 : current) + delta))
    setScore(next.toString())
    try {
      await onSave(next, feedback)
      setSaveError(null)
    } catch {
      setSaveError('Failed to save — please try again.')
    }
  }

  function applyLevel(levelId: string) {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return
    const descriptor = criterionDescriptors.find(d => d.level === levelId)
    const fraction = descriptor?.score ?? level.defaultScore
    const pts = Math.round(criterion.maxMarks * fraction)
    setScore(pts.toString())
    scoreRef.current?.focus()
  }

  return (
    <div className="absolute z-50 bg-gray-900/95 backdrop-blur-xl border border-gray-700/70 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.08)] p-5 w-[36rem] top-full left-0 mt-1" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-100">{title}</p>
        <p className="text-xs text-gray-400">{criterion.name}</p>
        {criterion.description && <p className="text-xs text-gray-400/70 mt-0.5">{criterion.description}</p>}
      </div>

      {/* Level quick-pick */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {LEVELS.map(level => {
          const descriptor = criterionDescriptors.find(d => d.level === level.id)
          const pts = Math.round(criterion.maxMarks * (descriptor?.score ?? level.defaultScore))
          return (
            <LevelButton
              key={level.id}
              level={level}
              points={pts}
              maxMarks={criterion.maxMarks}
              active={score !== '' && parseFloat(score) === pts}
              title={descriptor?.text || level.label}
              layout="row"
              onClick={() => applyLevel(level.id)}
            />
          )
        })}
      </div>

      {/* Score row */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => adjustScore(-0.5)}
          disabled={score === '' || parseFloat(score) <= 0}
          title="Subtract half a point"
          className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Minus size={14} />
        </button>
        <input
          ref={scoreRef}
          type="number"
          min="0"
          max={criterion.maxMarks}
          step="0.5"
          value={score}
          onChange={e => setScore(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0"
          className="w-24 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-200"
        />
        <button
          onClick={() => adjustScore(0.5)}
          disabled={parseFloat(score) >= criterion.maxMarks}
          title="Add half a point"
          className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
        </button>
        <span className="text-sm text-gray-400">/ {criterion.maxMarks} marks</span>
      </div>

      {/* Feedback + voice */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-400">Feedback</label>
          <div className="flex items-center gap-2">
            <SnippetPicker
              projectId={projectId}
              snippets={snippets}
              onInsert={text => setFeedback(prev => prev ? prev + ' ' + text : text)}
            />
          <ReadAloudButton text={feedback} />
          <button
            onClick={toggleRecording}
            title={recording ? 'Stop recording' : 'Dictate feedback'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              recording
                ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-200-muted'
            )}
          >
            {recording ? <Square size={12} /> : <Mic size={12} />}
            {recording ? 'Stop' : 'Dictate'}
          </button>
          </div>
        </div>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder={recording ? 'Listening…' : 'Feedback (optional)'}
          rows={5}
          className={cn(
            'w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-chiffon-muted/50 resize-none focus:outline-none focus:border-gray-200-muted',
            recording ? 'border-red-500/50' : 'border-gray-700'
          )}
        />
      </div>

      {saveError && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 mb-2">{saveError}</p>
      )}

      <div className="flex gap-2">
        {mark !== undefined && (
          <button
            onClick={clearMark}
            title="Clear this mark"
            className="flex items-center gap-1 text-xs text-red-400/80 hover:text-red-400 py-1.5 px-2"
          >
            <X size={13} />
            Clear
          </button>
        )}
        <button onClick={onClose} className="flex-1 text-xs text-gray-400 hover:text-gray-100 py-1.5">Cancel</button>
        <button
          onClick={() => { save(); onNavigate('next') }}
          className="flex-1 text-sm font-medium py-1.5 rounded-full transition-colors"
          style={{ background: '#8b5cf6', color: '#ffffff', boxShadow: '0 0 18px rgba(139,92,246,0.35)' }}
        >
          Save
        </button>
      </div>
      <p className="text-center text-[10px] text-gray-400/70 mt-2">Tab → next · Shift+Tab ← prev · Esc close</p>
    </div>
  )
}

interface Props {
  students: Student[]
  criteria: RubricCriterion[]
  marks: Mark[]
  projectId: string
  descriptors?: RubricDescriptor[]
  snippets?: Snippet[]
  onExportStudent?: (student: Student) => void
  /** Open Quick Mark on this student once they've loaded (e.g. arriving from a student card). */
  openStudentId?: string | null
  onOpenedStudent?: () => void
}

export function MarkingGrid({ students, criteria, marks, projectId, descriptors = [], snippets = [], onExportStudent, openStudentId, onOpenedStudent }: Props) {
  const isTouch = useIsTouch()
  const [activeCell, setActiveCell] = useState<{ rowKey: string; criterionIdx: number } | null>(null)
  const [quickMarkIdx, setQuickMarkIdx] = useState<number | null>(null)
  const [emailingId, setEmailingId] = useState<string | null>(null)
  const [quickMarkCriterionIdx, setQuickMarkCriterionIdx] = useState<number | undefined>(undefined)
  // Students who weren't fully marked when "Unmarked only" was switched on. A snapshot, so a student
  // you finish stays in the list (and in Quick Mark) until you toggle it again, instead of vanishing mid-mark.
  const [unmarkedIds, setUnmarkedIds] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (!openStudentId || criteria.length === 0) return
    const idx = students.findIndex(s => s.id === openStudentId)
    if (idx === -1) return
    setQuickMarkCriterionIdx(undefined)
    setQuickMarkIdx(idx)
    onOpenedStudent?.()
  }, [openStudentId, students, criteria.length, onOpenedStudent])
  const emailLogs = useProjectEmailLogs(projectId)
  const improvementNotes = useProjectImprovementNotes(projectId)
  const statusFor = (studentId: string) => emailStatus(
    emailLogs.find(l => l.studentId === studentId),
    marks.filter(m => m.studentId === studentId),
    improvementNotes.find(n => n.studentId === studentId)?.text,
  )
  const emailedCount = students.filter(s => statusFor(s.id).state !== 'none').length
  const markedCount = students.filter(s =>
    criteria.every(c => marks.some(m => m.studentId === s.id && m.criterionId === c.id))
  ).length
  const rows = unmarkedIds ? students.filter(s => unmarkedIds.has(s.id)) : students

  // Group projects can be marked a group at a time: a group row writes to all its members, and each
  // member row below it can still be adjusted individually.
  const project = useProject(projectId)
  const groups = useGroups(project?.isGroupProject ? projectId : undefined)
  const groupMembers = useGroupMembers(groups.map(g => g.id))
  const groupMarks = useGroupMarks(projectId)
  const [byGroup, setByGroup] = useState(true)
  const groupMode = byGroup && groups.length > 0
  const groupOf = (studentId: string) => {
    const gm = groupMembers.find(m => m.studentId === studentId)
    return gm && groups.find(g => g.id === gm.groupId)
  }
  type Row =
    | { kind: 'group'; key: string; group: Group; size: number }
    | { kind: 'student'; key: string; student: Student; group?: Group }
  const studentRow = (s: Student, group?: Group): Row => ({ kind: 'student', key: 's:' + s.id, student: s, group })
  const displayRows: Row[] = groupMode
    ? [
        ...groups.flatMap(g => {
          const members = rows.filter(s => groupOf(s.id)?.id === g.id)
          if (members.length === 0) return []
          const size = groupMembers.filter(m => m.groupId === g.id).length
          return [{ kind: 'group' as const, key: 'g:' + g.id, group: g, size }, ...members.map(s => studentRow(s, g))]
        }),
        ...rows.filter(s => !groupOf(s.id)).map(s => studentRow(s)),
      ]
    : rows.map(s => studentRow(s))

  // Group Quick Mark steps through every group that has members, each with all its members
  // (including ones hidden by "Unmarked only").
  const [groupQuickMark, setGroupQuickMark] = useState<{ idx: number; criterionIdx?: number } | null>(null)
  const quickMarkGroups = groups
    .map(g => ({ group: g, members: students.filter(s => groupOf(s.id)?.id === g.id) }))
    .filter(x => x.members.length > 0)
  function openGroupQuickMark(groupId: string, criterionIdx?: number) {
    setActiveCell(null)
    setGroupQuickMark({ idx: Math.max(0, quickMarkGroups.findIndex(x => x.group.id === groupId)), criterionIdx })
  }

  function getGroupMark(groupId: string, criterionId: string) {
    return groupMarks.find(m => m.groupId === groupId && m.criterionId === criterionId)
  }

  function toggleUnmarkedOnly() {
    setActiveCell(null)
    setUnmarkedIds(unmarkedIds ? null : new Set(students
      .filter(s => !criteria.every(c => marks.some(m => m.studentId === s.id && m.criterionId === c.id)))
      .map(s => s.id)))
  }

  function getMark(studentId: string, criterionId: string) {
    return marks.find(m => m.studentId === studentId && m.criterionId === criterionId)
  }

  function getCriterionDescriptors(criterionId: string) {
    return descriptors.filter(d => d.criterionId === criterionId)
  }

  function navigate(dir: 'next' | 'prev') {
    if (!activeCell) return
    const { rowKey, criterionIdx } = activeCell
    // Tab stays among rows of the same kind, so marking groups moves group to group.
    const kind = displayRows.find(r => r.key === rowKey)?.kind
    const navRows = displayRows.filter(r => r.kind === kind)
    const rowIdx = navRows.findIndex(r => r.key === rowKey)
    if (rowIdx === -1) return
    const totalCells = navRows.length * criteria.length
    const flat = rowIdx * criteria.length + criterionIdx
    const next = dir === 'next' ? (flat + 1) % totalCells : (flat - 1 + totalCells) % totalCells
    setActiveCell({ rowKey: navRows[Math.floor(next / criteria.length)].key, criterionIdx: next % criteria.length })
  }

  if (criteria.length === 0) {
    return <p className="text-sm text-gray-400/70 p-6">Add criteria in the Rubric tab first.</p>
  }
  if (students.length === 0) {
    return <p className="text-sm text-gray-400/70 p-6">No students in this class yet.</p>
  }

  return (
    <div className="flex flex-col h-full">
    {/* Toolbar */}
    <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-700 shrink-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-100">Marking Grid</p>
        <p className="text-xs text-gray-400">{students.length} students · {criteria.length} criteria · {markedCount} / {students.length} marked · {emailedCount} / {students.length} emailed</p>
      </div>
      <button
        onClick={toggleUnmarkedOnly}
        title={unmarkedIds ? 'Show all students' : 'Show only students who still need marks'}
        className={cn(
          'rounded-full border font-medium transition-colors',
          isTouch ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm',
          unmarkedIds ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600'
        )}
      >
        Unmarked only{unmarkedIds && ` (${rows.length})`}
      </button>
      {groups.length > 0 && (
        <button
          onClick={() => { setActiveCell(null); setByGroup(!byGroup) }}
          title={groupMode ? 'Show students only' : 'Mark each group at once, with members listed underneath for individual adjustments'}
          className={cn(
            'flex items-center gap-2 rounded-full border font-medium transition-colors',
            isTouch ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm',
            groupMode ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600'
          )}
        >
          <Users size={isTouch ? 18 : 15} />
          By group
        </button>
      )}
      <button
        onClick={() => { setQuickMarkCriterionIdx(undefined); setQuickMarkIdx(0) }}
        disabled={rows.length === 0}
        data-tutorial="quick-mark-btn"
        className={cn(
          'flex items-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
          isTouch ? 'px-6 py-3.5 text-base' : 'px-5 py-2.5 text-sm'
        )}
        style={{ background: '#8b5cf6', color: '#ffffff', boxShadow: '0 0 18px rgba(139,92,246,0.35)' }}
      >
        <Zap size={isTouch ? 18 : 15} />
        Quick Mark
      </button>
    </div>

    <div className="overflow-auto flex-1 mx-4 mb-4 mt-3 rounded-xl border border-gray-700 shadow-md shadow-black/30 wm-private">
      <table className="marking-table border-collapse min-w-full text-sm">
        <thead>
          <tr>
            <th className="bg-gray-850 border-b border-r border-gray-700 px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap min-w-40">
              Student
            </th>
            {criteria.map(c => (
              <th key={c.id} className="bg-gray-850 border-b border-r border-gray-700 px-4 py-3 text-left whitespace-nowrap">
                <div className="text-xs font-semibold text-gray-100">{c.name}</div>
                <div className="text-xs text-gray-400/70">/{c.maxMarks} · {Math.round(c.weight * 100)}%</div>
              </th>
            ))}
            <th className="bg-gray-850 border-b border-gray-700 px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">
              Total %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={criteria.length + 2} className="px-4 py-6 text-center text-sm text-gray-400">
                Everyone has been marked.
              </td>
            </tr>
          )}
          {displayRows.map((row, ri) => {
            if (row.kind === 'group') {
              const g = row.group
              const gMarks = groupMarks.filter(m => m.groupId === g.id)
              const gMarkedCount = criteria.filter(c => gMarks.some(m => m.criterionId === c.id)).length
              const gPct = calcProjectPercentage(gMarks, criteria)
              // Every member, even ones hidden by "Unmarked only", so the whole group gets the email.
              const gStudents = students.filter(s => groupOf(s.id)?.id === g.id)
              const gEmailable = gStudents.filter(s => s.email)
              const gMissing = gStudents.length - gEmailable.length
              const gStates = gEmailable.map(s => statusFor(s.id).state)
              const gEmail = gStates.length > 0 && gStates.every(st => st === 'sent') ? 'sent'
                : gStates.some(st => st === 'changed') ? 'changed' : 'none'
              return (
                <tr key={row.key} className="bg-gray-800/60">
                  <td
                    className={cn('border-b border-r border-gray-700 whitespace-nowrap', isTouch ? 'px-4 py-5 text-base' : 'px-4 py-2.5 text-sm')}
                    style={{ boxShadow: `inset 4px 0 0 ${g.color}` }}
                  >
                    <div className="flex items-center gap-2">
                      <Users size={isTouch ? 18 : 16} style={{ color: g.color }} />
                      <button
                        onClick={() => openGroupQuickMark(g.id)}
                        title="Quick Mark this group"
                        className="font-semibold text-gray-100 hover:underline underline-offset-2 text-left"
                      >
                        {g.name}
                      </button>
                      <span className="text-xs text-gray-400">{row.size} {row.size === 1 ? 'student' : 'students'}</span>
                      <button
                        onClick={async () => {
                          setEmailingId(g.id)
                          try { await emailGroupMark(g, gStudents, projectId, criteria, marks) } finally { setEmailingId(null) }
                        }}
                        disabled={gEmailable.length === 0 || emailingId !== null}
                        title={gEmailable.length === 0 ? 'Add email addresses for these students on the class page to email the group'
                          : `${gEmail === 'sent' ? 'Group emailed — click to email again: ' : gEmail === 'changed' ? 'Marks changed since emailed — click to email again: ' : ''}`
                            + `one email to ${gEmailable[0].email}${gEmailable.length > 1 ? `, CC ${gEmailable.length - 1} more` : ''}, with every member's marking sheet`
                            + (gMissing > 0 ? ` (${gMissing} without an email address left out)` : '')}
                        className={cn(
                          'p-1.5 rounded-lg hover:text-indigo-300 hover:bg-indigo-950/50 transition-all hover:scale-110 disabled:hover:scale-100 disabled:hover:bg-transparent disabled:cursor-not-allowed',
                          gEmail === 'sent' ? 'text-emerald-600 dark:text-emerald-400'
                            : gEmail === 'changed' ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-500 disabled:hover:text-gray-500',
                          emailingId === g.id ? 'animate-pulse' : gEmailable.length === 0 && 'opacity-40'
                        )}
                      >
                        {gEmail === 'sent' ? <MailCheck size={16} /> : gEmail === 'changed' ? <MailWarning size={16} /> : <Mail size={16} />}
                      </button>
                    </div>
                  </td>
                  {criteria.map((c, ci) => {
                    const gm = getGroupMark(g.id, c.id)
                    const pctCell = gm ? (gm.score / c.maxMarks) * 100 : null
                    return (
                      <td
                        key={c.id}
                        title="Mark the whole group"
                        className={cn(
                          'relative border-b border-r border-gray-700 cursor-pointer transition-colors hover:bg-gray-800',
                          isTouch ? 'px-4 py-5' : 'px-4 py-2.5'
                        )}
                        onClick={() => openGroupQuickMark(g.id, ci)}
                      >
                        {gm ? (
                          <span className={cn(
                            'font-semibold',
                            pctCell! >= 100 ? 'text-emerald-400' :
                            pctCell! < 50 ? 'text-red-400' : 'text-gray-100'
                          )}>
                            {gm.score}
                          </span>
                        ) : (
                          <span className="text-gray-400/50">—</span>
                        )}
                        {gm?.feedback && (
                          <span className="ml-1 text-gray-100 text-xs">✦</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="border-b border-gray-700 px-4 py-2.5 whitespace-nowrap">
                    {gMarkedCount === criteria.length ? (
                      <span className={cn('font-bold', gradeColor(gPct))}>{gPct.toFixed(1)}%</span>
                    ) : gMarkedCount > 0 ? (
                      <span className="text-xs text-gray-400 tabular-nums">{gMarkedCount}/{criteria.length}</span>
                    ) : (
                      <span className="text-gray-400/40">—</span>
                    )}
                  </td>
                </tr>
              )
            }

            const s = row.student
            const si = rows.indexOf(s)
            const studentMarks = marks.filter(m => m.studentId === s.id)
            const pct = calcProjectPercentage(studentMarks, criteria)
            const isComplete = criteria.every(c => studentMarks.some(m => m.criterionId === c.id))
            const markedCount = criteria.filter(c => studentMarks.some(m => m.criterionId === c.id)).length
            const hasAnyMark = markedCount > 0
            const rowBg = ri % 2 === 0 ? '' : 'bg-white/[0.018]'
            const email = statusFor(s.id)

            return (
              <tr key={row.key} className={cn('group hover:bg-gray-200/5 transition-colors', rowBg)}>
                <td
                  className={cn('border-b border-r border-gray-700 font-medium whitespace-nowrap', rowBg, isTouch ? 'px-4 py-5 text-base' : 'px-4 py-2.5 text-sm', row.group && 'pl-8')}
                  style={row.group ? { boxShadow: `inset 4px 0 0 ${row.group.color}` } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <StudentAvatar student={s} className={isTouch ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs'} />
                    <button
                      onClick={() => setQuickMarkIdx(si)}
                      title="Quick Mark this student"
                      className="text-gray-100 hover:text-gray-100 hover:underline underline-offset-2 transition-colors text-left font-medium"
                    >
                      {s.firstName ? `${s.firstName} ${s.name}` : s.name}
                    </button>
                    {onExportStudent && (
                      <button
                        onClick={() => onExportStudent(s)}
                        title="Export assessment report"
                        className={cn(
                          'p-1.5 rounded-lg text-gray-500 hover:text-indigo-300 hover:bg-indigo-950/50 transition-all hover:scale-110',
                          isTouch ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                      >
                        <FileDown size={16} />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        setEmailingId(s.id)
                        try { await emailStudentMark(s, projectId, criteria, marks) } finally { setEmailingId(null) }
                      }}
                      disabled={!s.email || emailingId !== null}
                      title={!s.email ? 'Add an email address for this student on the class page to email their mark'
                        : email.state === 'sent' ? `Emailed ${formatEmailedAt(email.emailedAt)} — click to email ${s.email} again`
                        : email.state === 'changed' ? `Marks changed since emailed ${formatEmailedAt(email.emailedAt)} — click to email ${s.email} again`
                        : `Email mark and marking sheet to ${s.email}`}
                      className={cn(
                        'p-1.5 rounded-lg hover:text-indigo-300 hover:bg-indigo-950/50 transition-all hover:scale-110 disabled:hover:scale-100 disabled:hover:bg-transparent disabled:cursor-not-allowed',
                        email.state === 'sent' ? 'text-emerald-600 dark:text-emerald-400'
                          : email.state === 'changed' ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-500 disabled:hover:text-gray-500',
                        emailingId === s.id ? 'opacity-100 animate-pulse'
                          : !s.email ? (isTouch ? 'opacity-40' : 'opacity-0 group-hover:opacity-40')
                          : isTouch || email.state !== 'none' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {email.state === 'sent' ? <MailCheck size={16} /> : email.state === 'changed' ? <MailWarning size={16} /> : <Mail size={16} />}
                    </button>
                  </div>
                </td>
                {criteria.map((c, ci) => {
                  const mark = getMark(s.id, c.id)
                  const isActive = activeCell?.rowKey === row.key && activeCell?.criterionIdx === ci
                  const hasMark = mark !== undefined
                  const pctCell = hasMark ? (mark.score / c.maxMarks) * 100 : null
                  const gm = row.group && getGroupMark(row.group.id, c.id)
                  const adjusted = gm && mark && mark.score !== gm.score

                  return (
                    <td
                      key={c.id}
                      title={adjusted ? `Adjusted from the group mark of ${gm.score} — changing the group mark won't overwrite it` : undefined}
                      className={cn(
                        'relative border-b border-r border-gray-700 cursor-pointer transition-colors',
                        isTouch ? 'px-4 py-5' : 'px-4 py-2.5',
                        isActive ? 'bg-gray-800/30' : 'hover:bg-gray-800'
                      )}
                      onClick={() => {
                        if (isTouch) {
                          setQuickMarkCriterionIdx(ci)
                          setQuickMarkIdx(si)
                        } else {
                          setActiveCell(isActive ? null : { rowKey: row.key, criterionIdx: ci })
                        }
                      }}
                    >
                      {hasMark ? (
                        <span className={cn(
                          'font-semibold',
                          pctCell! >= 100 ? 'text-emerald-400' :
                          pctCell! < 50 ? 'text-red-400' : 'text-gray-100'
                        )}>
                          {mark.score}
                        </span>
                      ) : (
                        <span className="text-gray-400/50">—</span>
                      )}
                      {mark?.feedback && (
                        <span className="ml-1 text-gray-100 text-xs">✦</span>
                      )}
                      {adjusted && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">adj</span>
                      )}

                      {isActive && (
                        <CellPopover
                          title={s.name}
                          criterion={c}
                          mark={mark}
                          criterionDescriptors={getCriterionDescriptors(c.id)}
                          projectId={projectId}
                          snippets={snippets}
                          onSave={(score, feedback) => upsertMark(s.id, projectId, c.id, score, feedback)}
                          onClear={() => deleteMark(s.id, projectId, c.id)}
                          onClose={() => setActiveCell(null)}
                          onNavigate={navigate}
                        />
                      )}
                    </td>
                  )
                })}
                <td className="border-b border-gray-700 px-4 py-2.5 whitespace-nowrap">
                  {isComplete ? (
                    <span className={cn('font-bold', gradeColor(pct))}>{pct.toFixed(1)}%</span>
                  ) : hasAnyMark ? (
                    <span className="text-xs text-gray-400 tabular-nums">{markedCount}/{criteria.length}</span>
                  ) : (
                    <span className="text-gray-400/40">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        {/* Footer averages */}
        <tfoot>
          <tr className="bg-gray-850">
            <td className="border-t border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-400">Class average</td>
            {criteria.map(c => {
              const cellMarks = marks.filter(m => m.criterionId === c.id)
              const avg = cellMarks.length > 0
                ? cellMarks.reduce((s, m) => s + m.score, 0) / cellMarks.length
                : null
              return (
                <td key={c.id} className="border-t border-r border-gray-700 px-4 py-2.5 text-xs text-gray-400">
                  {avg !== null ? avg.toFixed(1) : '—'}
                </td>
              )
            })}
            <td className="border-t border-gray-700 px-4 py-2.5 text-xs text-gray-400">
              {(() => {
                const completeStudents = students.filter(s =>
                  criteria.every(c => marks.some(m => m.studentId === s.id && m.criterionId === c.id))
                )
                if (completeStudents.length === 0) return '—'
                const avg = completeStudents.reduce((sum, s) => {
                  const sm = marks.filter(m => m.studentId === s.id)
                  return sum + calcProjectPercentage(sm, criteria)
                }, 0) / completeStudents.length
                return avg.toFixed(1) + '%'
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    {quickMarkIdx !== null && (
      <QuickMarkModal
        students={rows}
        criteria={criteria}
        marks={marks}
        projectId={projectId}
        descriptors={descriptors}
        snippets={snippets}
        initialStudentIdx={quickMarkIdx}
        initialCriterionIdx={quickMarkCriterionIdx}
        onClose={() => { setQuickMarkIdx(null); setQuickMarkCriterionIdx(undefined) }}
      />
    )}
    {groupQuickMark && quickMarkGroups.length > 0 && (
      <QuickMarkModal
        students={rows}
        groups={quickMarkGroups}
        groupMarks={groupMarks}
        criteria={criteria}
        marks={marks}
        projectId={projectId}
        descriptors={descriptors}
        snippets={snippets}
        initialStudentIdx={groupQuickMark.idx}
        initialCriterionIdx={groupQuickMark.criterionIdx}
        onClose={() => setGroupQuickMark(null)}
      />
    )}
    </div>
  )
}
