import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, BookmarkPlus, LayoutTemplate, BookOpen, ChevronRight } from 'lucide-react'
import type { RubricCriterion, RubricDescriptor, DescriptorLevel } from '../../types'
import { updateCriterion, deleteCriterion, bulkAddCriteria, reorderCriteria } from '../../db/hooks/useCriteria'
import { updateProject } from '../../db/hooks/useProjects'
import { useProjectDescriptors, setDescriptor } from '../../db/hooks/useDescriptors'
import { saveTemplate } from '../../db/hooks/useTemplates'
import { RubricTemplatePickerModal } from './RubricTemplatePickerModal'
import { Input, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { LEVELS } from '../../utils/levels'

// ─── Step 1: Criterion row ─────────────────────────────────────────────────

function CriterionRow({
  c,
  index,
  total,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  c: RubricCriterion
  index: number
  total: number
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed rounded"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed rounded"
          >
            <ArrowDown size={12} />
          </button>
        </div>
        <span className="flex-1 text-sm font-medium text-gray-200 truncate min-w-0">
          {c.name || <span className="text-gray-500 italic">Criterion {index + 1}</span>}
        </span>
        <span className="text-xs text-gray-500 shrink-0 tabular-nums">
          {c.maxMarks} pts · {Math.round(c.weight * 100)}%
        </span>
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
            placeholder={`Criterion ${index + 1}`}
          />
          <Textarea
            label="Description (shown in marking grid)"
            value={c.description}
            onChange={e => updateCriterion(c.id, { description: e.target.value })}
            placeholder="Brief description or learning outcome…"
            rows={2}
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

// ─── Step 2: Level row per criterion ──────────────────────────────────────

function LevelRow({
  criterionId,
  maxMarks,
  levelId,
  label,
  defaultScore,
  dotColor,
  descriptor,
}: {
  criterionId: string
  maxMarks: number
  levelId: DescriptorLevel
  label: string
  defaultScore: number
  dotColor: string
  descriptor: RubricDescriptor | undefined
}) {
  const [text, setText] = useState(descriptor?.text ?? '')
  const [scorePct, setScorePct] = useState(
    descriptor?.score !== undefined
      ? Math.round(descriptor.score * 100)
      : Math.round(defaultScore * 100)
  )
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && descriptor) {
      setText(descriptor.text)
      setScorePct(descriptor.score !== undefined
        ? Math.round(descriptor.score * 100)
        : Math.round(defaultScore * 100)
      )
      initialized.current = true
    }
  }, [descriptor, defaultScore])

  function save() {
    setDescriptor(criterionId, levelId, text, scorePct / 100)
  }

  return (
    <div className="px-3 py-2.5 flex gap-3 items-start border-b border-gray-700 last:border-0">
      <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', dotColor)} />
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-200">{label}</span>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <input
              type="number" min="0" max="100"
              value={scorePct}
              onChange={e => setScorePct(parseInt(e.target.value) || 0)}
              onBlur={save}
              className="w-14 text-xs text-center bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-gray-200 focus:outline-none focus:border-gray-500"
            />
            <span className="text-xs text-gray-500">%</span>
            <span className="text-xs text-gray-600">
              = {Math.round(maxMarks * scorePct / 100)} pts
            </span>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={save}
          placeholder={`What does this look like for this criterion?`}
          rows={2}
        />
      </div>
    </div>
  )
}

// ─── Step 2: Full level wizard ─────────────────────────────────────────────

