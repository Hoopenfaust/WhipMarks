import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Shuffle, RotateCcw, Pencil, Users } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { db } from '../../db/db'
import { useGroups, useGroupMembers, generateGroups, renameGroup, clearGroups, moveStudentToGroup } from '../../db/hooks/useGroups'
import { useProjects, updateProject } from '../../db/hooks/useProjects'
import { useAllMarksForClass } from '../../db/hooks/useMarks'
import { calcStudentSemesterMark, gradeColor } from '../../utils/marks'
import type { Project, Student, Group } from '../../types'

interface Props {
  project: Project
  students: Student[]
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function studentName(s: Student) {
  return s.firstName ? `${s.firstName} ${s.name}` : s.name
}

function initialsFor(s: Student) {
  return [s.firstName, s.name].filter(Boolean).map(n => n![0].toUpperCase()).join('').slice(0, 2) || s.name[0]?.toUpperCase() || '?'
}

function GenerateGroupsModal({ open, onClose, projectId, students }: { open: boolean; onClose: () => void; projectId: string; students: Student[] }) {
  const [groupSize, setGroupSize] = useState('4')
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set())

  function toggleAbsent(id: string) {
    setAbsentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const presentStudents = students.filter(s => !absentIds.has(s.id))
  const size = Math.max(1, parseInt(groupSize, 10) || 0)
  const groupCount = presentStudents.length > 0 ? Math.ceil(presentStudents.length / size) : 0

  async function handleGenerate() {
    if (presentStudents.length === 0) return
    await generateGroups(projectId, presentStudents.map(s => s.id), size)
    setAbsentIds(new Set())
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate Groups">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">Group size</label>
          <input
            type="number" min={1} step={1}
            value={groupSize}
            onChange={e => setGroupSize(e.target.value)}
            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-200"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-400">Mark students absent</label>
            <span className="text-xs text-gray-400/70">{presentStudents.length} of {students.length} present</span>
          </div>
          <div className="border border-gray-700 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            {students.map((s, i) => {
              const absent = absentIds.has(s.id)
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-gray-800 ${i > 0 ? 'border-t border-gray-700/50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!absent}
                    onChange={() => toggleAbsent(s.id)}
                    className="accent-indigo-400"
                  />
                  <span className={`text-sm ${absent ? 'text-gray-400/60 line-through' : 'text-gray-100'}`}>{studentName(s)}</span>
                </label>
              )
            })}
          </div>
          <p className="text-xs text-gray-400/70">Not saved — just used for this draw.</p>
        </div>

        {presentStudents.length > 0 && (
          <p className="text-xs text-gray-400">
            Will create {groupCount} group{groupCount === 1 ? '' : 's'} of up to {size}.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleGenerate} disabled={presentStudents.length === 0 || size < 1}>
            <Shuffle size={14} /> Generate
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface GroupCardProps {
  group: Group
  memberIds: string[]
  students: Student[]
  allGroups: Group[]
  semesterMarkFor: (studentId: string) => number | null
}

function GroupCard({ group, memberIds, students, allGroups, semesterMarkFor }: GroupCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)

  async function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== group.name) await renameGroup(group.id, trimmed)
    setEditing(false)
  }

  const members = memberIds.map(id => students.find(s => s.id === id)).filter((s): s is Student => !!s)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 backdrop-blur-sm shadow-sm shadow-black/15"
      style={{ background: hexToRgba(group.color, 0.07), borderWidth: 1, borderStyle: 'solid', borderColor: hexToRgba(group.color, 0.35) }}
    >
      <div className="flex items-center justify-between gap-2 group/name">
        {editing ? (
          <input
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            className="bg-gray-900/60 border-b border-gray-500 text-base font-semibold text-gray-100 focus:outline-none min-w-0"
          />
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-base font-semibold text-gray-100 truncate">{group.name}</h3>
            <button
              onClick={() => { setDraft(group.name); setEditing(true) }}
              className="opacity-0 group-hover/name:opacity-100 p-1 rounded text-gray-400 hover:text-gray-100 transition-opacity shrink-0"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
        <span className="text-xs text-gray-400 shrink-0">{members.length} student{members.length === 1 ? '' : 's'}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {members.map(s => {
          const mark = semesterMarkFor(s.id)
          return (
            <div key={s.id} className="flex items-center gap-2.5 bg-gray-900/40 rounded-lg px-3 py-2">
              {s.photo ? (
                <img src={s.photo} alt={studentName(s)} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: hexToRgba(group.color, 0.22), color: group.color }}
                >
                  {initialsFor(s)}
                </div>
              )}
              <span className="text-sm text-gray-100 truncate flex-1 min-w-0">{studentName(s)}</span>
              <span className={`text-xs font-medium shrink-0 ${mark !== null ? gradeColor(mark) : 'text-gray-400/50'}`}>
                {mark !== null ? `${mark.toFixed(0)}%` : '—'}
              </span>
              {allGroups.length > 1 && (
                <select
                  value={group.id}
                  onChange={e => moveStudentToGroup(s.id, group.id, e.target.value)}
                  title="Move to another group"
                  className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-gray-200 shrink-0"
                >
                  {allGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GroupsTab({ project, students }: Props) {
  const groups = useGroups(project.id)
  const groupIds = groups.map(g => g.id)
  const allMembers = useGroupMembers(groupIds)
  const [showGenerate, setShowGenerate] = useState(false)

  // Class-wide data needed to show each member's semester mark so far.
  const classProjects = useProjects(project.classId)
  const classProjectIds = classProjects.map(p => p.id)
  const allMarks = useAllMarksForClass(classProjectIds)
  const allCriteria = useLiveQuery(
    () => classProjectIds.length > 0 ? db.criteria.where('projectId').anyOf(classProjectIds).toArray() : [],
    [classProjectIds.join(',')]
  ) ?? []
  const semesterMarkFor = (studentId: string) => calcStudentSemesterMark(studentId, classProjects, allMarks, allCriteria)

  if (!project.isGroupProject) {
    return (
      <div className="max-w-lg py-6 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-gray-100">
          <Users size={18} />
          <p className="text-sm font-medium">This project isn't marked as a group project yet.</p>
        </div>
        <p className="text-sm text-gray-400/70">
          Mark it as a group project to randomly split the roster into groups for this project.
        </p>
        <Button variant="primary" onClick={() => updateProject(project.id, { isGroupProject: true })}>
          Mark as Group Project
        </Button>
      </div>
    )
  }

  if (students.length === 0) {
    return <p className="text-sm text-gray-400/70 py-4">Add students to this class first to generate groups.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => setShowGenerate(true)}>
          <Shuffle size={14} /> {groups.length > 0 ? 'Regenerate Groups' : 'Generate Groups'}
        </Button>
        {groups.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => { if (confirm('Clear all groups for this project?')) clearGroups(project.id) }}
          >
            <RotateCcw size={14} /> Clear Groups
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400/70">No groups yet. Click Generate Groups to randomly split the roster.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => (
            <GroupCard
              key={g.id}
              group={g}
              memberIds={allMembers.filter(m => m.groupId === g.id).map(m => m.studentId)}
              students={students}
              allGroups={groups}
              semesterMarkFor={semesterMarkFor}
            />
          ))}
        </div>
      )}

      <GenerateGroupsModal open={showGenerate} onClose={() => setShowGenerate(false)} projectId={project.id} students={students} />
    </div>
  )
}
