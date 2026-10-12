import { cn } from '../../utils/cn'

interface Tab {
  id: string
  label: string
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}

export function TabBar({ tabs, active, onChange }: Props) {
  return (
    <div className="px-8 py-3">
      <div className="bg-white/[0.03] border border-gray-700/70 rounded-full p-1 flex gap-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-full transition-all',
              active === tab.id
                ? 'bg-orange-500/15 text-orange-300 shadow-[inset_0_0_16px_rgba(139,92,246,0.15)]'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