function PerformanceLevelEditor({
  criteria,
  descriptorsByCriterion,
}: {
  criteria: RubricCriterion[]
  descriptorsByCriterion: Record<string, RubricDescriptor[]>
}) {
  return (
    <div className="flex-1" style={{ overflow: 'hidden' }}>
      <div className="overflow-y-auto p-4 flex flex-col gap-3" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <p className="text-xs text-gray-500">
          Define what each performance level means for every criterion.
          Scores auto-fill when you use these levels in the marking grid.
        </p>
        {criteria.map(c => (
          <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg">
            <div className="px-3 py-2 flex items-center justify-between bg-gray-750 border-b border-gray-700 rounded-t-lg">
              <span className="text-sm font-medium text-gray-100">
                {c.name || <span className="italic text-gray-500">Unnamed criterion</span>}
              </span>
              <span className="text-xs text-gray-500 tabular-nums">
                {c.maxMarks} pts · {Math.round(c.weight * 100)}%
              </span>
            </div>
            {LEVELS.map(level => (
              <LevelRow
                key={level.id}
                criterionId={c.id}
                maxMarks={c.maxMarks}
                levelId={level.id}
                label={level.label}
                defaultScore={level.defaultScore}
                dotColor={level.dotColor}
                descriptor={(descriptorsByCriterion[c.id] ?? []).find(d => d.level === level.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main RubricBuilder ────────────────────────────────────────────────────

interface Props {
  projectId: string
  criteria: RubricCriterion[]
  projectName: string
}

export function RubricBuilder({ projectId, criteria, projectName: _projectName }: Props) {
  const descriptors = useProjectDescriptors(projectId)
  const [step, setStep] = useState<1 | 2>(1)
  const [criteriaCount, setCriteriaCount] = useState(4)
  const [starting, setStarting] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)
  const totalWeightPct = Math.round(totalWeight * 100)
  const weightOk = totalWeightPct === 100

  const descriptorsByCriterion = descriptors.reduce<Record<string, RubricDescriptor[]>>((acc, d) => {
    if (!acc[d.criterionId]) acc[d.criterionId] = []
    acc[d.criterionId].push(d)
    return acc
  }, {})

  const hasDescriptors = descriptors.some(d => d.text.trim().length > 0)

  async function handleStart() {
    setStarting(true)
    const evenWeight = 1 / criteriaCount
    const items = Array.from({ length: criteriaCount }, (_, i) => ({
      name: `Criterion ${i + 1}`,
      description: '',
      maxMarks: 10,
      weight: evenWeight,
    }))
    await bulkAddCriteria(projectId, items)
    await updateProject(projectId, { totalMarks: criteriaCount * 10 })
    setStarting(false)
  }

  async function handleDelete(c: RubricCriterion) {
    await deleteCriterion(c.id)
    const newTotal = criteria.filter(x => x.id !== c.id).reduce((s, x) => s + x.maxMarks, 0)
    await updateProject(projectId, { totalMarks: newTotal })
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return
    const newOrder = [...criteria]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    await reorderCriteria(newOrder.map(c => c.id))
  }

  async function handleMoveDown(index: number) {
    if (index === criteria.length - 1) return
    const newOrder = [...criteria]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    await reorderCriteria(newOrder.map(c => c.id))
  }

  async function handleDistributeEvenly() {
    const n = criteria.length
    if (n === 0) return
    const even = 1 / n
    await Promise.all(criteria.map(c => updateCriterion(c.id, { weight: even })))
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return
    const items = criteria.map(c => ({
      name: c.name,
      description: c.description,
      maxMarks: c.maxMarks,
      weight: c.weight,
    }))
    await saveTemplate(templateName.trim(), items)
    setTemplateName('')
    setSavingTemplate(false)
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (criteria.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-0">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-sm w-full flex flex-col gap-5 items-center text-center">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
            <BookOpen size={22} className="text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-100 mb-1">Build your rubric</h2>
            <p className="text-sm text-gray-400">How many criteria does this project have?</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCriteriaCount(v => Math.max(1, v - 1))}
              className="w-9 h-9 rounded-lg bg-gray-750 border border-gray-700 text-gray-300 hover:bg-gray-700 flex items-center justify-center text-lg font-bold"
            >
              −
            </button>
            <span className="text-3xl font-bold text-gray-100 w-8 text-center tabular-nums">
              {criteriaCount}
            </span>
            <button
              onClick={() => setCriteriaCount(v => Math.min(12, v + 1))}
              className="w-9 h-9 rounded-lg bg-gray-750 border border-gray-700 text-gray-300 hover:bg-gray-700 flex items-center justify-center text-lg font-bold"
            >
              +
            </button>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button
              variant="primary"
              className="w-full justify-center"
              disabled={starting}
              onClick={handleStart}
            >
              {starting ? 'Creating…' : 'Start building'}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-center"
              onClick={() => setTemplatePickerOpen(true)}
            >
              <LayoutTemplate size={14} /> Apply a template instead
            </Button>
          </div>
        </div>
        <RubricTemplatePickerModal
          open={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
          projectId={projectId}
          existingCount={0}
        />
      </div>
    )
  }

  // ── Two-step layout ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Left column */}
      <div className="w-1/2 flex flex-col border-r border-gray-800 overflow-hidden">

        {/* Step tabs */}
        <div className="shrink-0 flex border-b border-gray-800">
          <button
            onClick={() => setStep(1)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
              step === 1
                ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-950/10'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <span className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
              step === 1 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
            )}>1</span>
            Criteria
          </button>
          <button
            onClick={() => setStep(2)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
              step === 2
                ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-950/10'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <span className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
              step === 2 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
            )}>2</span>
            Performance Levels
          </button>
        </div>

        {/* Step 1 — Criteria list */}
        {step === 1 && (
          <>
            <div className="flex-1" style={{ overflow: 'hidden' }}>
              <div className="overflow-y-auto p-4 flex flex-col gap-2" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {criteria.map((c, i) => (
                  <CriterionRow
                    key={c.id}
                    c={c}
                    index={i}
                    total={criteria.length}
                    onDelete={() => handleDelete(c)}
                    onMoveUp={() => handleMoveUp(i)}
                    onMoveDown={() => handleMoveDown(i)}
                  />
                ))}
              </div>
            </div>

            {/* Weight banner */}
            <div className={cn(
              'shrink-0 px-4 py-2.5 border-t border-gray-800 flex items-center gap-3',
              weightOk ? 'bg-emerald-950/30' : totalWeightPct > 100 ? 'bg-red-950/30' : 'bg-amber-950/30'
            )}>
              <span className={cn(
                'text-xs font-semibold',
                weightOk ? 'text-emerald-400' : totalWeightPct > 100 ? 'text-red-400' : 'text-amber-400'
              )}>
                {totalWeightPct}% allocated
              </span>
              {!weightOk && (
                <span className="text-xs text-gray-500">
                  {totalWeightPct < 100
                    ? `— ${100 - totalWeightPct}% remaining`
                    : `— ${totalWeightPct - 100}% over`}
                </span>
              )}
              <div className="flex-1" />
              <Button size="sm" variant="ghost" onClick={handleDistributeEvenly} className="text-xs py-1">
                Distribute evenly
              </Button>
            </div>

            {/* Action bar */}
            <div className="shrink-0 px-4 py-2.5 border-t border-gray-800 flex items-center gap-2">
              {savingTemplate ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus
                    placeholder="Template name…"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveTemplate()
                      if (e.key === 'Escape') setSavingTemplate(false)
                    }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-500"
                  />
                  <Button size="sm" variant="primary" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSavingTemplate(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setSavingTemplate(true)}>
                    <BookmarkPlus size={14} /> Save as template
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTemplatePickerOpen(true)}>
                    <LayoutTemplate size={14} /> Apply template
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => setStep(2)} className="text-orange-400 hover:text-orange-300">
                    Performance Levels <ChevronRight size={14} />
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {/* Step 2 — Performance level editor */}
        {step === 2 && (
          <PerformanceLevelEditor
            criteria={criteria}
            descriptorsByCriterion={descriptorsByCriterion}
          />
        )}
      </div>

      {/* Right column: live preview */}
      <div className="w-1/2 overflow-hidden">
      <div className="h-full overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview</h3>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            weightOk ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
          )}>
            {totalWeightPct}% allocated
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="text-left px-3 py-2 text-gray-400 font-medium">Criterion</th>
                <th className="text-left px-3 py-2 text-gray-400 font-medium">Description</th>
                <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Marks</th>
                <th className="text-right px-3 py-2 text-gray-400 font-medium">Wt</th>
                {hasDescriptors && LEVELS.map(l => (
                  <th key={l.id} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                    <span className={l.textColor}>{l.shortLabel}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, i) => {
                const cdesc = descriptorsByCriterion[c.id] ?? []
                return (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}>
                    <td className="px-3 py-2 text-gray-200 font-medium align-top">
                      {c.name || <span className="text-gray-500 italic">Criterion {i + 1}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400 align-top">{c.description}</td>
                    <td className="px-3 py-2 text-gray-300 text-right align-top tabular-nums">{c.maxMarks}</td>
                    <td className="px-3 py-2 text-gray-300 text-right align-top tabular-nums">
                      {Math.round(c.weight * 100)}%
                    </td>
                    {hasDescriptors && LEVELS.map(l => {
                      const d = cdesc.find(x => x.level === l.id)
                      const pts = Math.round(c.maxMarks * (d?.score ?? l.defaultScore))
                      return (
                        <td key={l.id} className="px-3 py-2 align-top">
                          {d?.text ? (
                            <div>
                              <span className={cn('text-[10px] font-semibold tabular-nums', l.textColor)}>
                                {pts}pts
                              </span>
                              <p className="text-gray-400 mt-0.5">{d.text}</p>
                            </div>
                          ) : (
                            <span className={cn('text-[10px] tabular-nums', l.textColor)}>{pts}pts</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-800 border-t border-gray-700">
                <td colSpan={2} className="px-3 py-2 text-gray-400 font-medium">Total</td>
                <td className="px-3 py-2 text-gray-200 font-semibold text-right tabular-nums">
                  {criteria.reduce((s, c) => s + c.maxMarks, 0)}
                </td>
                <td className={cn(
                  'px-3 py-2 font-semibold text-right tabular-nums',
                  weightOk ? 'text-emerald-400' : 'text-amber-400'
                )}>
                  {totalWeightPct}%
                </td>
                {hasDescriptors && <td colSpan={LEVELS.length} />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </div>

      <RubricTemplatePickerModal
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        projectId={projectId}
        existingCount={criteria.length}
      />
    </div>
  )
}
