import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { Plus, Trash2, Pencil, BarChart2, ChevronRight, Camera, CheckCircle2, Circle, Check } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { useLiveQuery } from 'dexie-react-hooks'
import { useClass, updateClass } from '../db/hooks/useClasses'
import { useStudents, addStudent, deleteStudent, updateStudentName, updateStudentPhoto, updateStudentNames, updateStudentNotes, updateStudentChecklist } from '../db/hooks/useStudents'
import { useProjects, createProject, deleteProject } from '../db/hooks/useProjects'
import { useAllMarksForClass, upsertMark } from '../db/hooks/useMarks'
import { db } from '../db/db'
import { calcProjectPercentage, calcSemesterMark, gradeColor } from '../utils/marks'
import { TabBar } from '../components/ui/TabBar'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { SlideOver } from '../components/ui/SlideOver'

import { resizeImageToDataUrl } from '../utils/photo'
import { ClassSchedule } from '../components/schedule/ClassSchedule'
import type { Student, Project, RubricCriterion, Mark, ChecklistItem } from '../types'
import { newId } from '../utils/id'

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'projects', label: 'Projects' },
  { id: 'schedule', label: 'Schedule' },
]

// Pastel accent palette — deterministic per student ID
const STUDENT_PALETTE = [
  { cardBg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.30)',  avatarBg: 'rgba(59,130,246,0.22)',  avatarText: '#93c5fd' }, // blue
  { cardBg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.30)', avatarBg: 'rgba(168,85,247,0.22)', avatarText: '#c4b5fd' }, // purple
  { cardBg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.30)', avatarBg: 'rgba(16,185,129,0.22)', avatarText: '#6ee7b7' }, // emerald
  { cardBg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.30)', avatarBg: 'rgba(245,158,11,0.22)', avatarText: '#fcd34d' }, // amber
  { cardBg: 'rgba(236,72,153,0.07)', border: 'rgba(236,72,153,0.30)', avatarBg: 'rgba(236,72,153,0.22)', avatarText: '#f9a8d4' }, // pink
  { cardBg: 'rgba(6,182,212,0.07)',  border: 'rgba(6,182,212,0.30)',  avatarBg: 'rgba(6,182,212,0.22)',  avatarText: '#67e8f9' }, // cyan
  { cardBg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.30)', avatarBg: 'rgba(249,115,22,0.22)', avatarText: '#fdba74' }, // orange
  { cardBg: 'rgba(20,184,166,0.07)', border: 'rgba(20,184,166,0.30)', avatarBg: 'rgba(20,184,166,0.22)', avatarText: '#5eead4' }, // teal
  { cardBg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.30)', avatarBg: 'rgba(99,102,241,0.22)', avatarText: '#a5b4fc' }, // indigo
  { cardBg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.30)',  avatarBg: 'rgba(239,68,68,0.22)',  avatarText: '#fca5a5' }, // rose
]

function studentColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return STUDENT_PALETTE[Math.abs(h) % STUDENT_PALETTE.length]
}

