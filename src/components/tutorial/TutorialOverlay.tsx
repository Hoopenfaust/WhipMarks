import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '../../utils/cn'

// ── Types ──────────────────────────────────────────────────────────────────────

type Placement = 'center' | 'below' | 'left' | 'right'

interface TutorialStep {
  icon: string
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
    icon: '🎓',
    title: 'Welcome to GradeDesk',
    body: "Let's take a quick tour so you can start marking in minutes. We'll cover adding your class, creating a project, building a rubric, and marking students.",
    target: null,
    placement: 'center',
  },
  {
    icon: '📂',
    title: 'Import your class list',
    body: "Click the Import button highlighted above to load a CSV or Excel file with your students' names — or drag the file directly onto the page. GradeDesk detects the name columns automatically.",
    target: 'import-btn',
    placement: 'below',
    navHint: 'the Classes page',
  },
  {
    icon: '👥',
    title: 'Open your class',
    body: 'Once imported, your class appears as a card. Click it to open the roster where you can view all students, track individual progress, and add notes.',
    target: 'class-card',
    placement: 'below',
    navHint: 'the Classes page',
  },
  {
    icon: '📋',
    title: 'Navigate to Projects',
    body: 'Projects are the assignments you grade — essays, presentations, portfolios. Click the Projects tab to see and manage assignments for this class.',
    target: 'projects-tab',
    placement: 'below',
    navHint: 'a class detail page',
  },
  {
    icon: '✏️',
    title: 'Create a new project',
    body: "Click New Project to add an assignment. Give it a name and set how much it counts toward the final semester grade — you'll land directly on the rubric builder.",
    target: 'new-project-btn',
    placement: 'left',
    navHint: 'the Projects tab inside a class',
  },
  {
    icon: '📐',
    title: 'Build your rubric',
    body: 'Choose how many criteria to grade on — Research, Craft, Presentation, etc. Set marks and weights for each, and add performance descriptors to guide consistent marking. The preview updates live.',
    target: 'rubric-criteria',
    placement: 'right',
    navHint: 'the Build Rubric tab inside a project',
  },
  {
    icon: '📊',
    title: 'Mark your students',
    body: 'Switch to the Marking Grid — every student down the left, every criterion across the top. Click any cell to enter a score and leave feedback. Completed students show a colour-coded grade.',
    target: 'marking-grid-tab',
    placement: 'below',
    navHint: 'a project page',
  },
  {
    icon: '⚡',
    title: 'Quick Mark mode',
    body: 'For rapid grading, hit Quick Mark to focus on one student at a time. Use ← → arrow keys to move between students — great for marking while students present their work in class.',
    target: 'quick-mark-btn',
    placement: 'left',
    navHint: 'the Marking Grid tab inside a project',
  },
  {
    icon: '🎉',
    title: "You're ready to mark!",
    body: 'Your data saves automatically — no account or internet required. Back up your grades any time with the Save Backup button. Restart this tour at any time from the ? button in the sidebar.',
    target: null,
    placement: 'center',
  },
]

const TOTAL = STEPS.length
const STORAGE_DONE = 'gradedesk-tutorial-done'
const STORAGE_STEP = 'gradedesk-tutorial-step'

const PAD        = 10    // spotlight padding around target element
const TOOLTIP_W  = 560   // card width (≈ double the old 320px)
const TOOLTIP_GAP = 20   // gap between spotlight edge and card
const TOOLTIP_H_EST = 340 // estimated card height for clamping

// ── CSS keyframes (injected once into the document) ────────────────────────────

const TUTORIAL_CSS = `
  /* Card spring entrance */
  @keyframes t-slide-in {
    from { opacity: 0; transform: scale(0.92) translateY(14px); }
    to   { opacity: 1; transform: scale(1)    translateY(0);    }
  }

  /* Expanding "ping" rings emanating from spotlight */
  @keyframes t-ping {
    0%   { transform: scale(1);   opacity: 0.80; }
    100% { transform: scale(2.1); opacity: 0;    }
  }

  /* Spotlight orange glow pulse */
  @keyframes t-glow {
    0%, 100% {
      box-shadow:
        0 0 0 9999px rgba(0,0,0,0.68),
        0 0 0 2px  rgba(249,115,22,0.50),
        0 0 18px 4px rgba(249,115,22,0.20);
    }
    50% {
      box-shadow:
        0 0 0 9999px rgba(0,0,0,0.68),
        0 0 0 3px  rgba(249,115,22,0.95),
        0 0 30px 9px rgba(249,115,22,0.48);
    }
  }

  /* Bouncing directional arrows */
  @keyframes t-arr-up    { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-10px)} }
  @keyframes t-arr-right { 0%,100%{transform:translateX(0)}   50%{transform:translateX( 10px)} }
  @keyframes t-arr-left  { 0%,100%{transform:translateX(0)}   50%{transform:translateX(-10px)} }

  /* Next button glow pulse */
  @keyframes t-btn-pulse {
    0%,100% { box-shadow: 0 4px 14px rgba(249,115,22,0.30); }
    50%      { box-shadow: 0 4px 28px rgba(249,115,22,0.75); }
  }

  .t-card      { animation: t-slide-in  0.40s cubic-bezier(0.34, 1.38, 0.64, 1) both; }
  .t-spot      { animation: t-glow      2.2s  ease-in-out infinite; }
  .t-ping      { animation: t-ping      2.0s  ease-out    infinite; }
  .t-ping2     { animation: t-ping      2.0s  ease-out    0.80s infinite; }
  .t-arr-up    { animation: t-arr-up    1.15s ease-in-out infinite; }
  .t-arr-right { animation: t-arr-right 1.15s ease-in-out infinite; }
  .t-arr-left  { animation: t-arr-left  1.15s ease-in-out infinite; }
  .t-btn-next  { animation: t-btn-pulse 2.0s  ease-in-out infinite; }
`

