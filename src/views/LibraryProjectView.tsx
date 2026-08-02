import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, GripVertical, BookOpen, Sparkles, Upload } from 'lucide-react'
import {
  useLibraryProject,
  useLibraryProjectCriteria,
  useLibraryProjectDescriptors,
  updateLibraryProject,
  addLibraryProjectCriterion,
  updateLibraryProjectCriterion,
  deleteLibraryProjectCriterion,
  setLibraryDescriptor,
  clearLibraryProjectCriteria,
} from '../db/hooks/useLibraryProjects'
import { useClasses } from '../db/hooks/useClasses'
import { createProject } from '../db/hooks/useProjects'
import { bulkAddCriteria } from '../db/hooks/useCriteria'
import { setDescriptor } from '../db/hooks/useDescriptors'
import { GuidedRubricBuilder } from '../components/rubric/GuidedRubricBuilder'
import type { LibraryProjectCriterion, LibraryDescriptor, DescriptorLevel } from '../types'
import { generateRubricFromDocument } from '../utils/claude'
import type { GeneratedCriterionWithDescriptors } from '../utils/claude'
import { LEVELS } from '../utils/levels'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

// Inline editable text that looks like a heading until clicked
function EditableHeading({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.select() }, [editing])

  function commit() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== value) onChange(draft.trim())
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        className={`bg-transparent border-b border-indigo-500 outline-none ${className}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value) } }}
      />
    )
  }
  return (
    <span className={`cursor-pointer hover:text-indigo-300 transition-colors ${className}`} onClick={() => setEditing(true)} title="Click to edit">
      {value}
    </span>
  )
}

function CriterionRow({
  c,
  descriptors,
  onDelete,
  onUpdate,
  onSetDescriptor,
}: {
  c: LibraryProjectCriterion
  descriptors: LibraryDescriptor[]
  onDelete: () => void
  onUpdate: (data: Partial<Pick<LibraryProjectCriterion, 'name' | 'description' | 'maxMarks' | 'weight'>>) => void
  onSetDescriptor: (level: DescriptorLevel, text: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical size={16} className="text-gray-600 shrink-0 cursor-grab" />
        <input
          className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 outline-none"
          value={c.name}
          placeholder="Criterion name"
          onChange={e => onUpdate({ name: e.target.value })}
        />
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-100 outline-none focus:border-indigo-500 text-right"
              value={c.maxMarks}
              onChange={e => onUpdate({ maxMarks: parseFloat(e.target.value) || 0 })}
              title="Max marks"
            />
            <span className="text-xs text-gray-500">marks</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.1"
              className="w-14 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-100 outline-none focus:border-indigo-500 text-right"
              value={c.weight}
              onChange={e => onUpdate({ weight: parseFloat(e.target.value) || 0 })}
              title="Weight"
            />
            <span className="text-xs text-gray-500">wt</span>
          </div>
          <button
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-colors text-xs"
            onClick={() => setExpanded(x => !x)}
            title="Descriptors"
          >
            {expanded ? '▲' : '▼'}
          </button>
          <button
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-700/60 transition-colors"
            onClick={onDelete}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-700/60">
          <div className="px-4 py-3 border-b border-gray-700/40">
            <textarea
              className="w-full bg-gray-750 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder:text-gray-600 outline-none focus:border-indigo-500 resize-none"
              rows={2}
              placeholder="Description (optional)"
              value={c.description}
              onChange={e => onUpdate({ description: e.target.value })}
            />
          </div>
          <div className="divide-y divide-gray-700/40">
            {LEVELS.map(level => {
              const d = descriptors.find(x => x.level === level.id)
              return (
                <div key={level.id} className="flex gap-3 px-4 py-3">
                  <div className={`mt-2.5 w-2 h-2 rounded-full shrink-0 ${level.dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1.5 ${level.textColor}`}>{level.label}</p>
                    <textarea
                      className="w-full bg-gray-750 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder:text-gray-600 outline-none focus:border-indigo-500 resize-none"
                      rows={2}
                      placeholder={`Describe ${level.shortLabel.toLowerCase()} performance…`}
                      value={d?.text ?? ''}
                      onChange={e => onSetDescriptor(level.id, e.target.value)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function LibraryProjectView() {
  const { libraryProjectId } = useParams<{ libraryProjectId: string }>()
  const navigate = useNavigate()
  const project = useLibraryProject(libraryProjectId)
  const criteria = useLibraryProjectCriteria(libraryProjectId)
  const allDescriptors = useLibraryProjectDescriptors(libraryProjectId)
  const classes = useClasses()

  const [attachOpen, setAttachOpen] = useState(false)
  const [attachClassId, setAttachClassId] = useState('')
  const [attachDueDate, setAttachDueDate] = useState('')
  const [attachWeight, setAttachWeight] = useState('20')
  const [attachStartDate, setAttachStartDate] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [showAiBuilder, setShowAiBuilder] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  // Debounced updates
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleSave(data: Parameters<typeof updateLibraryProject>[1]) {
    if (!libraryProjectId) return
    setSaveState('saving')
    if (updateTimer.current) clearTimeout(updateTimer.current)
    updateTimer.current = setTimeout(async () => {
      await updateLibraryProject(libraryProjectId, data)
      setSaveState('saved')
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaveState('idle'), 2000)
    }, 400)
  }

  async function handleAddCriterion() {
    if (!libraryProjectId) return
    await addLibraryProjectCriterion(libraryProjectId, '', criteria.length)
  }

  async function handleAiImport(generated: GeneratedCriterionWithDescriptors[]) {
    if (!libraryProjectId) return
    await clearLibraryProjectCriteria(libraryProjectId)
    for (const [i, c] of generated.entries()) {
      const criterion = await addLibraryProjectCriterion(libraryProjectId, c.name, i)
      await updateLibraryProjectCriterion(criterion.id, {
        description: c.description,
        maxMarks: c.maxMarks,
        weight: c.weight,
      })
      const { descriptors } = c
      await Promise.all([
        setLibraryDescriptor(criterion.id, 'excellent',    descriptors.excellent.text,    descriptors.excellent.score),
        setLibraryDescriptor(criterion.id, 'good',         descriptors.good.text,         descriptors.good.score),
        setLibraryDescriptor(criterion.id, 'satisfactory', descriptors.satisfactory.text, descriptors.satisfactory.score),
        setLibraryDescriptor(criterion.id, 'poor',         descriptors.poor.text,         descriptors.poor.score),
      ])
    }
    await updateLibraryProject(libraryProjectId, { totalMarks: generated.reduce((s, c) => s + c.maxMarks, 0) })
  }

  async function handleUpload(file: File) {
    if (!libraryProjectId) return
    setExtracting(true)
    setExtractError(null)
    try {
      const data = await file.arrayBuffer()
      // file.type can be empty on Tauri drag-and-drop — fall back to extension
      const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
      const generated = await generateRubricFromDocument(data, mimeType)
      await handleAiImport(generated)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  async function handleAttach() {
    if (!libraryProjectId || !project || !attachClassId || !attachDueDate) return
    setAttaching(true)
    try {
      const weight = Math.max(0, Math.min(1, parseFloat(attachWeight) / 100 || 0))
      const p = await createProject({
        classId: attachClassId,
        name: project.name,
        dueDate: attachDueDate,
        startDate: attachStartDate || undefined,
        semesterWeight: weight,
        totalMarks: project.totalMarks,
      })
      if (criteria.length > 0) {
        const saved = await bulkAddCriteria(p.id, criteria.map(c => ({
          name: c.name,
          description: c.description,
          maxMarks: c.maxMarks,
          weight: c.weight,
        })))
        // Copy descriptors
        for (let i = 0; i < criteria.length; i++) {
          const cDescriptors = allDescriptors.filter(d => d.libraryCriterionId === criteria[i].id)
          for (const d of cDescriptors) {
            await setDescriptor(saved[i].id, d.level, d.text, d.score)
          }
        }
      }
      setAttachOpen(false)
      navigate(`/classes/${attachClassId}/projects/${p.id}`)
    } finally {
      setAttaching(false)
    }
  }

  if (showAiBuilder && libraryProjectId && project) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-gray-950">
        <GuidedRubricBuilder
          projectId={libraryProjectId}
          projectName={project.name}
          onImport={handleAiImport}
          onDone={() => setShowAiBuilder(false)}
          onCancel={() => setShowAiBuilder(false)}
        />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Project not found.
      </div>
    )
  }

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0)
  const weightOk = Math.abs(totalWeight - criteria.length) < 0.01 || criteria.length === 0

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-gray-950 relative"
      onDragEnter={e => { e.preventDefault(); dragCounter.current++; setDragOver(true) }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setDragOver(false) }}
      onDrop={e => { e.preventDefault(); dragCounter.current = 0; setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
    >
      {dragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gray-950/90 border-2 border-dashed border-indigo-500 rounded-none pointer-events-none">
          <Upload size={32} className="text-indigo-400" />
          <span className="text-sm font-medium text-indigo-300">Drop brief to upload</span>
        </div>
      )}
      {/* Header */}
      <div className="h-16 flex items-center gap-4 px-8 border-b border-gray-800 shrink-0">
        <button
          onClick={() => navigate('/library')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <EditableHeading
          value={project.name}
          onChange={name => scheduleSave({ name })}
          className="text-lg font-semibold text-gray-100"
        />
        <div className="flex-1" />
        {saveState !== 'idle' && (
          <span className={`text-xs transition-colors ${saveState === 'saved' ? 'text-emerald-400' : 'text-gray-500'}`}>
            {saveState === 'saved' ? 'Saved' : 'Saving…'}
          </span>
        )}
        <input
          ref={uploadRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <Button variant="ghost" onClick={() => setShowAiBuilder(true)}>
          <Sparkles size={15} className="mr-1" />
          Build with AI
        </Button>
        <Button variant="primary" onClick={() => { setAttachClassId(classes[0]?.id ?? ''); setAttachOpen(true) }}>
          <BookOpen size={15} className="mr-1" />
          Add to Class
        </Button>
      </div>

      {extractError && (
        <div className="px-8 py-3 bg-red-950/40 border-b border-red-900/50 text-sm text-red-400 flex items-center justify-between">
          <span>{extractError}</span>
          <button onClick={() => setExtractError(null)} className="text-red-600 hover:text-red-300 ml-4">✕</button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          {/* Meta */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Total marks:</span>
              <input
                type="number"
                min="1"
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-sm text-gray-100 outline-none focus:border-indigo-500 text-center"
                defaultValue={project.totalMarks}
                onBlur={e => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v > 0) scheduleSave({ totalMarks: v })
                }}
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-400">Description:</span>
              <input
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-sm text-gray-300 placeholder:text-gray-600 outline-none focus:border-indigo-500"
                placeholder="Optional"
                defaultValue={project.description ?? ''}
                onBlur={e => scheduleSave({ description: e.target.value || undefined })}
              />
            </div>
          </div>

          {/* Criteria */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-300">Criteria</h2>
              {criteria.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  weightOk ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'
                }`}>
                  Total weight: {totalWeight.toFixed(2)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {criteria.map(c => (
                <CriterionRow
                  key={c.id}
                  c={c}
                  descriptors={allDescriptors.filter(d => d.libraryCriterionId === c.id)}
                  onDelete={() => deleteLibraryProjectCriterion(c.id)}
                  onUpdate={data => updateLibraryProjectCriterion(c.id, data)}
                  onSetDescriptor={(level, text) => setLibraryDescriptor(c.id, level, text)}
                />
              ))}
            </div>

            <button
              onClick={handleAddCriterion}
              className="mt-3 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors w-full px-4 py-2.5 border border-dashed border-gray-700 rounded-xl hover:border-gray-500"
            >
              <Plus size={15} />
              Add criterion
            </button>
          </div>

          {/* Brief drop zone */}
          <div
            onClick={() => uploadRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-colors group"
          >
            <Upload size={28} className="text-gray-600 group-hover:text-indigo-400 transition-colors" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-400 group-hover:text-indigo-300 transition-colors">
                {extracting ? 'Reading brief…' : 'Drop project brief here'}
              </p>
              <p className="text-xs text-gray-600 mt-1">PDF or image · auto-builds the rubric with AI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attach to class modal */}
      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title="Add to Class">
        <div className="flex flex-col gap-4">
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400">No classes yet. Create a class first.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Class</label>
                <select
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-500"
                  value={attachClassId}
                  onChange={e => setAttachClassId(e.target.value)}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start date (optional)"
                  type="date"
                  value={attachStartDate}
                  onChange={e => setAttachStartDate(e.target.value)}
                />
                <Input
                  label="Due date"
                  type="date"
                  value={attachDueDate}
                  onChange={e => setAttachDueDate(e.target.value)}
                />
              </div>
              <Input
                label="Semester weight (%)"
                type="number"
                min="0"
                max="100"
                value={attachWeight}
                onChange={e => setAttachWeight(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setAttachOpen(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleAttach}
                  disabled={!attachClassId || !attachDueDate || attaching}
                >
                  {attaching ? 'Adding…' : 'Add to Class'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
