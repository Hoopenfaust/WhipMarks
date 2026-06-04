import { useState } from 'react'
import { BookText, Plus, Trash2, X, Check } from 'lucide-react'
import type { Snippet } from '../../types'
import { addSnippet, updateSnippet, deleteSnippet, incrementSnippetUsage } from '../../db/hooks/useSnippets'
import { cn } from '../../utils/cn'

interface Props {
  projectId: string
  snippets: Snippet[]
  onInsert: (text: string) => void
}

export function SnippetPicker({ projectId, snippets, onInsert }: Props) {
  const [open, setOpen]         = useState(false)
  const [managing, setManaging] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newText, setNewText]   = useState('')
  const [editId, setEditId]     = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editText, setEditText]   = useState('')

  async function handleInsert(s: Snippet) {
    await incrementSnippetUsage(s.id)
    onInsert(s.text)
    setOpen(false)
  }

  async function handleAdd() {
    if (!newLabel.trim() || !newText.trim()) return
    await addSnippet(projectId, newLabel.trim(), newText.trim())
    setNewLabel(''); setNewText('')
  }

  async function saveEdit() {
    if (editId) await updateSnippet(editId, { label: editLabel, text: editText })
    setEditId(null)
  }

  // Sort by most used first
  const sorted = [...snippets].sort((a, b) => b.usageCount - a.usageCount)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
          open
            ? 'bg-gray-700 border border-gray-600 text-gray-100'
            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100'
        )}
      >
        <BookText size={12} />
        Snippets
        {snippets.length > 0 && (
          <span className="bg-gray-600 text-gray-300 rounded-full px-1.5 py-px text-[10px] font-semibold">{snippets.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-gray-850 border border-gray-700 rounded-xl shadow-2xl shadow-black/60 z-10"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700">
            <div>
              <span className="text-xs font-semibold text-gray-300">
                {managing ? 'Manage snippets' : 'Insert snippet'}
              </span>
              {managing && <p className="text-[10px] text-gray-500 mt-0.5">Changes save automatically</p>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setManaging(m => !m)}
                className="text-[10px] text-gray-400 hover:text-gray-100 px-2 py-0.5 rounded hover:bg-gray-700 transition-colors">
                {managing ? '← Back' : 'Manage'}
              </button>
              <button onClick={() => setOpen(false)} className="p-1 rounded text-gray-400 hover:text-gray-100">
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Snippet list */}
          <div className="max-h-56 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="text-xs text-gray-400/60 text-center py-6 px-4">No snippets yet. Add some below.</p>
            ) : sorted.map(s => (
              <div key={s.id} className="border-b border-gray-700/50 last:border-0">
                {managing && editId === s.id ? (
                  <div className="p-3 flex flex-col gap-2">
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus
                      className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-gray-400 w-full" />
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                      className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-gray-400 w-full resize-none" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:text-gray-100"><X size={12} /></button>
                      <button onClick={saveEdit} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 px-3 py-2.5 group hover:bg-gray-800/50 transition-colors">
                    <button onClick={() => !managing && handleInsert(s)} className="flex-1 text-left min-w-0">
                      <p className="text-xs font-semibold text-gray-200 truncate">{s.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{s.text}</p>
                      {s.usageCount > 0 && <p className="text-[10px] text-gray-500 mt-1">Used {s.usageCount}×</p>}
                    </button>
                    {managing ? (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditId(s.id); setEditLabel(s.label); setEditText(s.text) }}
                          className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700"><BookText size={11} /></button>
                        <button onClick={() => deleteSnippet(s.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-950/30"><Trash2 size={11} /></button>
                      </div>
                    ) : (
                      <button onClick={() => handleInsert(s)}
                        className="opacity-0 group-hover:opacity-100 shrink-0 px-2 py-1 rounded text-[10px] font-semibold bg-orange-900/60 text-orange-300 hover:bg-orange-900 transition-all">
                        Insert
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="border-t border-gray-700 p-3 flex flex-col gap-2">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (e.g. Needs rationale)"
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500 w-full placeholder-gray-600" />
            <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Snippet text…" rows={2}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-500 w-full resize-none placeholder-gray-600" />
            <button onClick={handleAdd} disabled={!newLabel.trim() || !newText.trim()}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 disabled:opacity-40 transition-colors">
              <Plus size={12} /> Save snippet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
