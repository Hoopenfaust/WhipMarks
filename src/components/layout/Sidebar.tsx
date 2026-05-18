import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Plus, BookOpen, ChevronLeft, ChevronRight, Trash2, HelpCircle } from 'lucide-react'
import { useClasses, createClass, deleteClass } from '../../db/hooks/useClasses'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'

export function Sidebar() {
  const classes = useClasses()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleAdd() {
    if (!newName.trim()) return
    const c = await createClass(newName.trim())
    setNewName('')
    setAddOpen(false)
    navigate(`/classes/${c.id}`)
  }

  async function handleDelete() {
    if (!deleteId) return
    await deleteClass(deleteId)
    setDeleteId(null)
    navigate('/classes')
  }

  return (
    <>
      <aside
        className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        } shrink-0`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-4 py-4 border-b border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
          <BookOpen size={20} className="text-orange-400 shrink-0" />
          {!collapsed && <span className="text-sm font-semibold text-gray-100">GradeDesk</span>}
        </div>

        {/* Classes */}
        <div className="flex-1 overflow-y-auto py-2">
          {!collapsed && (
            <div className="px-3 mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Classes</span>
            </div>
          )}
          {classes.map(c => (
            <div key={c.id} className="group relative flex items-center">
              <NavLink
                to={`/classes/${c.id}`}
                className={({ isActive }) =>
                  `flex-1 flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg mx-1 transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-gray-100 border-l-2 border-orange-500 pl-2.5'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`
                }
                title={c.name}
              >
                <BookOpen size={15} className="shrink-0" />
                {!collapsed && <span className="truncate">{c.name}</span>}
              </NavLink>
              {!collapsed && (
                <button
                  onClick={() => setDeleteId(c.id)}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add class + collapse */}
        <div className="border-t border-gray-800 p-2 flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddOpen(true)}
            className={`w-full ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <Plus size={15} />
            {!collapsed && 'New Class'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem('gradedesk-tutorial-done')
              localStorage.removeItem('gradedesk-tutorial-step')
              window.location.reload()
            }}
            className={`w-full ${collapsed ? 'justify-center px-0' : ''}`}
            title="Restart tutorial"
          >
            <HelpCircle size={15} />
            {!collapsed && 'Help'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(c => !c)}
            className={`w-full ${collapsed ? 'justify-center px-0' : ''}`}
          >
            {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
          </Button>
        </div>
      </aside>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Class">
        <div className="flex flex-col gap-4">
          <Input
            label="Class name"
            placeholder="e.g. Year 10 Biology"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd} disabled={!newName.trim()}>Create Class</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Class">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-400">
            This will permanently delete the class, all students, projects, and marks. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
