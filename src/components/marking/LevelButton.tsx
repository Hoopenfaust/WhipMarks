import type { LevelConfig } from '../../utils/levels'
import { cn } from '../../utils/cn'

interface Props {
  level: LevelConfig
  points: number
  maxMarks: number
  active?: boolean
  disabled?: boolean
  title?: string
  /** 'tile' stacks icon, label and points (Quick Mark); 'row' lays them out in a line (popovers). */
  layout?: 'tile' | 'row'
  large?: boolean
  onClick: () => void
}

// A rubric level (Mastery, Understanding…) as a tinted glass button with its icon.
export function LevelButton({ level, points, maxMarks, active, disabled, title, layout = 'tile', large, onClick }: Props) {
  const Icon = level.icon
  const rgb = level.rgb
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? level.label}
      className={cn(
        'relative rounded-xl border transition-all duration-150 disabled:opacity-50 disabled:cursor-wait',
        layout === 'tile'
          ? cn('flex flex-col items-center gap-1.5 px-2 text-center', large ? 'py-4' : 'py-3')
          : 'flex items-center gap-3 px-3 py-2.5 text-left',
        active ? 'scale-[1.03]' : 'hover:-translate-y-0.5',
      )}
      style={{
        background: `linear-gradient(180deg, rgba(${rgb},${active ? 0.22 : 0.1}), rgba(${rgb},${active ? 0.1 : 0.03}))`,
        borderColor: `rgba(${rgb},${active ? 0.75 : 0.22})`,
        boxShadow: active ? `0 0 22px rgba(${rgb},0.3), inset 0 0 18px rgba(${rgb},0.12)` : undefined,
      }}
    >
      <span
        className={cn('grid place-items-center rounded-full shrink-0', large ? 'w-10 h-10' : 'w-8 h-8')}
        style={{ color: `rgb(${rgb})`, background: `rgba(${rgb},0.15)`, boxShadow: active ? `0 0 12px rgba(${rgb},0.45)` : undefined }}
      >
        <Icon size={large ? 20 : 16} strokeWidth={1.8} />
      </span>
      <span className={cn('min-w-0', layout === 'row' && 'flex-1')}>
        <span className={cn('block font-semibold leading-tight', large ? 'text-sm' : 'text-xs')} style={{ color: `rgb(${rgb})` }}>
          {layout === 'tile' ? level.shortLabel.split(' ')[0] : level.shortLabel}
        </span>
        {layout === 'tile' && (
          <span className={cn('block mt-0.5 tabular-nums text-gray-400', large ? 'text-sm' : 'text-[11px]')}>{points}/{maxMarks}</span>
        )}
      </span>
      {layout === 'row' && <span className="text-xs tabular-nums text-gray-400 shrink-0">{points} / {maxMarks}</span>}
    </button>
  )
}
