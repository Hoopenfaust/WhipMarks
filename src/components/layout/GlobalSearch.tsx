import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { cn } from '../../utils/cn'

interface Props {
  onSelectStudent?: (classId: string, studentId: string) => void
}

export function GlobalSearch({ onSelectStudent }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const navigate = useNavigate()

  const students = useLiveQuery(() => db.students.toArray(), []) ?? []
  const classes = useLiveQuery(() => db.classes.toArray(), []) ?? []
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]))

  // Filter when query present, show all when empty
  const results = query.trim().length > 0
    ? students.filter(s => {
        const full = [s.firstName, s.name].filter(Boolean).join(' ').toLowerCase()
        return full.includes(query.toLowerCase())
      }).slice(0, 10)
    : students.slice(0, 10)

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0) }, [results.length, query])

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function handleSelect(classId: string, studentId: string) {
    setOpen(false)
    navigate(`/classes/${classId}`, { state: { openStudentId: studentId } })
    onSelectStudent?.(classId, studentId)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      const s = results[selectedIndex]
      handleSelect(s.classId, s.id)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const displayName = (s: { name: string; firstName?: string }) =>
    s.firstName ? `${s.firstName} ${s.name}` : s.name

  const initials = (s: { name: string; firstName?: string }) =>
    (s.firstName ? s.firstName[0] : s.name[0]).toUpperCase()

  return (
    <>
      {/* Trigger button — app bar compact style */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 bg-gray-800 border border-gray-700 rounded-full px-5 py-2 text-gray-400 hover:text-gray-100 hover:border-gray-600 transition-all group"
      >
        <Search size={16} />
        <span className="text-sm">Search students…</span>
        <kbd className="ml-1 text-xs text-gray-400/70 group-hover:text-gray-400 border border-gray-700 rounded px-1.5 py-0.5">Ctrl K</kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-xl bg-gray-850 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-10">

            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700">
              <Search size={20} className="text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search students across all classes…"
                className="flex-1 bg-transparent text-xl text-gray-100 placeholder-chiffon-muted/50 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-100">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Results — shown immediately on open */}
            {results.length > 0 ? (
              <ul ref={listRef} className="max-h-80 overflow-y-auto">
                {results.map((s, i) => (
                  <li key={s.id}>
                    <button
                      className={cn(
                        'w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left',
                        i === selectedIndex ? 'bg-gray-800' : 'hover:bg-gray-800/60'
                      )}
                      onMouseEnter={() => setSelectedIndex(i)}
                      onClick={() => handleSelect(s.classId, s.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-100 shrink-0">
                          {initials(s)}
                        </div>
                        <div>
                          <p className="text-base font-medium text-gray-100">{displayName(s)}</p>
                          <p className="text-sm text-gray-400">{classMap[s.classId] ?? 'Unknown class'}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400/70">↵</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center text-gray-400/70 text-sm">
                {query.trim().length > 0 ? `No students found for "${query}"` : 'No students yet'}
              </div>
            )}

            <div className="px-5 py-2 border-t border-gray-800 flex items-center gap-4 text-[11px] text-gray-400/50">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>Esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
