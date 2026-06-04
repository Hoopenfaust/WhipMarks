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
    <div className="px-5 py-3 border-b border-gray-700">
      <div className="bg-gray-900 rounded-xl p-1 flex gap-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
              active === tab.id
                ? 'bg-gray-800 text-gray-100 shadow-sm'
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
