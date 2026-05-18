import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '../../utils/cn'

// ── Types ──────────────────────────────────────────────────────────────────────

type Placement = 'center' | 'below' | 'left' | 'right'

interface TutorialStep {
  title: string
  body: string
  target: string | null   // data-tutorial attribute value, or null for centered
  placement: Placement
  navHint?: string        // shown when target not found on current page
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

// ── Step definitions ───────────────────────────────────────────────────────────

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to GradeDesk',
    body: "Let's take a quick tour so you can start marking in minutes. We'll cover adding your class, creating a project, building a rubric, and marking students.",
    target: null,
    placement: 'center',
  },
  {
    title: 'Import your class list',
    body: "Click Import to load a CSV or Excel file with your students' names — or drag the file directly onto the page. GradeDesk will detect the name columns automatically.",
    target: 'import-btn',
    placement: 'below',
    navHint: 'Classes page',
  },
  {
    title: 'Open your class',
    body: 'Once imported, your class appears here. Click it to open the roster where you can view all students, upload photos, and track individual progress.',
    target: 'class-card',
    placement: 'below',
    navHint: 'Classes page',
  },
  {
    title: 'Create a project',
    body: 'Projects are the assignments you grade — an essay, a presentation, a design portfolio. Switch to the Projects tab to add one.',
    target: 'projects-tab',
    placement: 'below',
    navHint: 'a class detail page',
  },
  {
    title: 'Add a project',
    body: 'Click New Project to create an assignment. Give it a name, set a due date, and choose how much it counts toward the final semester grade.',
    target: 'new-project-btn',
    placement: 'left',
    navHint: 'the Projects tab inside a class',
  },
  {
    title: 'Build your rubric',
    body: 'Start by choosing how many criteria to grade on — e.g. Research, Craft, Presentation. Set the marks and weight for each. The preview on the right updates live.',
    target: 'rubric-criteria',
    placement: 'right',
    navHint: 'the Build Rubric tab inside a project',
  },
  {
    title: 'Mark your students',
    body: 'Switch to the Marking Grid — every student down the left, every criterion across the top. Click any cell to enter a score and leave feedback.',
    target: 'marking-grid-tab',
    placement: 'below',
    navHint: 'a project page',
  },
  {
    title: 'Quick Mark mode',
    body: 'For rapid grading, hit Quick Mark to focus on one student at a time. Use the ← → arrow keys to move between students. Great for marking while students present.',
    target: 'quick-mark-btn',
    placement: 'left',
    navHint: 'the Marking Grid tab inside a project',
  },
  {
    title: "You're ready to mark! 🎉",
    body: 'Your data saves automatically — no account or internet needed. Double-click a student card to see their full profile, notes, and progress chart.',
    target: null,
    placement: 'center',
  },
]

const TOTAL = STEPS.length
const STORAGE_DONE = 'gradedesk-tutorial-done'
const STORAGE_STEP = 'gradedesk-tutorial-step'

// ── Padding around spotlight ───────────────────────────────────────────────────

const PAD = 8
const TOOLTIP_W = 320   // w-80 = 320px
const TOOLTIP_GAP = 12  // gap between spotlight and tooltip

// ── TutorialOverlay ───────────────────────────────────────────────────────────

