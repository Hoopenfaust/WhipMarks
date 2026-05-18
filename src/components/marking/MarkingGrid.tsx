import { useState, useRef, useEffect } from 'react'
import { Mic, Square, FileDown, Zap } from 'lucide-react'
import type { Student, RubricCriterion, Mark, RubricDescriptor } from '../../types'
import { upsertMark } from '../../db/hooks/useMarks'
import { calcProjectPercentage, gradeColor } from '../../utils/marks'
import { LEVELS } from '../../utils/levels'
import { cn } from '../../utils/cn'
import { QuickMarkModal } from './QuickMarkModal'

// Web Speech API types (not in default TS lib)
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

interface CellPopoverProps {
  student: Student
  criterion: RubricCriterion
  mark: Mark | undefined
  criterionDescriptors: RubricDescriptor[]
  projectId: string
  onClose: () => void
  onNavigate: (dir: 'next' | 'prev') => void
}

function CellPopover({ student, criterion, mark, criterionDescriptors, projectId, onClose, onNavigate }: CellPopoverProps) {
  const [score, setScore] = useState(mark?.score?.toString() ?? '')
  const [feedback, setFeedback] = useState(mark?.feedback ?? '')
  const [recording, setRecording] = useState(false)
  const scoreRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    scoreRef.current?.focus()
    scoreRef.current?.select()
    return () => { recognitionRef.current?.stop() }
  }, [])

  async function save() {
    recognitionRef.current?.stop()
    const num = parseFloat(score)
    if (!isNaN(num)) {
      try {
        await upsertMark(student.id, projectId, criterion.id, Math.min(criterion.maxMarks, Math.max(0, num)), feedback)
      } catch (err) {
        alert('Failed to save mark — please try again.\n' + String(err))
        return
      }
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

  function applyLevel(levelId: string) {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return
    const descriptor = criterionDescriptors.find(d => d.level === levelId)
    const fraction = descriptor?.score ?? level.defaultScore
    const pts = Math.round(criterion.maxMarks * fraction)
    setScore(pts.toString())
    scoreRef.current?.focus()
  }

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = true
    r.interimResults = false
    r.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from({ length: e.results.length - e.resultIndex }, (_, i) => e.results[e.resultIndex + i][0].transcript)
        .join(' ')
        .trim()
      setFeedback(prev => prev ? prev + ' ' + transcript : transcript)
    }
    r.onend = () => setRecording(false)
    r.onerror = () => setRecording(false)
    recognitionRef.current = r
    r.start()
    setRecording(true)
  }

  return (
    <div className="absolute z-50 bg-gray-850 border border-gray-700 rounded-xl shadow-2xl p-5 w-[36rem] top-full left-0 mt-1" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-200">{student.name}</p>
        <p className="text-xs text-gray-400">{criterion.name}</p>
        {criterion.description && <p className="text-xs text-gray-600 mt-0.5">{criterion.description}</p>}
      </div>

      {/* Level quick-pick */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {LEVELS.map(level => {
          const descriptor = criterionDescriptors.find(d => d.level === level.id)
          const fraction = descriptor?.score ?? level.defaultScore
          const pts = Math.round(criterion.maxMarks * fraction)
          return (
            <button
              key={level.id}
              onClick={() => applyLevel(level.id)}
              title={descriptor?.text || level.label}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors',
                'border-gray-700 hover:border-gray-500',
                level.bgColor,
              )}
            >
              <span className={cn('text-xs font-semibold leading-tight', level.textColor)}>
                {level.shortLabel}
              </span>
              <span className="text-xs text-gray-400 tabular-nums ml-2 shrink-0">
                {pts} / {criterion.maxMarks}
              </span>
            </button>
          )
        })}
      </div>

      {/* Score row */}
      <div className="flex items-center gap-3 mb-4">
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
          className="w-24 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-orange-500"
        />
        <span className="text-sm text-gray-500">/ {criterion.maxMarks} marks</span>
      </div>

      {/* Feedback + voice */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-400">Feedback</label>
          <button
            onClick={toggleRecording}
            title={recording ? 'Stop recording' : 'Dictate feedback'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              recording
                ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'
            )}
          >
            {recording ? <Square size={12} /> : <Mic size={12} />}
            {recording ? 'Stop' : 'Dictate'}
          </button>
        </div>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder={recording ? 'Listening…' : 'Feedback (optional)'}
          rows={5}
          className={cn(
            'w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500',
            recording ? 'border-red-500/50' : 'border-gray-700'
          )}
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 text-xs text-gray-500 hover:text-gray-300 py-1.5">Cancel</button>
        <button
          onClick={() => { save(); onNavigate('next') }}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
        >
          Save
        </button>
      </div>
      <p className="text-center text-[10px] text-gray-600 mt-2">Tab → next · Shift+Tab ← prev · Esc close</p>
    </div>
  )
}

