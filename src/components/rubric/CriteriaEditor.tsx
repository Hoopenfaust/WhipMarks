import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, FileSpreadsheet } from 'lucide-react'
import type { RubricCriterion } from '../../types'
import { addCriterion, updateCriterion, deleteCriterion, reorderCriteria } from '../../db/hooks/useCriteria'
import { updateProject } from '../../db/hooks/useProjects'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { XlsxRubricImportModal } from './XlsxRubricImportModal'

function CriterionRow({
  c,
  onDelete,
}: {
  c: RubricCriterion
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: c.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [expanded, setExpanded] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={16} />
        </button>
        <span className="flex-1 text-sm font-medium text-gray-200 truncate">{c.name || 'Untitled criterion'}</span>
        <Badge variant="default" className="shrink-0">{c.maxMarks} pts</Badge>
        <Badge variant="orange" className="shrink-0">{Math.round(c.weight * 100)}%</Badge>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1 text-gray-500 hover:text-gray-300 rounded"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-600 hover:text-red-400 rounded"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 px-3 py-3 flex flex-col gap-3">
          <Input
            label="Criterion name"
            value={c.name}
            onChange={e => updateCriterion(c.id, { name: e.target.value })}
          />
          <Input
            label="Description (shown in marking grid)"
            value={c.description}
            onChange={e => updateCriterion(c.id, { description: e.target.value })}
          />
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">Max marks</label>
              <input
                type="number" min="1" step="1"
                value={c.maxMarks}
                onChange={e => updateCriterion(c.id, { maxMarks: parseInt(e.target.value) || 1 })}
                className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">Weight (%)</label>
              <input
                type="number" min="0" max="100" step="5"
                value={Math.round(c.weight * 100)}
                onChange={e => updateCriterion(c.id, { weight: (parseInt(e.target.value) || 0) / 100 })}
                className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  projectId: string
  criteria: RubricCriterion[]
  generating?: boolean
  onRequestGenerate?: () => void
}

export function CriteriaEditor({ projectId, criteria, generating, onRequestGenerate }: Props) {
  const [adding, setAdding] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMax, setNewMax] = useState('10')
  const [newWeight, setNewWeight] = useState('0')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const totalWeight = Math.round(criteria.reduce((s, c) => s + c.weight, 0) * 100)
  const weightOk = totalWeight === 100

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = criteria.findIndex(c => c.id === active.id)
    const newIndex = criteria.findIndex(c => c.id === over.id)
    const newOrder = [...criteria]
    newOrder.splice(newIndex, 0, newOrder.splice(oldIndex, 1)[0])
    await reorderCriteria(newOrder.map(c => c.id))
  }

  async function handleAdd() {
    if (!newName.trim()) return
    const maxMarks = parseInt(newMax) || 10
    await addCriterion({
      projectId,
      name: newName.trim(),
      description: '',
      maxMarks,
      weight: (parseInt(newWeight) || 0) / 100,
      sortIndex: criteria.length,
    })
    // Update project totalMarks
    const total = criteria.reduce((s, c) => s + c.maxMarks, 0) + maxMarks
    await updateProject(projectId, { totalMarks: total })
    setNewName('')
    setNewMax('10')
    setNewWeight('0')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    const c = criteria.find(x => x.id === id)
    await deleteCriterion(id)
    if (c) {
      const total = criteria.filter(x => x.id !== id).reduce((s, x) => s + x.maxMarks, 0)
      await updateProject(projectId, { totalMarks: total })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Criteria</h3>
        <div className="flex items-center gap-2">
          {criteria.length > 0 && (
            <Badge variant={weightOk ? 'success' : 'warning'}>
              Weights: {totalWeight}%{!weightOk && ` (${totalWeight < 100 ? 100 - totalWeight + '% unallocated' : totalWeight - 100 + '% over'})`}
            </Badge>
          )}
          {onRequestGenerate && (
            <Button size="sm" variant="ghost" onClick={onRequestGenerate} disabled={generating}>
              {generating ? <Spinner size={14} /> : <Sparkles size={14} />}
              {generating ? 'Generating…' : criteria.length > 0 ? 'Re-generate' : 'Generate'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)} disabled={generating}>
            <FileSpreadsheet size={14} /> Import
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(v => !v)} disabled={generating}>
            <Plus size={14} /> Add
          </Button>
        </div>
      </div>

      {generating && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
          <Spinner size={24} />
          <p className="text-sm">Reading document and building rubric…</p>
        </div>
      )}

      {adding && (
        <div className="bg-gray-800 border border-orange-800/50 rounded-lg p-3 flex flex-col gap-3">
          <Input
            label="Name"
            placeholder="e.g. Research Quality"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">Max marks</label>
              <input type="number" min="1" value={newMax} onChange={e => setNewMax(e.target.value)}
                className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">Weight (%)</label>
              <input type="number" min="0" max="100" step="5" value={newWeight} onChange={e => setNewWeight(e.target.value)}
                className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={handleAdd} disabled={!newName.trim()}>Add Criterion</Button>
          </div>
        </div>
      )}

      {criteria.length === 0 && !adding && (
        <p className="text-sm text-gray-600 py-4 text-center">No criteria yet. Add one to start building your rubric.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={criteria.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {criteria.map(c => (
              <CriterionRow key={c.id} c={c} onDelete={() => handleDelete(c.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {importOpen && (
        <XlsxRubricImportModal
          projectId={projectId}
          existingCount={criteria.length}
          onDone={() => setImportOpen(false)}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  )
}