export function TutorialOverlay() {
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [targetMissing, setTargetMissing] = useState(false)
  const rafRef = useRef<number | null>(null)

  // On mount: decide whether to show
  useEffect(() => {
    if (localStorage.getItem(STORAGE_DONE) === 'true') return
    const saved = parseInt(localStorage.getItem(STORAGE_STEP) ?? '0', 10)
    const idx = isNaN(saved) || saved >= TOTAL ? 0 : saved
    setStepIdx(idx)
    setActive(true)
  }, [])

  // Persist step to localStorage whenever it changes
  useEffect(() => {
    if (active) localStorage.setItem(STORAGE_STEP, String(stepIdx))
  }, [stepIdx, active])

  const step = STEPS[stepIdx]

  // ── Spotlight positioning ─────────────────────────────────────────────────

  const measureTarget = useCallback(() => {
    if (!step || !step.target) {
      setSpotlight(null)
      setTargetMissing(false)
      return
    }
    const el = document.querySelector(`[data-tutorial="${step.target}"]`)
    if (!el) {
      setSpotlight(null)
      setTargetMissing(true)
      return
    }
    const r = el.getBoundingClientRect()
    setTargetMissing(false)
    setSpotlight({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    })
  }, [step])

  // RAF loop while overlay is active
  useEffect(() => {
    if (!active) return
    let running = true
    function tick() {
      if (!running) return
      measureTarget()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [active, measureTarget])

  // ── Actions ───────────────────────────────────────────────────────────────

  function finish() {
    setActive(false)
    localStorage.setItem(STORAGE_DONE, 'true')
    localStorage.removeItem(STORAGE_STEP)
  }

  function skip() { finish() }

  function next() {
    if (stepIdx < TOTAL - 1) setStepIdx(i => i + 1)
    else finish()
  }

  function prev() {
    if (stepIdx > 0) setStepIdx(i => i - 1)
  }

  if (!active) return null

  // ── Tooltip position calculation ──────────────────────────────────────────

  const vw = window.innerWidth
  const vh = window.innerHeight
  const TOOLTIP_H_EST = 200  // rough estimate; clamp keeps it in view

  let tooltipStyle: React.CSSProperties = {}
  const isCenter = step.placement === 'center' || !spotlight || targetMissing

  if (isCenter) {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: TOOLTIP_W,
      zIndex: 10001,
    }
  } else {
    const { top, left, width, height } = spotlight
    let t = 0, l = 0

    if (step.placement === 'below') {
      t = top + height + TOOLTIP_GAP
      l = left
    } else if (step.placement === 'left') {
      t = top
      l = left - TOOLTIP_W - TOOLTIP_GAP
    } else if (step.placement === 'right') {
      t = top
      l = left + width + TOOLTIP_GAP
    }

    // Clamp to viewport
    l = Math.max(8, Math.min(l, vw - TOOLTIP_W - 8))
    t = Math.max(8, Math.min(t, vh - TOOLTIP_H_EST - 8))

    tooltipStyle = {
      position: 'fixed',
      top: t,
      left: l,
      width: TOOLTIP_W,
      zIndex: 10001,
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Full-screen non-blocking backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />

      {/* Spotlight overlay — only when we have a real target rect */}
      {spotlight && !targetMissing && (
        <div
          style={{
            position: 'fixed',
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Dark overlay for centered steps (no spotlight) */}
      {isCenter && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip card */}
      <div style={tooltipStyle}>
        <div
          className="bg-gray-850 border border-gray-700 rounded-xl shadow-2xl p-5"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Step indicator */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1" />
            <span className="text-xs text-gray-500 shrink-0 tabular-nums">
              Step {stepIdx + 1} of {TOTAL}
            </span>
          </div>

          {/* Title */}
          <p className="text-base font-semibold text-gray-100 leading-snug">
            {step.title}
          </p>

          {/* Body */}
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            {step.body}
          </p>

          {/* Target-not-found notice */}
          {targetMissing && step.navHint && (
            <p className="text-xs text-amber-400/80 mt-2 leading-relaxed bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
              Navigate to {step.navHint} to see this in context.
            </p>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4 mb-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === stepIdx
                    ? 'w-4 h-2 bg-orange-500'
                    : i < stepIdx
                    ? 'w-2 h-2 bg-gray-600'
                    : 'w-2 h-2 bg-gray-800'
                )}
              />
            ))}
          </div>

          {/* Button row */}
          <div className="flex items-center gap-2 mt-1">
            {/* Back */}
            <button
              onClick={prev}
              disabled={stepIdx === 0}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                stepIdx === 0
                  ? 'text-gray-700 cursor-not-allowed'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )}
            >
              ← Back
            </button>

            {/* Spacer + skip */}
            <div className="flex-1" />
            <button
              onClick={skip}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Skip tour
            </button>

            {/* Next / Finish */}
            <button
              onClick={next}
              className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-colors"
            >
              {stepIdx === TOTAL - 1 ? 'Finish' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