interface Props {
  students: Student[]
  criteria: RubricCriterion[]
  marks: Mark[]
  projectId: string
  descriptors?: RubricDescriptor[]
  onExportStudent?: (student: Student) => void
}

export function MarkingGrid({ students, criteria, marks, projectId, descriptors = [], onExportStudent }: Props) {
  const [activeCell, setActiveCell] = useState<{ studentIdx: number; criterionIdx: number } | null>(null)
  const [quickMarkIdx, setQuickMarkIdx] = useState<number | null>(null)

  function getMark(studentId: string, criterionId: string) {
    return marks.find(m => m.studentId === studentId && m.criterionId === criterionId)
  }

  function getCriterionDescriptors(criterionId: string) {
    return descriptors.filter(d => d.criterionId === criterionId)
  }

  function navigate(dir: 'next' | 'prev') {
    if (!activeCell) return
    const { studentIdx, criterionIdx } = activeCell
    const totalCells = students.length * criteria.length
    const flat = studentIdx * criteria.length + criterionIdx
    const next = dir === 'next' ? (flat + 1) % totalCells : (flat - 1 + totalCells) % totalCells
    setActiveCell({ studentIdx: Math.floor(next / criteria.length), criterionIdx: next % criteria.length })
  }

  if (criteria.length === 0) {
    return <p className="text-sm text-gray-600 p-6">Add criteria in the Rubric tab first.</p>
  }
  if (students.length === 0) {
    return <p className="text-sm text-gray-600 p-6">No students in this class yet.</p>
  }

  return (
    <div className="flex flex-col h-full">
    {/* Toolbar */}
    <div className="flex items-center justify-end px-4 py-2 border-b border-gray-800 shrink-0">
      <button
        onClick={() => setQuickMarkIdx(0)}
        data-tutorial="quick-mark-btn"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-colors"
      >
        <Zap size={13} />
        Quick Mark
      </button>
    </div>

    <div className="overflow-auto flex-1">
      <table className="marking-table border-collapse min-w-full text-sm">
        <thead>
          <tr>
            <th className="bg-gray-900 border-b border-r border-gray-800 px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap min-w-40">
              Student
            </th>
            {criteria.map(c => (
              <th key={c.id} className="bg-gray-900 border-b border-r border-gray-800 px-4 py-3 text-left whitespace-nowrap">
                <div className="text-xs font-semibold text-gray-300">{c.name}</div>
                <div className="text-xs text-gray-600">/{c.maxMarks} · {Math.round(c.weight * 100)}%</div>
              </th>
            ))}
            <th className="bg-gray-900 border-b border-gray-800 px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
              Total %
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, si) => {
            const studentMarks = marks.filter(m => m.studentId === s.id)
            const pct = calcProjectPercentage(studentMarks, criteria)
            const isComplete = criteria.every(c => studentMarks.some(m => m.criterionId === c.id))
            const markedCount = criteria.filter(c => studentMarks.some(m => m.criterionId === c.id)).length
            const hasAnyMark = markedCount > 0
            const rowBg = si % 2 === 0 ? '' : 'bg-white/[0.018]'

            return (
              <tr key={s.id} className={cn('group hover:bg-orange-950/10 transition-colors', rowBg)}>
                <td className={cn('border-b border-r border-gray-800 px-4 py-2.5 text-sm font-medium whitespace-nowrap', rowBg)}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuickMarkIdx(si)}
                      title="Quick Mark this student"
                      className="text-gray-300 hover:text-orange-400 hover:underline underline-offset-2 transition-colors text-left font-medium"
                    >
                      {s.firstName ? `${s.firstName} ${s.name}` : s.name}
                    </button>
                    {onExportStudent && (
                      <button
                        onClick={() => onExportStudent(s)}
                        title="Export assessment report"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-orange-400 hover:bg-orange-950/40 transition-all"
                      >
                        <FileDown size={13} />
                      </button>
                    )}
                  </div>
                </td>
                {criteria.map((c, ci) => {
                  const mark = getMark(s.id, c.id)
                  const isActive = activeCell?.studentIdx === si && activeCell?.criterionIdx === ci
                  const hasMark = mark !== undefined
                  const pctCell = hasMark ? (mark.score / c.maxMarks) * 100 : null

                  return (
                    <td
                      key={c.id}
                      className={cn(
                        'relative border-b border-r border-gray-800 px-4 py-2.5 cursor-pointer transition-colors',
                        isActive ? 'bg-orange-950/30' : 'hover:bg-gray-800'
                      )}
                      onClick={() => setActiveCell(isActive ? null : { studentIdx: si, criterionIdx: ci })}
                    >
                      {hasMark ? (
                        <span className={cn(
                          'font-semibold',
                          pctCell! >= 100 ? 'text-emerald-400' :
                          pctCell! < 50 ? 'text-red-400' : 'text-gray-200'
                        )}>
                          {mark.score}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                      {mark?.feedback && (
                        <span className="ml-1 text-orange-500 text-xs">✦</span>
                      )}

                      {isActive && (
                        <CellPopover
                          student={s}
                          criterion={c}
                          mark={mark}
                          criterionDescriptors={getCriterionDescriptors(c.id)}
                          projectId={projectId}
                          onClose={() => setActiveCell(null)}
                          onNavigate={navigate}
                        />
                      )}
                    </td>
                  )
                })}
                <td className="border-b border-gray-800 px-4 py-2.5 whitespace-nowrap">
                  {isComplete ? (
                    <span className={cn('font-bold', gradeColor(pct))}>{pct.toFixed(1)}%</span>
                  ) : hasAnyMark ? (
                    <span className="text-xs text-gray-500 tabular-nums">{markedCount}/{criteria.length}</span>
                  ) : (
                    <span className="text-gray-800">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        {/* Footer averages */}
        <tfoot>
          <tr className="bg-gray-900">
            <td className="border-t border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-500">Class average</td>
            {criteria.map(c => {
              const cellMarks = marks.filter(m => m.criterionId === c.id)
              const avg = cellMarks.length > 0
                ? cellMarks.reduce((s, m) => s + m.score, 0) / cellMarks.length
                : null
              return (
                <td key={c.id} className="border-t border-r border-gray-700 px-4 py-2.5 text-xs text-gray-500">
                  {avg !== null ? avg.toFixed(1) : '—'}
                </td>
              )
            })}
            <td className="border-t border-gray-700 px-4 py-2.5 text-xs text-gray-500">
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
        students={students}
        criteria={criteria}
        marks={marks}
        projectId={projectId}
        descriptors={descriptors}
        initialStudentIdx={quickMarkIdx}
        onClose={() => setQuickMarkIdx(null)}
      />
    )}
    </div>
  )
}
