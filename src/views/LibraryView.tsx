import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Layers, Trash2, ChevronRight } from 'lucide-react'
import { useLibraryProjects, createLibraryProject, deleteLibraryProject } from '../db/hooks/useLibraryProjects'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function LibraryView() {
  const navigate = useNavigate()
  const projects = useLibraryProjects()
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMarks, setNewMarks] = useState('100')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  async function handleCreate() {
    if (!newName.trim()) return
    const marks = parseInt(newMarks, 10)
    const p = await createLibraryProject(newName.trim(), isNaN(marks) ? 100 : marks)
    setNewName('')
    setNewMarks('100')
    setAddOpen(false)
    navigate(`/library/${p.id}`)
  }

  async function handleDelete(id: string) {
    await deleteLibraryProject(id)
    setDeleteTarget(null)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-950">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-8 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-semibold text-gray-100">Project Library</h1>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          New Project
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              <Layers size={28} className="text-gray-500" />
            </div>
            <div>
              <p className="text-gray-300 font-medium mb-1">No library projects yet</p>
              <p className="text-sm text-gray-500">Create reusable projects you can attach to any class.</p>
            </div>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              New Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <div
                key={p.id}
                className="relative bg-gray-850 border border-gray-700 rounded-2xl p-6 hover:border-orange-500/30 hover:bg-gray-800 transition-all duration-200 group shadow-lg shadow-black/40 cursor-pointer"
                onClick={() => navigate(`/library/${p.id}`)}
              >
                <button
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={e => { e.stopPropagation(); setDeleteTarget(p.id) }}
                >
                  <Trash2 size={14} />
                </button>

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1c3a4a' }}>
                    <Layers size={18} className="text-blue-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-100 group-hover:text-white transition-colors leading-snug">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-700/60">
                  <span className="text-sm text-gray-400">{p.totalMarks} marks</span>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New project modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setNewName(''); setNewMarks('100') }} title="New Library Project">
        <div className="flex flex-col gap-4">
          <Input
            label="Project name"
            placeholder="e.g. Product Design Brief"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <Input
            label="Total marks"
            type="number"
            min="1"
            value={newMarks}
            onChange={e => setNewMarks(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAddOpen(false); setNewName(''); setNewMarks('100') }}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete project?">
        <p className="text-sm text-gray-400 mb-4">This will permanently remove this library project and all its criteria. Projects already attached to classes are not affected.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
