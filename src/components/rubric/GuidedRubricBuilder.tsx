import { useState } from 'react'
import { Sparkles, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { GuidedRubricAnswers, GeneratedCriterionWithDescriptors } from '../../utils/claude'
import { generateRubricFromAnswers } from '../../utils/claude'
import { bulkAddCriteria } from '../../db/hooks/useCriteria'
import { setDescriptor } from '../../db/hooks/useDescriptors'
import { updateProject } from '../../db/hooks/useProjects'
import { cn } from '../../utils/cn'
import { LEVELS } from '../../utils/levels'

// ─── CSS (matches tutorial animation tokens) ──────────────────────────────────

const GUIDED_CSS = `
  @keyframes g-btn-pulse {
    0%,100% { box-shadow: 0 4px 14px rgba(249,115,22,0.20); }
    50%      { box-shadow: 0 4px 28px rgba(249,115,22,0.55); }
  }
  .g-btn-next { animation: g-btn-pulse 2.0s ease-in-out infinite; }
`

// ─── Step data ────────────────────────────────────────────────────────────────

const STEP_META = [
  { icon: '📋', title: 'Tell me about this project.',         hint: 'A little context helps me write criteria that actually fit your assignment.' },
  { icon: '🎯', title: 'What do you care about?',            hint: 'These become your marking criteria. Pick 3–6 things that matter most.' },
  { icon: '💬', title: 'Describe good and bad.',             hint: "Use your own words — don't worry about rubric language. I'll translate it." },
  { icon: '✨', title: "Here's your rubric.",                hint: 'Expand any criterion to read the level descriptors. Import when you\'re happy.' },
]

const DISCIPLINES = [
  'Industrial Design', 'Product Design', 'Architecture',
  'Interior Design', 'Graphic Design', 'Fashion Design',
  'Fine Art', 'Engineering Design', 'Other',
]

const DELIVERABLES = [
  'Physical Model', 'Technical Drawings', 'Digital Renders',
  'Oral Presentation', 'Written Report', 'Working Prototype',
  'Portfolio', 'Process Journal', 'Video',
]

const FOCUS_AREAS = [
  'Concept Development', 'Technical Execution', 'Material Use',
  'Presentation Quality', 'Research & Process', 'Form & Aesthetics',
  'Innovation & Originality', 'Sustainability', 'User-Centred Design',
  'Communication', 'Craftsmanship', 'Problem Solving',
]

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
        active
          ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
      )}
    >
      {active && <Check size={11} className="inline mr-1.5 mb-0.5" />}
      {label}
    </button>
  )
}

// Matches the tutorial card header exactly: emoji box left, step pill right
function StepCard({ step, children }: { step: number; children: React.ReactNode }) {
  const meta = STEP_META[step - 1]
  return (
    <div className="bg-gray-850 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
      {/* Orange gradient bar — identical to tutorial */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, rgb(194,65,12), rgb(249,115,22), rgb(253,186,116))' }} />

      <div className="p-8">
        {/* Icon + counter row */}
        <div className="flex items-start justify-between mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/40 flex items-center justify-center text-4xl shadow-inner">
            {meta.icon}
          </div>
          <span className="text-xs text-gray-400 tabular-nums bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-full mt-1">
            {step} / 4
          </span>
        </div>

        {/* Title + hint */}
        <h2 className="text-2xl font-bold text-gray-100 leading-tight mb-3">{meta.title}</h2>
        <p className="text-base text-gray-400 leading-relaxed mb-8">{meta.hint}</p>

        {children}
      </div>
    </div>
  )
}

// ─── Step 1: Context ──────────────────────────────────────────────────────────

