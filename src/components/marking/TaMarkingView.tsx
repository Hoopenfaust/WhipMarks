import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Upload, CheckCircle2, X } from 'lucide-react'
import { TaTutorialOverlay } from '../tutorial/TaTutorialOverlay'
import type { TaAssignment, RubricCriterion, RubricDescriptor } from '../../types'
import { useTaMarksForProject, upsertTaMark } from '../../db/hooks/useTaMarks'
import { calcProjectPercentage } from '../../utils/marks'
import { LEVELS } from '../../utils/levels'
import { cn } from '../../utils/cn'
import { downloadTaResults } from '../../utils/taExport'

// ─── Speech types (same as MarkingGrid) ──────────────────────────────────────
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null; onerror: (() => void) | null
  start(): void; stop(): void
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number; results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  length: number; item(i: number): SpeechRecognitionResult; [i: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  length: number; item(i: number): SpeechRecognitionAlternative; [i: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative { transcript: string }
declare global { interface Window { SpeechRecognition: new () => SpeechRecognition; webkitSpeechRecognition: new () => SpeechRecognition } }

// ─── Cell popover ─────────────────────────────────────────────────────────────

interface PopoverProps {
  studentName: string
  criterion: RubricCriterion
  initialScore: string
  initialFeedback: string
  descriptors: RubricDescriptor[]
  onSave: (score: number, feedback: string) => void
  onClose: () => void
  onNavigate: (dir: 'next' | 'prev') => void
}

function CellPopover({ studentName, criterion, initialScore, initialFeedback, descriptors, onSave, onClose, onNavigate }: PopoverProps) {
  const [score, setScore]       = useState(initialScore)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [recording, setRecording] = useState(false)
  const scoreRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => { scoreRef.current?.focus(); scoreRef.current?.select(); return () => { recognitionRef.current?.stop() } }, [])

  function save() {
    recognitionRef.current?.stop()
    const num = parseFloat(score)
    if (!isNaN(num)) onSave(Math.min(criterion.maxMarks, Math.max(0, num)), feedback)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save(); onNavigate('next') }
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab') { e.preventDefault(); save(); onNavigate(e.shiftKey ? 'prev' : 'next') }
  }

  function applyLevel(levelId: string) {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return
    const d = descriptors.find(d => d.level === levelId)
    setScore(String(Math.round(criterion.maxMarks * (d?.score ?? level.defaultScore))))
    scoreRef.current?.focus()
  }

  function toggleRecording() {
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = true; r.interimResults = false
    r.onresult = (e: SpeechRecognitionEvent) => {
      const t = Array.from({ length: e.results.length - e.resultIndex }, (_, i) => e.results[e.resultIndex + i][0].transcript).join(' ').trim()
      setFeedback(prev => prev ? prev + ' ' + t : t)
    }
    r.onend = () => setRecording(false); r.onerror = () => setRecording(false)
    recognitionRef.current = r; r.start(); setRecording(true)
  }

  return (
    <div className="absolute z-50 bg-gray-850 border border-gray-700 rounded-xl shadow-2xl shadow-black/60 p-5 w-[36rem] top-full left-0 mt-1" onClick={e => e.stopPropagation()}>
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-100">{studentName}</p>
        <p className="text-xs text-gray-400">{criterion.name}</p>
        {criterion.description && <p className="text-xs text-gray-400/70 mt-0.5">{criterion.description}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {LEVELS.map(level => {
          const d = descriptors.find(d => d.level === level.id)
          const pts = Math.round(criterion.maxMarks * (d?.score ?? level.defaultScore))
          return (
            <button key={level.id} onClick={() => applyLevel(level.id)} title={d?.text || level.label}
              className={cn('flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors border-gray-700 hover:border-gray-600', level.bgColor)}>
              <span className={cn('text-xs font-semibold leading-tight', level.textColor)}>{level.shortLabel}</span>
              <span className={cn('text-xs tabular-nums ml-2 shrink-0 opacity-70', level.textColor)}>{pts} / {criterion.maxMarks}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <input ref={scoreRef} type="number" min="0" max={criterion.maxMarks} step="0.5"
          value={score} onChange={e => setScore(e.target.value)} onKeyDown={handleKeyDown} placeholder="0"
          className="w-24 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-200" />
        <span className="text-sm text-gray-400">/ {criterion.maxMarks} marks</span>
      </div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-400">Feedback</label>
          <button onClick={toggleRecording} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
            recording ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100')}>
            {recording ? <Square size={12} /> : <Mic size={12} />}
            {recording ? 'Stop' : 'Dictate'}
          </button>
        </div>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder={recording ? 'Listening…' : 'Feedback (optional)'} rows={5}
          className={cn('w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none',
            recording ? 'border-red-500/50' : 'border-gray-700')} />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 text-xs text-gray-400 hover:text-gray-100 py-1.5">Cancel</button>
        <button onClick={() => { save(); onNavigate('next') }} className="flex-1 text-sm font-medium py-1.5 rounded-full transition-colors" style={{ background: '#FFB59C', color: '#5F1500' }}>Save</button>
      </div>
      <p className="text-center text-[10px] text-gray-400/70 mt-2">Tab → next · Shift+Tab ← prev · Esc close</p>
    </div>
  )
}

// ─── Main TA marking view ─────────────────────────────────────────────────────

interface Props {
  assignment: TaAssignment
  onClose: () => void
}

export function TaMarkingView({ assignment, onClose }: Props) {
  const [activeCell, setActiveCell] = useState<{ si: number; ci: number } | null>(null)
  const [exported, setExported]     = useState(false)
  const taMarks = useTaMarksForProject(assignment.projectId)

  const { students, criteria, descriptors, projectId, projectName, taName } = assignment

  function getMark(studentId: string, criterionId: string) {
    return taMarks.find(m => m.studentId === studentId && m.criterionId === criterionId)
  }

  function navigate(dir: 'next' | 'prev') {
    if (!activeCell) return
    const total = students.length * criteria.length
    const flat  = activeCell.si * criteria.length + activeCell.ci
    const next  = dir === 'next' ? (flat + 1) % total : (flat - 1 + total) % total
    setActiveCell({ si: Math.floor(next / criteria.length), ci: next % criteria.length })
  }

  const markedCount = students.filter(s => criteria.every(c => getMark(s.id, c.id))).length
  const allDone     = markedCount === students.length

  function handleExport() {
    downloadTaResults(projectId, projectName, taName, taMarks)
    setExported(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      <TaTutorialOverlay
        projectId={projectId}
        projectName={projectName}
        taName={taName}
        studentCount={students.length}
      />

      {/* TA mode banner */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-700 bg-indigo-950/40">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-indigo-300">TA Mode — {projectName}</p>
            <p className="text-xs text-indigo-400/70">{assignment.className} · Marking as {taName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{markedCount}/{students.length} students complete</span>
          <button
            onClick={handleExport}
            disabled={!allDone}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors',
              allDone
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            )}
          >
            <Upload size={14} />
            Export Results
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {exported && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-2 bg-emerald-950/40 border-b border-emerald-900/50 text-emerald-400 text-sm">
          <CheckCircle2 size={15} />
          Results exported — send the file to your teacher.
        </div>
      )}

      {/* Marking grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-xl border border-gray-700 overflow-hidden shadow-md shadow-black/30">
          <table className="border-collapse min-w-full text-sm">
            <thead>
              <tr>
                <th className="bg-gray-850 border-b border-r border-gray-700 px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap min-w-40">Student</th>
                {criteria.map(c => (
                  <th key={c.id} className="bg-gray-850 border-b border-r border-gray-700 px-4 py-3 text-left whitespace-nowrap">
                    <div className="text-xs font-semibold text-gray-100">{c.name}</div>
                    <div className="text-xs text-gray-400/70">/{c.maxMarks}</div>
                  </th>
                ))}
                <th className="bg-gray-850 border-b border-gray-700 px-4 py-3 text-left text-xs font-semibold text-gray-400">Total %</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, si) => {
                const studentMarks = taMarks.filter(m => m.studentId === s.id)
                const pct          = calcProjectPercentage(studentMarks, criteria)
                const isComplete   = criteria.every(c => studentMarks.some(m => m.criterionId === c.id))
                const rowBg        = si % 2 === 0 ? '' : 'bg-white/[0.018]'
                const displayName  = s.firstName ? `${s.firstName} ${s.name}` : s.name

                return (
                  <tr key={s.id} className={cn('group hover:bg-gray-200/5 transition-colors', rowBg)}>
                    <td className={cn('border-b border-r border-gray-700 px-4 py-2.5 text-sm font-medium whitespace-nowrap', rowBg)}>
                      <div className="flex items-center gap-2">
                        {isComplete && <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />}
                        <span className="text-gray-100">{displayName}</span>
                      </div>
                    </td>
                    {criteria.map((c, ci) => {
                      const mark    = getMark(s.id, c.id)
                      const isActive = activeCell?.si === si && activeCell?.ci === ci
                      const cDescs  = descriptors.filter(d => d.criterionId === c.id)

                      return (
                        <td key={c.id}
                          className={cn('relative border-b border-r border-gray-700 px-4 py-2.5 cursor-pointer transition-colors',
                            isActive ? 'bg-gray-800/30' : 'hover:bg-gray-800')}
                          onClick={() => setActiveCell(isActive ? null : { si, ci })}
                        >
                          {mark !== undefined ? (
                            <span className={cn('font-semibold',
                              (mark.score / c.maxMarks) * 100 >= 100 ? 'text-emerald-400' :
                              (mark.score / c.maxMarks) * 100 < 50  ? 'text-red-400' : 'text-gray-100'
                            )}>{mark.score}</span>
                          ) : (
                            <span className="text-gray-400/50">—</span>
                          )}
                          {mark?.feedback && <span className="ml-1 text-gray-100 text-xs">✦</span>}

                          {isActive && (
                            <CellPopover
                              studentName={displayName}
                              criterion={c}
                              initialScore={mark?.score?.toString() ?? ''}
                              initialFeedback={mark?.feedback ?? ''}
                              descriptors={cDescs}
                              onSave={(score, feedback) => upsertTaMark(s.id, projectId, c.id, score, feedback, taName)}
                              onClose={() => setActiveCell(null)}
                              onNavigate={navigate}
                            />
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-gray-700 px-4 py-2.5 whitespace-nowrap">
                      {isComplete
                        ? <span className="font-bold text-emerald-400">{pct.toFixed(1)}%</span>
                        : <span className="text-xs text-gray-400">{studentMarks.length}/{criteria.length}</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!allDone && (
        <div className="shrink-0 px-6 py-3 border-t border-gray-700 text-xs text-gray-400/70 text-center">
          Mark all students to unlock export · {students.length - markedCount} remaining
        </div>
      )}
    </div>
  )
}
