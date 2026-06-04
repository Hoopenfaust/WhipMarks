import { useState, useEffect } from 'react'
import { cn } from '../../utils/cn'

// Reuse the same CSS animations already injected by TutorialOverlay.
// If TutorialOverlay hasn't run (TA machine), inject them here.
const TA_CSS = `
  @keyframes ta-slide-in {
    from { opacity: 0; transform: scale(0.92) translateY(14px); }
    to   { opacity: 1; transform: scale(1)    translateY(0);    }
  }
  @keyframes ta-btn-pulse {
    0%,100% { box-shadow: 0 4px 14px rgba(249,115,22,0.30); }
    50%      { box-shadow: 0 4px 28px rgba(249,115,22,0.75); }
  }
  .ta-card     { animation: ta-slide-in  0.40s cubic-bezier(0.34, 1.38, 0.64, 1) both; }
  .ta-btn-next { animation: ta-btn-pulse 2.0s  ease-in-out infinite; }
`

interface Step {
  icon: string
  title: string
  body: (ctx: { projectName: string; taName: string; studentCount: number }) => string
}

const STEPS: Step[] = [
  {
    icon: '📋',
    title: "You've been assigned marking",
    body: ({ projectName, taName, studentCount }) =>
      `You're marking as ${taName} for the project "${projectName}". You have ${studentCount} student${studentCount !== 1 ? 's' : ''} to assess. This tour covers everything you need — it takes about a minute.`,
  },
  {
    icon: '🖱️',
    title: 'Click any cell to mark',
    body: () =>
      'Each row is a student, each column is a criterion. Click a cell to open the scoring panel — choose a level to auto-fill a score, or type your own. Leave detailed written feedback or hit Dictate to speak your comments hands-free.',
  },
  {
    icon: '✅',
    title: 'Work through all students',
    body: () =>
      'A green tick appears next to each student once all their criteria are marked. Use Tab to move to the next cell, or Shift+Tab to go back. Your progress saves automatically — you can close the app and continue later.',
  },
  {
    icon: '📤',
    title: "Export when you're done",
    body: () =>
      `The Export Results button at the top unlocks once every student is fully marked. It downloads a file — send that back to your teacher. They review your marks alongside theirs and make the final call. You mark blind so your judgement is independent.`,
  },
]

const TOTAL = STEPS.length

function storageKey(projectId: string) {
  return `gradedesk-ta-tutorial-done-${projectId}`
}

interface Props {
  projectId: string
  projectName: string
  taName: string
  studentCount: number
}

export function TaTutorialOverlay({ projectId, projectName, taName, studentCount }: Props) {
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    if (localStorage.getItem(storageKey(projectId)) === 'true') return
    setActive(true)
  }, [projectId])

  function finish() {
    localStorage.setItem(storageKey(projectId), 'true')
    setActive(false)
  }

  function next() {
    if (stepIdx < TOTAL - 1) setStepIdx(i => i + 1)
    else finish()
  }

  function prev() {
    if (stepIdx > 0) setStepIdx(i => i - 1)
  }

  if (!active) return null

  const step = STEPS[stepIdx]
  const ctx  = { projectName, taName, studentCount }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TA_CSS }} />

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Card */}
        <div
          key={stepIdx}
          className="ta-card bg-gray-850 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: 520, pointerEvents: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Orange accent bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, rgb(194,65,12), rgb(249,115,22), rgb(253,186,116))' }} />

          {/* TA Mode badge */}
          <div className="flex items-center gap-2 px-8 pt-6 pb-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: '#1a0f00', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
              TA Mode
            </div>
          </div>

          <div className="p-8 pt-5">
            {/* Icon + counter */}
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gray-800/60 border border-gray-700/40 flex items-center justify-center text-3xl shadow-inner">
                {step.icon}
              </div>
              <span className="text-xs text-gray-400 tabular-nums bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-full mt-1">
                {stepIdx + 1} / {TOTAL}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-100 leading-tight mb-3">
              {step.title}
            </h2>

            {/* Body */}
            <p className="text-sm text-gray-400 leading-relaxed">
              {step.body(ctx)}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-2 mt-7 mb-6">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIdx(i)}
                  className={cn(
                    'rounded-full transition-all duration-300 hover:scale-125',
                    i === stepIdx
                      ? 'w-7 h-2 bg-gray-100'
                      : i < stepIdx
                      ? 'w-2 h-2 bg-gray-600 hover:bg-gray-100/80'
                      : 'w-2 h-2 bg-gray-700'
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
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  stepIdx === 0
                    ? 'text-gray-400/40 cursor-not-allowed'
                    : 'text-gray-400 hover:text-gray-100 bg-gray-800 hover:bg-gray-750 border border-gray-700'
                )}
              >
                ← Back
              </button>

              <div className="flex-1" />

              <button onClick={finish} className="text-sm text-gray-400/60 hover:text-gray-400 transition-colors px-2">
                Skip
              </button>

              <button
                onClick={next}
                className="ta-btn-next px-7 py-2 rounded-xl bg-gray-100 hover:bg-gray-100/90 text-gray-900 text-sm font-bold transition-colors"
              >
                {stepIdx === TOTAL - 1 ? "Let's go →" : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
