import { useState, useRef } from 'react'
import { Plus, Trash2, Upload, Loader2, Pencil, Check, X } from 'lucide-react'
import type { RubricCriterion } from '../../types'
import {
  useCompetencies,
  useAllCriterionCompetenciesForProject,
  addCompetency,
  updateCompetency,
  deleteCompetency,
  bulkAddCompetencies,
  toggleCriterionCompetency,
} from '../../db/hooks/useCompetencies'
import { parseCompetenciesFromFile } from '../../utils/parseCompetencies'
import { cn } from '../../utils/cn'

interface Props {
  projectId: string
  criteria: RubricCriterion[]
}

export function CompetencyTab({ projectId, criteria }: Props) {
  const competencies    = useCompetencies(projectId)
  const criterionComps  = useAllCriterionCompetenciesForProject(criteria.map(c => c.id))
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editName, setEditName]     = useState('')
  const [editDesc, setEditDesc]     = useState('')
  const [newName, setNewName]       = useState('')
  const [newDesc, setNewDesc]       = useState('')
  const [adding, setAdding]         = useState(false)
  const [dragging, setDragging]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function isMapped(criterionId: string, competencyId: string) {
    return criterionComps.some(r => r.criterionId === criterionId && r.competencyId === competencyId)
  }

  async function extractFromFile(file: File) {
    setExtracting(true); setExtractError(null)
    try {
      const result = await parseCompetenciesFromFile(file)
      if (!result.ok) { setExtractError(result.error); return }
      await bulkAddCompetencies(projectId, result.competencies)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtracting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleExtract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) extractFromFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) extractFromFile(file)
  }

  function startEdit(c: { id: string; name: string; description: string }) {
    setEditingId(c.id); setEditName(c.name); setEditDesc(c.description)
  }

  async function saveEdit() {
    if (editingId) await updateCompetency(editingId, { name: editName, description: editDesc })
    setEditingId(null)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    await addCompetency(projectId, newName.trim(), newDesc.trim(), competencies.length)
    setNewName(''); setNewDesc(''); setAdding(false)
  }

  return (
    <div
      className={cn('overflow-y-auto p-6 flex flex-col gap-6 relative transition-colors', dragging && 'bg-indigo-950/10')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-indigo-500 rounded-2xl px-12 py-8 flex flex-col items-center gap-3 bg-gray-900/90 shadow-xl">
            <Upload size={28} className="text-indigo-400" />
            <p className="text-sm font-semibold text-indigo-300">Drop course outline to extract competencies</p>
            <p className="text-xs text-indigo-400/70">PDF, Word (.docx), or plain text</p>
          </div>
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-100">Program Competencies</p>
          <p className="text-xs text-gray-400 mt-0.5">Map your rubric criteria to institutional learning outcomes</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleExtract} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {extracting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {extracting ? 'Extracting…' : 'Import from doc'}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition-colors"
          >
            <Plus size={12} />
            Add manually
          </button>
        </div>
      </div>

      {extractError && (
        <div className="flex items-start justify-between gap-3 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-red-300 mb-0.5">Import failed</p>
            <p className="text-xs text-red-400/80">{extractError}</p>
            <p className="text-xs text-gray-500 mt-1">Try a different file, or add competencies manually using the button above.</p>
          </div>
          <button onClick={() => setExtractError(null)} className="text-red-500 hover:text-red-300 shrink-0 mt-0.5">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Competency name"
            autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-400" />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-400" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100">Cancel</button>
            <button onClick={handleAdd} disabled={!newName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-900/60 text-indigo-300 hover:bg-indigo-900 disabled:opacity-40 transition-colors">
              Add
            </button>
          </div>
        </div>
      )}

      {competencies.length === 0 && !adding ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center">
            <Upload size={20} className="text-gray-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300 mb-1">No competencies yet</p>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
              Competencies are your institution's learning outcomes — map them to criteria to track achievement across projects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition-colors"
            >
              <Upload size={12} /> Import from course outline
            </button>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition-colors"
            >
              <Plus size={12} /> Add manually
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Competency list + mapping matrix */}
          <div className="flex flex-col gap-3">
            {competencies.map(comp => (
              <div key={comp.id} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">

                {/* Competency header */}
                <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-700/50">
                  {editingId === comp.id ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                        className="bg-gray-900 border border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-gray-400" />
                      <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-gray-400" />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="p-1 rounded text-emerald-400 hover:bg-emerald-900/30"><Check size={13} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-700"><X size={13} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-100">{comp.name}</p>
                      {comp.description && <p className="text-xs text-gray-400 mt-0.5">{comp.description}</p>}
                    </div>
                  )}
                  {editingId !== comp.id && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(comp)} className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => deleteCompetency(comp.id)} className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>

                {/* Criteria mapping checkboxes */}
                <div className="px-4 py-2.5 flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold text-gray-400/70 uppercase tracking-wider mb-1">Mapped criteria</p>
                  {criteria.map(c => {
                    const mapped = isMapped(c.id, comp.id)
                    return (
                      <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group">
                        <input type="checkbox" checked={mapped}
                          onChange={() => toggleCriterionCompetency(c.id, comp.id)}
                          className="accent-indigo-400 w-3.5 h-3.5" />
                        <span className={cn('text-xs transition-colors', mapped ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-300')}>
                          {c.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