// ── Component ─────────────────────────────────────────────────────────────────

export function TutorialOverlay() {
  const [active, setActive]           = useState(false)
  const [stepIdx, setStepIdx]         = useState(0)
  const [spotlight, setSpotlight]     = useState<SpotlightRect | null>(null)
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

  // Persist step
  useEffect(() => {
    if (active) localStorage.setItem(STORAGE_STEP, String(stepIdx))
  }, [stepIdx, active])

  const step = STEPS[stepIdx]

  // ── Spotlight tracking ────────────────────────────────────────────────────

  const measureTarget = useCallback(() => {
    if (!step?.target) {
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
      top:    r.top    - PAD,
      left:   r.left   - PAD,
      width:  r.width  + PAD * 2,
      height: r.height + PAD * 2,
    })
  }, [step])

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
  function next() { if (stepIdx < TOTAL - 1) setStepIdx(i => i + 1); else finish() }
  function prev() { if (stepIdx > 0) setStepIdx(i => i - 1) }

  if (!active) return null

  // ── Tooltip positioning ───────────────────────────────────────────────────

  const vw = window.innerWidth
  const vh = window.innerHeight
  const isCenter = step.placement === 'center' || !spotlight || targetMissing

  let wrapStyle: React.CSSProperties = {}
  let arrowDir: 'up' | 'right' | 'left' | null = null

  if (isCenter) {
    wrapStyle = {
      position:  'fixed',
      top:       '50%',
      left:      '50%',
      transform: 'translate(-50%, -50%)',
      width:     TOOLTIP_W,
      zIndex:    10002,
    }
  } else {
    const { top, left, width, height } = spotlight!
    let t = 0, l = 0

    if (step.placement === 'below') {
      t = top + height + TOOLTIP_GAP
      l = left + width / 2 - TOOLTIP_W / 2   // centre under spotlight
      arrowDir = 'up'
    } else if (step.placement === 'left') {
      t = top + height / 2 - TOOLTIP_H_EST / 2
      l = left - TOOLTIP_W - TOOLTIP_GAP
      arrowDir = 'right'
    } else if (step.placement === 'right') {
      t = top + height / 2 - TOOLTIP_H_EST / 2
      l = left + width + TOOLTIP_GAP
      arrowDir = 'left'
    }

    l = Math.max(8, Math.min(l, vw - TOOLTIP_W - 8))
    t = Math.max(8, Math.min(t, vh - TOOLTIP_H_EST - 8))

    wrapStyle = {
      position: 'fixed',
      top: t,
      left: l,
      width: TOOLTIP_W,
      zIndex: 10002,
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inject CSS once */}
      <style dangerouslySetInnerHTML={{ __html: TUTORIAL_CSS }} />

      {/* ── Spotlight elements (only when target found) ── */}
      {spotlight && !targetMissing && (
        <>
          {/* Main spotlight: transparent hole + pulsing dark overlay + orange glow */}
          <div
            className="t-spot"
            style={{
              position:     'fixed',
              top:          spotlight.top,
              left:         spotlight.left,
              width:        spotlight.width,
              height:       spotlight.height,
              borderRadius: 12,
              zIndex:       10000,
              pointerEvents: 'none',
            }}
          />

          {/* Ping ring 1 — expands immediately */}
          <div
            className="t-ping"
            style={{
              position:     'fixed',
              top:          spotlight.top,
              left:         spotlight.left,
              width:        spotlight.width,
              height:       spotlight.height,
              borderRadius: 12,
              border:       '2px solid rgba(249,115,22,0.75)',
              zIndex:       10001,
              pointerEvents: 'none',
            }}
          />

          {/* Ping ring 2 — 0.8 s delayed for staggered look */}
          <div
            className="t-ping2"
            style={{
              position:     'fixed',
              top:          spotlight.top,
              left:         spotlight.left,
              width:        spotlight.width,
              height:       spotlight.height,
              borderRadius: 12,
              border:       '2px solid rgba(249,115,22,0.50)',
              zIndex:       10001,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* ── Dark backdrop for centred steps ── */}
      {isCenter && (
        <div
          style={{
            position:           'fixed',
            inset:              0,
            background:         'rgba(0,0,0,0.72)',
            backdropFilter:     'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            zIndex:             10000,
            pointerEvents:      'none',
          }}
        />
      )}

      {/* ── Tooltip wrapper — fixed position, containing block for arrows ── */}
      {/* key forces remount (re-triggers card animation) on every step change */}
      <div style={wrapStyle} key={stepIdx}>

        {/* Bouncing arrow ↑ — tooltip is below spotlight */}
        {arrowDir === 'up' && (
          <div style={{ position: 'absolute', top: -46, left: '50%', transform: 'translateX(-50%)' }}>
            <div
              className="t-arr-up"
              style={{ color: 'rgb(249,115,22)', fontSize: 32, lineHeight: 1,
                       filter: 'drop-shadow(0 0 8px rgba(249,115,22,0.8))' }}
            >↑</div>
          </div>
        )}

        {/* Bouncing arrow → — tooltip is left of spotlight */}
        {arrowDir === 'right' && (
          <div style={{ position: 'absolute', right: -50, top: '50%', transform: 'translateY(-50%)' }}>
            <div
              className="t-arr-right"
              style={{ color: 'rgb(249,115,22)', fontSize: 32, lineHeight: 1,
                       filter: 'drop-shadow(0 0 8px rgba(249,115,22,0.8))' }}
            >→</div>
          </div>
        )}

        {/* Bouncing arrow ← — tooltip is right of spotlight */}
        {arrowDir === 'left' && (
          <div style={{ position: 'absolute', left: -50, top: '50%', transform: 'translateY(-50%)' }}>
            <div
              className="t-arr-left"
              style={{ color: 'rgb(249,115,22)', fontSize: 32, lineHeight: 1,
                       filter: 'drop-shadow(0 0 8px rgba(249,115,22,0.8))' }}
            >←</div>
          </div>
        )}

        {/* ── Card ── */}
        <div
          className="t-card bg-gray-850 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Orange accent bar */}
          <div
            style={{
              height:     4,
              background: 'linear-gradient(90deg, rgb(194,65,12), rgb(249,115,22), rgb(253,186,116))',
            }}
          />

          <div className="p-8">
            {/* Icon + step counter */}
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-950/60 border border-orange-900/40 flex items-center justify-center text-4xl shadow-inner">
                {step.icon}
              </div>
              <span className="text-xs text-gray-500 tabular-nums bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-full mt-1">
                {stepIdx + 1} / {TOTAL}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-100 leading-tight mb-3">
              {step.title}
            </h2>

            {/* Body */}
            <p className="text-base text-gray-400 leading-relaxed">
              {step.body}
            </p>

            {/* Nav hint — when target element not visible yet */}
            {targetMissing && step.navHint && (
              <div className="mt-5 flex items-start gap-3 bg-amber-950/25 border border-amber-900/50 rounded-xl px-4 py-4">
                <span className="text-xl shrink-0 mt-0.5">📍</span>
                <div>
                  <p className="text-sm font-semibold text-amber-200 mb-1">Navigate first</p>
                  <p className="text-sm text-amber-300/80 leading-relaxed">
                    Go to <strong className="text-amber-100">{step.navHint}</strong> and the highlighted element will appear automatically.
                  </p>
                </div>
              </div>
            )}

            {/* Progress dots — clickable to jump to any step */}
            <div className="flex items-center gap-2 mt-8 mb-7">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStepIdx(i)}
                  title={s.title}
                  className={cn(
                    'rounded-full transition-all duration-300 hover:scale-125',
                    i === stepIdx
                      ? 'w-8 h-2.5 bg-orange-500'
                      : i < stepIdx
                      ? 'w-2.5 h-2.5 bg-orange-800 hover:bg-orange-600'
                      : 'w-2.5 h-2.5 bg-gray-700 hover:bg-gray-500'
                  )}
                />
              ))}
            </div>

            {/* Button row */}
            <div className="flex items-center gap-3">
              <button
                onClick={prev}
                disabled={stepIdx === 0}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                  stepIdx === 0
                    ? 'text-gray-700 cursor-not-allowed'
                    : 'text-gray-400 hover:text-gray-100 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600'
                )}
              >
                ← Back
              </button>

              <div className="flex-1" />

              <button
                onClick={finish}
                className="text-sm text-gray-600 hover:text-gray-400 transition-colors px-2"
              >
                Skip tour
              </button>

              <button
                onClick={next}
                className="t-btn-next px-8 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold transition-colors"
              >
                {stepIdx === TOTAL - 1 ? '🎉  Finish' : 'Next  →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