function StudentAvatar({ student, size = 80, onPhotoClick, onPhotoDrop, uploading = false }: { student: Student; size?: number; onPhotoClick?: () => void; onPhotoDrop?: (file: File) => void; uploading?: boolean }) {
  const [dragOver, setDragOver] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const interactive = !!(onPhotoClick || onPhotoDrop)

  const initials = [student.firstName, student.name]
    .filter(Boolean)
    .map(n => n![0].toUpperCase())
    .join('')
    .slice(0, 2) || student.name[0]?.toUpperCase() || '?'

  const sizeClass = size >= 160 ? 'w-40 h-40 text-3xl' : size >= 80 ? 'w-20 h-20 text-lg' : 'w-10 h-10 text-sm'
  const iconSize  = size >= 80 ? 22 : 12

  // Flash a checkmark briefly after a successful upload
  useEffect(() => {
    if (!uploading && justSaved) {
      const t = setTimeout(() => setJustSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [uploading, justSaved])

  // Detect transition from uploading→done so we can show the check
  const prevUploading = useRef(false)
  useEffect(() => {
    if (prevUploading.current && !uploading) setJustSaved(true)
    prevUploading.current = uploading
  }, [uploading])

  function handleDragOver(e: React.DragEvent) {
    if (!onPhotoDrop) return
    e.preventDefault(); e.stopPropagation()
    setDragOver(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) onPhotoDrop?.(file)
  }

  return (
    <button
      onClick={onPhotoClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      disabled={uploading}
      className={[
        'relative flex-shrink-0', sizeClass, 'rounded-full overflow-hidden focus:outline-none',
        'transition-all duration-150',
        interactive && !uploading ? 'cursor-pointer hover:scale-105 active:scale-95 hover:ring-2 hover:ring-orange-500/60 hover:ring-offset-2 hover:ring-offset-gray-900' : 'cursor-default',
        dragOver ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-gray-900 scale-105' : '',
      ].join(' ')}
      title={interactive ? 'Click to upload or drag a photo here' : undefined}
    >
      {/* Photo or initials */}
      {student.photo ? (
        <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-semibold"
          style={{ background: studentColor(student.id).avatarBg, color: studentColor(student.id).avatarText }}
        >
          {initials}
        </div>
      )}

      {/* Uploading spinner */}
      {uploading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <Spinner size={iconSize} />
        </div>
      )}

      {/* Just-saved checkmark */}
      {justSaved && !uploading && (
        <div className="absolute inset-0 bg-emerald-500/70 flex items-center justify-center animate-pulse">
          <Check size={iconSize} className="text-white" strokeWidth={3} />
        </div>
      )}

      {/* Drag-over overlay */}
      {dragOver && !uploading && (
        <div className="absolute inset-0 bg-orange-500/50 flex items-center justify-center">
          <Camera size={iconSize} className="text-white" />
        </div>
      )}

      {/* Hover overlay — always-visible hint when photo exists, fade-in otherwise */}
      {interactive && !uploading && !dragOver && !justSaved && (
        <div className={[
          'absolute inset-0 flex items-center justify-center transition-opacity duration-100',
          student.photo
            ? 'bg-black/40 opacity-0 group-hover/avatar:opacity-100'
            : 'bg-black/50 opacity-0 group-hover/avatar:opacity-100',
        ].join(' ')}>
          <Camera size={iconSize} className="text-white drop-shadow" />
        </div>
      )}
    </button>
  )
}

interface StudentCardProps {
  student: Student
  semesterMark: number | null
  uploading?: boolean
  projectMarks: { name: string; pct: number | null }[]
  onEdit: () => void
  onDelete: () => void
  onPhotoClick: () => void
  onPhotoDrop: (file: File) => void
  onDoubleClick: () => void
}

function StudentCard({ student, semesterMark, projectMarks, onEdit, onDelete, onPhotoClick, onPhotoDrop, onDoubleClick, uploading = false }: StudentCardProps) {
  const color = studentColor(student.id)
  return (
    <div
      className="backdrop-blur-sm rounded-xl p-8 flex flex-col items-center gap-5 group relative cursor-pointer select-none shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/40 transition-all duration-200"
      style={{ background: color.cardBg, borderWidth: 1, borderStyle: 'solid', borderColor: color.border }}
      onDoubleClick={onDoubleClick}
    >
      {/* Reflection gradient */}
      <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />

      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button onClick={onEdit} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Photo */}
      <StudentAvatar student={student} size={160} onPhotoClick={onPhotoClick} onPhotoDrop={onPhotoDrop} uploading={uploading} />

      {/* Name */}
      <div className="text-center">
        {student.firstName && (
          <p className="text-3xl font-semibold text-gray-100 leading-tight">{student.firstName}</p>
        )}
        <p className="text-xl text-gray-500">{student.name}</p>
      </div>

      {/* Stats grid — wraps to multiple rows when projects overflow */}
      <div className="w-full border-t border-gray-700 pt-3 flex flex-wrap gap-2 justify-center">
        {/* Semester tile */}
        <div className="flex flex-col items-center gap-0.5 bg-gray-900/60 rounded-lg px-3 py-2 min-w-[64px]">
          {semesterMark !== null ? (
            <span className={`text-2xl font-bold leading-none ${gradeColor(semesterMark)}`}>
              {semesterMark.toFixed(0)}%
            </span>
          ) : (
            <span className="text-2xl font-bold leading-none text-gray-600">—</span>
          )}
          <span className="text-xs text-gray-500 mt-1">sem.</span>
        </div>

        {/* Per-project tiles */}
        {projectMarks.map(({ name, pct }) => (
          <div key={name} className="flex flex-col items-center gap-0.5 bg-gray-900/60 rounded-lg px-3 py-2 min-w-[64px] max-w-[96px]">
            {pct !== null ? (
              <span className={`text-2xl font-bold leading-none ${gradeColor(pct)}`}>
                {pct.toFixed(0)}%
              </span>
            ) : (
              <span className="text-2xl font-bold leading-none text-gray-600">—</span>
            )}
            <span className="text-xs text-gray-500 text-center w-full truncate mt-1" title={name}>
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressChart({ projects, allMarks, allCriteria }: { projects: Project[]; allMarks: Mark[]; allCriteria: RubricCriterion[] }) {
  const sorted = [...projects].sort((a, b) => a.createdAt - b.createdAt)
  const dataPoints = sorted.map((p, idx) => {
    const criteria = allCriteria.filter(c => c.projectId === p.id)
    const marks = allMarks.filter(m => m.projectId === p.id)
    if (criteria.length === 0 || marks.length === 0) return { name: p.name, idx, pct: null as number | null }
    return { name: p.name, idx, pct: calcProjectPercentage(marks, criteria) }
  })

  const scored = dataPoints.filter(d => d.pct !== null)
  if (scored.length === 0) return null

  const W = 400, H = 140
  const pad = { top: 20, right: 20, bottom: 38, left: 40 }
  const chartW = W - pad.left - pad.right
  const chartH = H - pad.top - pad.bottom
  const n = sorted.length

  const xAt = (idx: number) => pad.left + (n <= 1 ? chartW / 2 : (idx / (n - 1)) * chartW)
  const yAt = (pct: number) => pad.top + chartH - (pct / 100) * chartH

  const linePts = scored.map(d => `${xAt(d.idx)},${yAt(d.pct!)}`).join(' ')

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 px-3 pt-3 pb-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Progress</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
        {/* Grade zone backgrounds */}
        <rect x={pad.left} y={yAt(100)} width={chartW} height={yAt(65) - yAt(100)} fill="rgba(52,211,153,0.06)" />
        <rect x={pad.left} y={yAt(65)} width={chartW} height={yAt(50) - yAt(65)} fill="rgba(251,191,36,0.06)" />
        <rect x={pad.left} y={yAt(50)} width={chartW} height={yAt(0) - yAt(50)} fill="rgba(248,113,113,0.06)" />
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(g => (
          <g key={g}>
            <line x1={pad.left} y1={yAt(g)} x2={W - pad.right} y2={yAt(g)} stroke="#27272a" strokeWidth={1} />
            <text x={pad.left - 6} y={yAt(g) + 4} textAnchor="end" fontSize={9} fill="#52525b">{g}</text>
          </g>
        ))}
        {/* Connect line */}
        {scored.length >= 2 && (
          <polyline points={linePts} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Dots */}
        {dataPoints.map(d => (
          d.pct !== null ? (
            <g key={d.idx}>
              <circle cx={xAt(d.idx)} cy={yAt(d.pct)} r={4.5}
                fill={d.pct >= 65 ? '#34d399' : d.pct >= 50 ? '#fbbf24' : '#f87171'}
                stroke="#111113" strokeWidth={1.5} />
              <text x={xAt(d.idx)} y={yAt(d.pct) - 9} textAnchor="middle" fontSize={9} fill="#a1a1aa" fontWeight="600">
                {d.pct.toFixed(0)}%
              </text>
              <text x={xAt(d.idx)} y={H - pad.bottom + 14} textAnchor="middle" fontSize={9} fill="#71717a">
                {d.name.length > 9 ? d.name.slice(0, 8) + '…' : d.name}
              </text>
            </g>
          ) : (
            <g key={d.idx}>
              <circle cx={xAt(d.idx)} cy={pad.top + chartH / 2} r={3} fill="#3f3f46" />
              <text x={xAt(d.idx)} y={H - pad.bottom + 14} textAnchor="middle" fontSize={9} fill="#3f3f46">
                {d.name.length > 9 ? d.name.slice(0, 8) + '…' : d.name}
              </text>
            </g>
          )
        ))}
      </svg>
    </div>
  )
}

interface StudentDetailProps {
  student: Student
  projects: Project[]
  allMarks: Mark[]
  allCriteria: RubricCriterion[]
  classId: string
}

function StudentDetail({ student, projects, allMarks, allCriteria, classId }: StudentDetailProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editScore, setEditScore] = useState('')
  const [editFeedback, setEditFeedback] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [notes, setNotes] = useState(student.notes ?? '')
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(() => {
    try { return student.checklistItems ? JSON.parse(student.checklistItems) : [] }
    catch { return [] }
  })
  const [newItemText, setNewItemText] = useState('')

  // Sync if student prop changes (e.g. drawer opens for different student)
  useEffect(() => {
    setNotes(student.notes ?? '')
    try { setChecklistItems(student.checklistItems ? JSON.parse(student.checklistItems) : []) }
    catch { setChecklistItems([]) }
  }, [student.id])

  async function saveNotes() {
    try {
      await updateStudentNotes(student.id, notes)
      // Read back to confirm
      const saved = await db.students.get(student.id)
      if ((saved?.notes ?? '') !== notes) {
        alert('Notes saved but read-back did not match — please try again.')
      }
    } catch (err) {
      alert('Failed to save notes: ' + String(err))
      console.error('saveNotes failed:', err)
    }
  }

  async function saveChecklist(updated: ChecklistItem[]) {
    try {
      await updateStudentChecklist(student.id, updated)
      // Read back to confirm
      const saved = await db.students.get(student.id)
      if (!saved?.checklistItems) {
        alert('Checklist saved but read-back failed — please try again.')
      }
    } catch (err) {
      alert('Failed to save checklist: ' + String(err))
      console.error('saveChecklist failed:', err)
    }
  }

  async function addChecklistItem() {
    const text = newItemText.trim()
    if (!text) return
    const updated = [...checklistItems, { id: newId(), text, done: false }]
    setChecklistItems(updated)
    setNewItemText('')
    await saveChecklist(updated)
  }

  async function toggleChecklistItem(id: string) {
    const updated = checklistItems.map(item => item.id === id ? { ...item, done: !item.done } : item)
    setChecklistItems(updated)
    await saveChecklist(updated)
  }

  async function deleteChecklistItem(id: string) {
    const updated = checklistItems.filter(item => item.id !== id)
    setChecklistItems(updated)
    await saveChecklist(updated)
  }

  const sorted = [...projects].sort((a, b) => a.createdAt - b.createdAt)

  const semesterProjects = sorted.filter(p => p.semesterWeight > 0)
  const semesterMark = semesterProjects.length > 0 && semesterProjects.some(p => {
    const criteria = allCriteria.filter(c => c.projectId === p.id)
    return criteria.some(c => allMarks.some(m => m.studentId === student.id && m.criterionId === c.id))
  })
    ? calcSemesterMark(semesterProjects.map(p => ({
        weight: p.semesterWeight,
        percentage: calcProjectPercentage(
          allMarks.filter(m => m.studentId === student.id && m.projectId === p.id),
          allCriteria.filter(c => c.projectId === p.id)
        ),
      })))
    : null

  function openEdit(c: RubricCriterion, mark: Mark | undefined) {
    setEditingId(c.id)
    setEditScore(mark ? String(mark.score) : '')
    setEditFeedback(mark?.feedback ?? '')
  }

  async function saveEdit(projectId: string, criterionId: string, maxMarks: number) {
    const score = Math.min(maxMarks, Math.max(0, parseFloat(editScore) || 0))
    await upsertMark(student.id, projectId, criterionId, score, editFeedback)
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Student header */}
      <div className="flex items-center gap-4 pb-4 border-b border-gray-700">
        <StudentAvatar student={student} size={160} />
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex flex-col gap-2">
              <input
                value={editFirstName}
                onChange={e => setEditFirstName(e.target.value)}
                placeholder="First name"
                autoFocus
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500"
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    if (editLastName.trim()) { await updateStudentNames(student.id, editFirstName.trim(), editLastName.trim()); setEditingName(false) }
                  }
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
              <input
                value={editLastName}
                onChange={e => setEditLastName(e.target.value)}
                placeholder="Last name"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500"
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    if (editLastName.trim()) { await updateStudentNames(student.id, editFirstName.trim(), editLastName.trim()); setEditingName(false) }
                  }
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => { if (editLastName.trim()) { await updateStudentNames(student.id, editFirstName.trim(), editLastName.trim()); setEditingName(false) } }}
                  className="px-3 py-1 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Save
                </button>
                <button onClick={() => setEditingName(false)} className="px-3 py-1 text-gray-400 hover:text-gray-200 text-xs rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 group/name">
              <p className="text-lg font-semibold text-gray-100 truncate">
                {student.firstName ? `${student.firstName} ${student.name}` : student.name}
              </p>
              <button
                onClick={() => { setEditFirstName(student.firstName ?? ''); setEditLastName(student.name); setEditingName(true) }}
                className="opacity-0 group-hover/name:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-all shrink-0"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
          {semesterMark !== null && (
            <p className={`text-sm font-medium mt-0.5 ${gradeColor(semesterMark)}`}>
              Semester: {semesterMark.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Progress Chart */}
      {projects.length > 0 && (
        <ProgressChart projects={projects} allMarks={allMarks} allCriteria={allCriteria} />
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add notes about this student…"
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 placeholder-gray-700 resize-none focus:outline-none focus:border-gray-500 transition-colors"
        />
      </div>

      {/* Improvement Checklist */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checklist</label>

        {checklistItems.length > 0 && (
          <div className="flex flex-col gap-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            {checklistItems.map(item => (
              <div key={item.id} className="flex items-start gap-2.5 px-3 py-2.5 border-b border-gray-800 last:border-0 group/item">
                <button
                  onClick={() => toggleChecklistItem(item.id)}
                  className="mt-0.5 shrink-0 text-gray-600 hover:text-orange-400 transition-colors"
                >
                  {item.done
                    ? <CheckCircle2 size={16} className="text-emerald-500" />
                    : <Circle size={16} />
                  }
                </button>
                <span className={`flex-1 text-sm leading-snug select-none ${item.done ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                  {item.text}
                </span>
                <button
                  onClick={() => deleteChecklistItem(item.id)}
                  className="opacity-0 group-hover/item:opacity-100 shrink-0 p-0.5 text-gray-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
            placeholder="Add improvement item…"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-700 focus:outline-none focus:border-gray-500 transition-colors"
          />
          <button
            onClick={addChecklistItem}
            disabled={!newItemText.trim()}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-gray-500">No projects yet.</p>
      )}

      {/* Per-project breakdown */}
      {sorted.map(project => {
        const criteria = allCriteria.filter(c => c.projectId === project.id)
        const marks = allMarks.filter(m => m.studentId === student.id && m.projectId === project.id)
        const pct = criteria.length > 0 ? calcProjectPercentage(marks, criteria) : null
        const hasAnyMark = marks.length > 0

        return (
          <div key={project.id} className="flex flex-col gap-2">
            {/* Project header */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/classes/${classId}/projects/${project.id}`}
                className="font-bold text-gray-100 text-lg hover:text-orange-400 transition-colors flex items-center gap-1"
              >
                {project.name}
                <ChevronRight size={16} className="text-gray-600" />
              </Link>
              {project.semesterWeight > 0 && (
                <span className="text-xs bg-orange-950 text-orange-400 border border-orange-900/50 rounded px-1.5 py-0.5">
                  {Math.round(project.semesterWeight * 100)}% of semester
                </span>
              )}
              {project.dueDate && (
                <span className="text-xs text-gray-600">
                  Due {new Date(project.dueDate).toLocaleDateString()}
                </span>
              )}
              <Link
                to={`/classes/${classId}/projects/${project.id}?tab=marking`}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-colors shrink-0"
              >
                <BarChart2 size={12} />
                Mark
              </Link>
            </div>

            {criteria.length === 0 ? (
              <p className="text-xs text-gray-600 pl-1">No rubric set up yet.</p>
            ) : (
              <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-4 py-3 text-gray-500 font-medium text-sm">Criterion</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium text-sm">Score</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium text-sm w-16">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map(c => {
                      const mark = marks.find(m => m.criterionId === c.id)
                      const scored = mark !== undefined
                      const pctCell = scored ? (mark.score / c.maxMarks) * 100 : null
                      const isEditing = editingId === c.id

                      return (
                        <tr key={c.id} className="border-b border-gray-800 last:border-0">
                          {isEditing ? (
                            <td colSpan={3} className="px-3 py-3">
                              <div className="flex flex-col gap-2">
                                <p className="text-gray-300 font-medium">{c.name}</p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={c.maxMarks}
                                    value={editScore}
                                    onChange={e => setEditScore(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveEdit(project.id, c.id, c.maxMarks)
                                      if (e.key === 'Escape') setEditingId(null)
                                    }}
                                    autoFocus
                                    placeholder="0"
                                    className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                                  />
                                  <span className="text-gray-500">/ {c.maxMarks}</span>
                                </div>
                                <textarea
                                  value={editFeedback}
                                  onChange={e => setEditFeedback(e.target.value)}
                                  placeholder="Feedback (optional)"
                                  rows={2}
                                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveEdit(project.id, c.id, c.maxMarks)}
                                    className="px-3 py-1 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded-lg transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="px-3 py-1 text-gray-400 hover:text-gray-200 text-xs rounded-lg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-gray-300 text-sm">
                                <div className="flex items-center gap-2">
                                  {scored
                                    ? <CheckCircle2 size={13} className="text-gray-600 shrink-0" />
                                    : <Circle size={13} className="text-gray-700 shrink-0" />
                                  }
                                  {c.name}
                                </div>
                              </td>
                              <td
                                className="px-4 py-3 text-right text-gray-300 text-sm cursor-pointer hover:text-orange-400 transition-colors group/score"
                                onClick={() => openEdit(c, mark)}
                                title="Click to edit"
                              >
                                <span className="group-hover/score:underline underline-offset-2 flex items-center justify-end gap-1">
                                  {scored ? `${mark.score} / ${c.maxMarks}` : <Plus size={14} className="text-gray-600 group-hover/score:text-orange-400" />}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-right font-medium text-sm ${pctCell !== null ? gradeColor(pctCell) : 'text-gray-600'}`}>
                                {pctCell !== null ? `${pctCell.toFixed(0)}%` : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700 bg-gray-850">
                      <td className="px-4 py-3 text-gray-400 font-medium text-sm">Total</td>
                      <td />
                      <td className={`px-4 py-3 text-right font-bold text-base ${pct !== null && hasAnyMark ? gradeColor(pct) : 'text-gray-600'}`}>
                        {pct !== null && hasAnyMark ? `${pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {/* Feedback snippets */}
                {marks.some(m => m.feedback) && (
                  <div className="border-t border-gray-700 px-4 py-3 flex flex-col gap-2">
                    {marks.filter(m => m.feedback).map(m => {
                      const c = criteria.find(cr => cr.id === m.criterionId)
                      return (
                        <div key={m.id}>
                          <span className="text-sm text-gray-500 font-medium">{c?.name}: </span>
                          <span className="text-sm text-gray-400">{m.feedback}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProjectForm({ classId, onDone }: { classId: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [weight, setWeight] = useState('1')
  const navigate = useNavigate()

  async function submit() {
    if (!name.trim()) return
    const project = await createProject({
      classId,
      name: name.trim(),
      dueDate,
      semesterWeight: Math.max(0, Math.min(1, parseFloat(weight) / 100 || 0)),
      totalMarks: 0,
    })
    onDone()
    navigate(`/classes/${classId}/projects/${project.id}?tab=builder`)
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Project name" placeholder="e.g. Term 2 Assignment" value={name}
        onChange={e => setName(e.target.value)} autoFocus />
      <Input label="Due date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-400">Semester weight (%)</label>
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" max="100" step="5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500"
          />
          <span className="text-sm text-gray-500">% of final semester mark</span>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="primary" onClick={submit} disabled={!name.trim()}>Create Project</Button>
      </div>
    </div>
  )
}

export function ClassDetailView() {
  const { classId } = useParams<{ classId: string }>()
  const classObj = useClass(classId)
  const students = useStudents(classId)
  const projects = useProjects(classId)
  const navigate = useNavigate()
  const location = useLocation()

  const projectIds = projects.map(p => p.id)
  const allMarks = useAllMarksForClass(projectIds)
  const allCriteria = useLiveQuery(
    () => projectIds.length > 0 ? db.criteria.where('projectId').anyOf(projectIds).toArray() : [],
    [projectIds.join(',')]
  ) ?? []

  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'roster')
  const [addStudentName, setAddStudentName] = useState('')
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const [editingClass, setEditingClass] = useState(false)
  const [className, setClassName] = useState('')
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [editStudentId, setEditStudentId] = useState<string | null>(null)
  const [editStudentName, setEditStudentName] = useState('')
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null)
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoTargetId = useRef<string | null>(null)

  useEffect(() => {
    const id = (location.state as { openStudentId?: string } | null)?.openStudentId
    if (id) {
      setDetailStudentId(id)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state])

  if (!classObj) return <div className="p-8 text-gray-500 text-sm">Class not found.</div>

  function getProjectMarks(studentId: string): { name: string; pct: number | null }[] {
    return projects.map(p => {
      const criteria = allCriteria.filter(c => c.projectId === p.id)
      const marks = allMarks.filter(m => m.studentId === studentId && m.projectId === p.id)
      if (criteria.length === 0 || marks.length === 0) return { name: p.name, pct: null }
      return { name: p.name, pct: calcProjectPercentage(marks, criteria) }
    })
  }

  function getSemesterMark(studentId: string): number | null {
    const active = projects.filter(p => p.semesterWeight > 0)
    if (active.length === 0) return null
    const anyMarked = active.some(p => {
      const criteria = allCriteria.filter(c => c.projectId === p.id)
      return criteria.some(c => allMarks.some(m => m.studentId === studentId && m.criterionId === c.id))
    })
    if (!anyMarked) return null
    return calcSemesterMark(active.map(p => ({
      weight: p.semesterWeight,
      percentage: calcProjectPercentage(
        allMarks.filter(m => m.studentId === studentId && m.projectId === p.id),
        allCriteria.filter(c => c.projectId === p.id)
      ),
    })))
  }


  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    const name = addStudentName.trim()
    if (!name || !classId) return
    setAddStudentName('')
    await addStudent(classId, name, students.length)
  }

  async function handleEditClass() {
    if (!classId || !className.trim()) return
    await updateClass(classId, className.trim())
    setEditingClass(false)
  }

  function handlePhotoClick(studentId: string) {
    photoTargetId.current = studentId
    photoInputRef.current?.click()
  }

  async function savePhoto(id: string, file: File) {
    setUploadingStudentId(id)
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      await updateStudentPhoto(id, dataUrl)
      // Read back to confirm the write actually landed
      const saved = await db.students.get(id)
      if (!saved?.photo) {
        alert('Photo saved to DB but read-back failed — please report this.')
      }
    } catch (err) {
      alert('Photo upload error: ' + String(err))
      console.error('Photo upload failed:', err)
    } finally {
      setUploadingStudentId(null)
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const id = photoTargetId.current
    if (!file || !id) return
    e.target.value = ''
    await savePhoto(id, file)
  }

  async function handlePhotoDrop(studentId: string, file: File) {
    await savePhoto(studentId, file)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-6">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2.5">
          <Link to="/classes" className="hover:text-gray-300">Classes</Link>
          <ChevronRight size={14} />
          <span className="text-gray-300">{classObj.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-100">{classObj.name}</h1>
            <button
              onClick={() => { setClassName(classObj.name); setEditingClass(true) }}
              className="p-1 text-gray-600 hover:text-gray-400 rounded"
            >
              <Pencil size={14} />
            </button>
          </div>
          <Link
            to={`/classes/${classId}/semester`}
            className="flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 font-medium"
          >
            <BarChart2 size={15} /> Semester Summary
          </Link>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* ROSTER TAB */}
        {tab === 'roster' && (
          <div>
            <form onSubmit={handleAddStudent} className="flex gap-2 mb-6 max-w-sm">
              <Input
                placeholder="Student name"
                value={addStudentName}
                onChange={e => setAddStudentName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="primary" disabled={!addStudentName.trim()}>
                <Plus size={15} /> Add
              </Button>
            </form>

            {students.length === 0 ? (
              <p className="text-sm text-gray-600">No students yet. Add one above or import a CSV from the Classes page.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {students.map(s => (
                  editStudentId === s.id ? (
                    <div key={s.id} className="bg-gray-800 border border-orange-700 rounded-xl p-4 flex flex-col gap-2">
                      <input
                        className="bg-gray-750 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none w-full"
                        value={editStudentName}
                        autoFocus
                        onChange={e => setEditStudentName(e.target.value)}
                        onBlur={async () => {
                          if (editStudentName.trim()) await updateStudentName(s.id, editStudentName.trim())
                          setEditStudentId(null)
                        }}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            if (editStudentName.trim()) await updateStudentName(s.id, editStudentName.trim())
                            setEditStudentId(null)
                          }
                          if (e.key === 'Escape') setEditStudentId(null)
                        }}
                      />
                      <p className="text-xs text-gray-500">Enter to save, Esc to cancel</p>
                    </div>
                  ) : (
                    <StudentCard
                      key={s.id}
                      student={s}
                      semesterMark={getSemesterMark(s.id)}
                      projectMarks={getProjectMarks(s.id)}
                      onEdit={() => { setEditStudentId(s.id); setEditStudentName(s.name) }}
                      onDelete={() => setDeleteStudentId(s.id)}
                      onPhotoClick={() => handlePhotoClick(s.id)}
                      onPhotoDrop={(file) => handlePhotoDrop(s.id, file)}
                      onDoubleClick={() => setDetailStudentId(s.id)}
                      uploading={uploadingStudentId === s.id}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROJECTS TAB */}
        {tab === 'projects' && (
          <div>
            <div className="flex justify-end mb-4">
              <Button variant="primary" size="sm" onClick={() => setAddProjectOpen(true)}>
                <Plus size={15} /> New Project
              </Button>
            </div>

            {projects.length === 0 ? (
              <p className="text-sm text-gray-600">No projects yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(p => {
                  const pCriteria = allCriteria.filter(c => c.projectId === p.id)
                  const pMarks = allMarks.filter(m => m.projectId === p.id)
                  const markedStudents = students.filter(s =>
                    pCriteria.some(c => pMarks.some(m => m.studentId === s.id && m.criterionId === c.id))
                  ).length
                  const totalStudents = students.length
                  const progressPct = totalStudents > 0 ? (markedStudents / totalStudents) * 100 : 0
                  const allDone = markedStudents === totalStudents && totalStudents > 0

                  return (
                    <div
                      key={p.id}
                      className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 group relative cursor-pointer select-none shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/40 hover:border-orange-500/30 transition-all duration-200 overflow-hidden"
                      onClick={() => navigate(`/classes/${classId}/projects/${p.id}`)}
                    >
                      {/* Reflection gradient */}
                      <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-base font-bold text-orange-400">{Math.round(p.semesterWeight * 100)}% of semester</span>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteProjectId(p.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-all relative z-10"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <h3 className="text-3xl font-bold text-gray-100 mb-1 leading-tight">{p.name}</h3>
                      {p.dueDate && (
                        <p className="text-sm text-gray-500">Due {new Date(p.dueDate).toLocaleDateString()}</p>
                      )}
                      {/* Marking progress */}
                      <div className="mt-4 pt-3 border-t border-gray-700/60">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-600">
                            {markedStudents === 0 ? 'Not started' : allDone ? 'All marked ✓' : `${markedStudents} / ${totalStudents} marked`}
                          </span>
                          {markedStudents > 0 && (
                            <span className={`text-xs font-medium ${allDone ? 'text-emerald-500' : 'text-gray-500'}`}>
                              {Math.round(progressPct)}%
                            </span>
                          )}
                        </div>
                        <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-orange-500'}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {tab === 'schedule' && classId && (
          <ClassSchedule
            classId={classId}
            startDate={classObj.startDate}
            projects={projects}
          />
        )}
      </div>

      {/* Student detail panel */}
      {(() => {
        const s = students.find(st => st.id === detailStudentId)
        return (
          <SlideOver
            open={!!detailStudentId}
            onClose={() => setDetailStudentId(null)}
            title={s ? (s.firstName ? `${s.firstName} ${s.name}` : s.name) : ''}
            size="lg"
          >
            {s && (
              <StudentDetail
                student={s}
                projects={projects}
                allMarks={allMarks.filter(m => m.studentId === s.id)}
                allCriteria={allCriteria}
                classId={classId!}
              />
            )}
          </SlideOver>
        )
      })()}

      <SlideOver open={addProjectOpen} onClose={() => setAddProjectOpen(false)} title="New Project">
        {classId && <ProjectForm classId={classId} onDone={() => setAddProjectOpen(false)} />}
      </SlideOver>

      <Modal open={editingClass} onClose={() => setEditingClass(false)} title="Rename Class">
        <div className="flex flex-col gap-4">
          <Input value={className} onChange={e => setClassName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEditClass()} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingClass(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleEditClass}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteStudentId} onClose={() => setDeleteStudentId(null)} title="Remove Student">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-400">Remove this student and all their marks? This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteStudentId(null)}>Cancel</Button>
            <Button variant="danger" onClick={async () => { await deleteStudent(deleteStudentId!); setDeleteStudentId(null) }}>Remove</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteProjectId} onClose={() => setDeleteProjectId(null)} title="Delete Project">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-400">Delete this project and all associated marks and rubrics? This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteProjectId(null)}>Cancel</Button>
            <Button variant="danger" onClick={async () => { await deleteProject(deleteProjectId!); setDeleteProjectId(null) }}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
