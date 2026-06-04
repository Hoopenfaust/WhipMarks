import { useState } from 'react'
import { X, Download, Users } from 'lucide-react'
import type { Project, RubricCriterion, RubricDescriptor, Student, TaAssignmentFile } from '../../types'
import { downloadTaAssignment } from '../../utils/taExport'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface Props {
  project: Project
  className: string
  students: Student[]
  criteria: RubricCriterion[]
  descriptors: RubricDescriptor[]
  onClose: () => void
}

export function TaAssignModal({ project, className, students, criteria, descriptors, onClose }: Props) {
  const [taName, setTaName]     = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(students.map(s => s.id)))
  const allSelected = selected.size === students.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(students.map(s => s.id)))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exportAssignment() {
    if (!taName.trim() || selected.size === 0) return
    const assignedStudents = students
      .filter(s => selected.has(s.id))
      .map(s => ({ id: s.id, name: s.name, firstName: s.firstName }))

    const file: TaAssignmentFile = {
      version:     1,
      projectId:   project.id,
      projectName: project.name,
      className,
      taName:      taName.trim(),
      students:    assignedStudents,
      criteria,
      descriptors,
      exportedAt:  Date.now(),
    }
    downloadTaAssignment(file)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-850 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Assign to TA</h2>
            <p className="text-xs text-gray-400 mt-0.5">{project.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* TA name */}
          <Input
            label="TA name"
            placeholder="e.g. Sarah Chen"
            value={taName}
            onChange={e => setTaName(e.target.value)}
            autoFocus
          />

          {/* Student selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Students to assign</label>
              <button
                onClick={toggleAll}
                className="text-xs text-gray-400 hover:text-gray-100 transition-colors"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="border border-gray-700 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              {students.map((s, i) => {
                const checked = selected.has(s.id)
                const displayName = s.firstName ? `${s.firstName} ${s.name}` : s.name
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-gray-800 ${i > 0 ? 'border-t border-gray-700/50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                      className="accent-orange-400"
                    />
                    <span className="text-sm text-gray-100">{displayName}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-400/70 mt-1.5">
              <Users size={11} className="inline mr-1" />
              {selected.size} of {students.length} students selected
            </p>
          </div>

          {/* Info note */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-xs text-gray-400 leading-relaxed">
            The TA will receive a <code className="text-gray-300">.whipmarks-ta</code> file containing the rubric and assigned students — no marks included. They mark blind and send back a results file for you to review.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={exportAssignment}
            disabled={!taName.trim() || selected.size === 0}
          >
            <Download size={14} />
            Export Assignment
          </Button>
        </div>
      </div>
    </div>
  )
}