function Step1({ answers, onChange }: {
  answers: GuidedRubricAnswers
  onChange: (patch: Partial<GuidedRubricAnswers>) => void
}) {
  function toggleDeliverable(d: string) {
    const next = answers.deliverables.includes(d)
      ? answers.deliverables.filter(x => x !== d)
      : [...answers.deliverables, d]
    onChange({ deliverables: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project name</label>
        <input
          value={answers.projectName}
          onChange={e => onChange({ projectName: e.target.value })}
          placeholder="e.g. Flat-pack Furniture Brief"
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Discipline</label>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINES.map(d => (
            <Chip key={d} label={d} active={answers.discipline === d} onClick={() => onChange({ discipline: d })} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          What do students hand in or present?{' '}
          <span className="text-gray-500 normal-case font-normal">(pick all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DELIVERABLES.map(d => (
            <Chip key={d} label={d} active={answers.deliverables.includes(d)} onClick={() => toggleDeliverable(d)} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: What matters ─────────────────────────────────────────────────────

function Step2({ answers, onChange }: {
  answers: GuidedRubricAnswers
  onChange: (patch: Partial<GuidedRubricAnswers>) => void
}) {
  const [custom, setCustom] = useState('')

  function toggleArea(a: string) {
    const next = answers.focusAreas.includes(a)
      ? answers.focusAreas.filter(x => x !== a)
      : [...answers.focusAreas, a]
    onChange({ focusAreas: next })
  }

  function addCustom() {
    const trimmed = custom.trim()
    if (!trimmed || answers.focusAreas.includes(trimmed)) { setCustom(''); return }
    onChange({ focusAreas: [...answers.focusAreas, trimmed] })
    setCustom('')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {FOCUS_AREAS.map(a => (
          <Chip key={a} label={a} active={answers.focusAreas.includes(a)} onClick={() => toggleArea(a)} />
        ))}
        {answers.focusAreas.filter(a => !FOCUS_AREAS.includes(a)).map(a => (
          <Chip key={a} label={a} active onClick={() => toggleArea(a)} />
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          placeholder="Add your own…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!custom.trim()}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-100 text-sm font-medium rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      {answers.focusAreas.length > 0 && (
        <p className="text-sm text-gray-500">
          {answers.focusAreas.length} selected —{' '}
          {answers.focusAreas.length < 3
            ? 'try to pick at least 3'
            : answers.focusAreas.length > 6
            ? 'consider narrowing to 6 or fewer for a focused rubric'
            : 'good range ✓'}
        </p>
      )}
    </div>
  )
}

// ─── Step 3: Describe ─────────────────────────────────────────────────────────

function Step3({ answers, onChange }: {
  answers: GuidedRubricAnswers
  onChange: (patch: Partial<GuidedRubricAnswers>) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          What does a full-marks submission look like?
        </label>
        <p className="text-sm text-gray-500">Imagine your ideal student. What have they done that makes you want to give every mark?</p>
        <textarea
          value={answers.excellenceDescription}
          onChange={e => onChange({ excellenceDescription: e.target.value })}
          placeholder="e.g. The concept is bold and clearly resolved. The model is beautifully made and the material choice makes sense. They can explain every decision confidently."
          rows={4}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          What's the most common way students disappoint you?
        </label>
        <p className="text-sm text-gray-500">What do you keep writing the same feedback about every semester?</p>
        <textarea
          value={answers.failureDescription}
          onChange={e => onChange({ failureDescription: e.target.value })}
          placeholder="e.g. They go with the first idea and don't develop it. The model looks rushed. They can't explain why they made certain choices."
          rows={4}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Number of criteria</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChange({ criteriaCount: Math.max(3, answers.criteriaCount - 1) })}
              className="w-9 h-9 rounded-lg bg-gray-750 border border-gray-700 text-gray-100 hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition-colors"
            >−</button>
            <span className="text-3xl font-bold text-gray-100 w-8 text-center tabular-nums">{answers.criteriaCount}</span>
            <button
              type="button"
              onClick={() => onChange({ criteriaCount: Math.min(7, answers.criteriaCount + 1) })}
              className="w-9 h-9 rounded-lg bg-gray-750 border border-gray-700 text-gray-100 hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition-colors"
            >+</button>
          </div>
          <p className="text-sm text-gray-500">3–5 is ideal for most projects</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">What matters more?</label>
          <input
            type="range" min={0} max={100} step={10}
            value={answers.outcomeWeight}
            onChange={e => onChange({ outcomeWeight: parseInt(e.target.value) })}
            className="w-full accent-indigo-500 mt-1"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Process & research</span>
            <span>Final outcome</span>
          </div>
          <p className="text-sm text-indigo-400 font-medium text-center">
            {answers.outcomeWeight === 50
              ? 'Equal balance'
              : answers.outcomeWeight > 50
              ? `${answers.outcomeWeight}% outcome`
              : `${100 - answers.outcomeWeight}% process`}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function GeneratedCriterionCard({ c, index }: { c: GeneratedCriterionWithDescriptors; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-750 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100">{c.name}</p>
          <p className="text-xs text-gray-400 truncate">{c.description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
          <span className="tabular-nums">{c.maxMarks} pts</span>
          <span className="tabular-nums">{Math.round(c.weight * 100)}%</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700">
          {LEVELS.map(level => {
            const d = c.descriptors[level.id as keyof typeof c.descriptors]
            return (
              <div key={level.id} className="flex gap-3 px-4 py-3 border-b border-gray-700/50 last:border-0">
                <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', level.dotColor)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold mb-1', level.textColor)}>
                    {level.label} — {Math.round(c.maxMarks * d.score)} pts
                  </p>
                  <p className="text-sm text-gray-400 leading-relaxed">{d.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Step4Review({ criteria, error }: {
  criteria: GeneratedCriterionWithDescriptors[]
  error: string | null
}) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle size={22} className="text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-100 mb-1">Generation failed</p>
          <p className="text-base text-gray-400 leading-relaxed max-w-sm">{error}</p>
        </div>
      </div>
    )
  }

  const total = criteria.reduce((s, c) => s + c.maxMarks, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-gray-400 px-1 mb-1">
        <span>{criteria.length} criteria</span>
        <span className={cn('font-medium', total === 100 ? 'text-emerald-400' : 'text-amber-400')}>
          {total} total marks
        </span>
      </div>
      {criteria.map((c, i) => (
        <GeneratedCriterionCard key={i} c={c} index={i} />
      ))}
    </div>
  )
}

// ─── Generating screen ────────────────────────────────────────────────────────

function GeneratingScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/40 flex items-center justify-center text-4xl shadow-inner">
        <Sparkles size={28} className="text-indigo-400 animate-pulse" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-100 mb-3">Building your rubric…</p>
        <p className="text-base text-gray-400 leading-relaxed">
          Reading your answers and writing the criteria and descriptors.
        </p>
        <p className="text-sm text-gray-500 mt-2">This takes about 10–15 seconds.</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  projectId: string
  projectName: string
  onDone: () => void
  onCancel: () => void
}

const EMPTY_ANSWERS: GuidedRubricAnswers = {
  projectName: '',
  discipline: '',
  deliverables: [],
  focusAreas: [],
  excellenceDescription: '',
  failureDescription: '',
  criteriaCount: 4,
  outcomeWeight: 60,
}

export function GuidedRubricBuilder({ projectId, projectName, onDone, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [answers, setAnswers] = useState<GuidedRubricAnswers>({ ...EMPTY_ANSWERS, projectName })
  const [generated, setGenerated] = useState<GeneratedCriterionWithDescriptors[]>([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)
  const [importing, setImporting]   = useState(false)

  function patch(p: Partial<GuidedRubricAnswers>) {
    setAnswers(prev => ({ ...prev, ...p }))
  }

  function canAdvance(): boolean {
    if (step === 1) return !!answers.discipline && answers.deliverables.length > 0
    if (step === 2) return answers.focusAreas.length >= 2
    return true
  }

  async function advance() {
    if (step < 3) { setStep((step + 1) as 1 | 2 | 3 | 4); return }
    if (step === 3) {
      setStep(4)
      setGenerating(true)
      setGenError(null)
      try {
        setGenerated(await generateRubricFromAnswers(answers))
      } catch (err) {
        setGenError(err instanceof Error ? err.message : 'Something went wrong. Check your API key is set in .env.local.')
      } finally {
        setGenerating(false)
      }
    }
  }

  async function handleImport() {
    if (generated.length === 0) return
    setImporting(true)
    try {
      const criteriaData = generated.map(c => ({
        name: c.name, description: c.description, maxMarks: c.maxMarks, weight: c.weight,
      }))
      const saved = await bulkAddCriteria(projectId, criteriaData)
      await updateProject(projectId, { totalMarks: generated.reduce((s, c) => s + c.maxMarks, 0) })
      for (let i = 0; i < generated.length; i++) {
        const { descriptors } = generated[i]
        await Promise.all([
          setDescriptor(saved[i].id, 'excellent',    descriptors.excellent.text,    descriptors.excellent.score),
          setDescriptor(saved[i].id, 'good',         descriptors.good.text,         descriptors.good.score),
          setDescriptor(saved[i].id, 'satisfactory', descriptors.satisfactory.text, descriptors.satisfactory.score),
          setDescriptor(saved[i].id, 'poor',         descriptors.poor.text,         descriptors.poor.score),
        ])
      }
      onDone()
    } catch (err) {
      alert('Import failed: ' + String(err))
    } finally {
      setImporting(false)
    }
  }

  const isLast = step === 4
  const showBack = step > 1 && !generating

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GUIDED_CSS }} />

      <div className="flex flex-col h-full overflow-hidden">

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <StepCard step={step} key={step}>
              {step === 1 && <Step1 answers={answers} onChange={patch} />}
              {step === 2 && <Step2 answers={answers} onChange={patch} />}
              {step === 3 && <Step3 answers={answers} onChange={patch} />}
              {step === 4 && (generating ? <GeneratingScreen /> : <Step4Review criteria={generated} error={genError} />)}
            </StepCard>
          </div>
        </div>

        {/* Footer — matches tutorial button + dot style exactly */}
        <div className="shrink-0 border-t border-gray-700 px-8 py-5 flex items-center gap-3">

          {/* Back / Cancel */}
          {showBack ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-gray-100 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-gray-100 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600"
            >
              Cancel
            </button>
          )}

          <div className="flex-1" />

          {/* Progress dots — tutorial style */}
          <div className="flex items-center gap-2">
            {([1, 2, 3, 4] as const).map(s => (
              <div
                key={s}
                className={cn(
                  'rounded-full transition-all duration-300',
                  s === step    ? 'w-8 h-2.5 bg-gray-100'
                  : s < step   ? 'w-2.5 h-2.5 bg-gray-500'
                                : 'w-2.5 h-2.5 bg-gray-700'
                )}
              />
            ))}
          </div>

          <div className="flex-1" />

          {/* Primary action */}
          {!isLast && !generating && (
            <button
              type="button"
              onClick={advance}
              disabled={!canAdvance()}
              className={cn(
                'g-btn-next px-8 py-2.5 rounded-xl text-sm font-bold transition-colors',
                canAdvance()
                  ? 'bg-gray-100 hover:bg-gray-100/90 text-gray-900'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              )}
            >
              {step === 3 ? '✨  Generate rubric' : 'Next  →'}
            </button>
          )}

          {isLast && !generating && generated.length > 0 && !genError && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="g-btn-next px-8 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-100/90 text-gray-900 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing…' : '✓  Import this rubric'}
            </button>
          )}

          {isLast && !generating && genError && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-8 py-2.5 rounded-xl text-sm font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-600 transition-all"
            >
              ← Try again
            </button>
          )}
        </div>
      </div>
    </>
  )
}
