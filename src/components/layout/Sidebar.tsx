import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useMatch } from 'react-router-dom'
import { Plus, GraduationCap, BarChart2, HelpCircle, Briefcase, Layers, Sun, Moon } from 'lucide-react'
import { createClass } from '../../db/hooks/useClasses'
import { useActiveTaAssignment, saveTaAssignment } from '../../db/hooks/useTaMarks'
import { openFilePicker, parseTaAssignmentFile } from '../../utils/taExport'
import { cn } from '../../utils/cn'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { TaMarkingView } from '../marking/TaMarkingView'
import { getTheme, applyTheme } from '../../utils/useTheme'
import type { Theme } from '../../utils/useTheme'

export function Sidebar() {
  const navigate = useNavigate()
  const classMatch = useMatch('/classes/:classId/*')
  const classId = classMatch?.params.classId
  const [addOpen, setAddOpen]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [taOpen, setTaOpen]     = useState(false)
  const [taError, setTaError]   = useState<string | null>(null)
  const [theme, setTheme]       = useState<Theme>(getTheme)
  const activeAssignment        = useActiveTaAssignment()

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const isDark = theme === 'dark'
  // Active pill: warm brown in dark, soft indigo in light
  const activePillStyle = isDark
    ? { background: '#5D3F3A' }
    : { background: 'rgba(99,102,241,0.15)' }
  const activeIconStyle = isDark
    ? { color: '#FFDBD5' }
    : { color: '#4338ca' }
  const activeTextCls = isDark ? 'text-gray-100' : 'text-indigo-700'

  async function handleAdd() {
    if (!newName.trim()) return
    const c = await createClass(newName.trim())
    setNewName('')
    setAddOpen(false)
    navigate(`/classes/${c.id}`)
  }

  async function importTaAssignment() {
    setTaError(null)
    try {
      const json = await openFilePicker('.whipmarks-ta')
      const assignment = parseTaAssignmentFile(json)
      await saveTaAssignment(assignment)
      setTaOpen(true)
    } catch (err) {
      setTaError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <>
      <aside className="w-[88px] flex flex-col bg-gray-900 border-r border-gray-700 shrink-0 shadow-[4px_0_16px_rgba(0,0,0,0.4)]" style={{ zIndex: 10, position: 'relative' }}>
        {/* Brand — aligned with top app bar */}
        <div className="h-16 flex items-center justify-center border-b border-gray-700">
          <GraduationCap size={24} className="text-indigo-400" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col items-center py-4 gap-1">
          <NavLink
            to="/classes"
            className="flex flex-col items-center gap-1 w-full px-4 py-2 group"
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'w-14 h-8 rounded-full flex items-center justify-center transition-colors',
                  isActive ? '' : 'group-hover:bg-gray-800'
                )} style={isActive ? activePillStyle : {}}>
                  <GraduationCap size={18} className={isActive ? '' : 'text-gray-400 group-hover:text-gray-100'} style={isActive ? activeIconStyle : {}} />
                </div>
                <span className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? activeTextCls : 'text-gray-400 group-hover:text-gray-200'
                )}>Classes</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/library"
            className="flex flex-col items-center gap-1 w-full px-4 py-2 group"
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'w-14 h-8 rounded-full flex items-center justify-center transition-colors',
                  isActive ? '' : 'group-hover:bg-gray-800'
                )} style={isActive ? activePillStyle : {}}>
                  <Layers size={18} className={isActive ? '' : 'text-gray-400 group-hover:text-gray-100'} style={isActive ? activeIconStyle : {}} />
                </div>
                <span className={cn(
                  'text-[10px] font-medium transition-colors text-center leading-tight',
                  isActive ? activeTextCls : 'text-gray-400 group-hover:text-gray-200'
                )}>Project Library</span>
              </>
            )}
          </NavLink>

          <NavLink
            to={classId ? `/classes/${classId}/semester` : '/classes'}
            className="flex flex-col items-center gap-1 w-full px-4 py-2 group"
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'w-14 h-8 rounded-full flex items-center justify-center transition-colors',
                  isActive ? '' : 'group-hover:bg-gray-800'
                )} style={isActive ? activePillStyle : {}}>
                  <BarChart2 size={18} className={cn(
                    isActive ? '' : 'group-hover:text-gray-100 transition-colors',
                    !classId ? 'text-gray-400/40' : isActive ? '' : 'text-gray-400'
                  )} style={isActive ? activeIconStyle : {}} />
                </div>
                <span className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? activeTextCls : !classId ? 'text-gray-400/40' : 'text-gray-400 group-hover:text-gray-200'
                )}>Summary</span>
              </>
            )}
          </NavLink>

          {/* TA Mode button */}
          <button
            onClick={() => activeAssignment ? setTaOpen(true) : importTaAssignment()}
            className="flex flex-col items-center gap-1 w-full px-4 py-2 group relative"
            title={activeAssignment ? `Resume TA marking — ${activeAssignment.projectName}` : 'Open TA assignment'}
          >
            <div className={cn(
              'w-14 h-8 rounded-full flex items-center justify-center transition-colors',
              activeAssignment ? '' : 'group-hover:bg-gray-800'
            )} style={activeAssignment ? activePillStyle : {}}>
              <Briefcase size={18} className={activeAssignment ? '' : 'text-gray-400 group-hover:text-gray-100 transition-colors'}
                style={activeAssignment ? activeIconStyle : {}} />
              {activeAssignment && (
                <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-indigo-400" />
              )}
            </div>
            <span className={cn('text-[10px] font-medium transition-colors',
              activeAssignment ? activeTextCls : 'text-gray-400 group-hover:text-gray-200')}>TA Mode</span>
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('gradedesk-tutorial-done')
              localStorage.removeItem('gradedesk-tutorial-step')
              window.location.reload()
            }}
            className="flex flex-col items-center gap-1 w-full px-4 py-2 group"
          >
            <div className="w-14 h-8 rounded-full flex items-center justify-center group-hover:bg-gray-800 transition-colors">
              <HelpCircle size={18} className="text-gray-400 group-hover:text-gray-100 transition-colors" />
            </div>
            <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-200 transition-colors">Help</span>
          </button>
        </nav>

        {/* Theme toggle */}
        <div className="pb-2 flex justify-center">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-14 h-8 rounded-full flex items-center justify-center group-hover:bg-gray-800 hover:bg-gray-800 transition-colors"
          >
            {isDark
              ? <Sun size={16} className="text-gray-400 hover:text-gray-100 transition-colors" />
              : <Moon size={16} className="text-gray-400 hover:text-gray-100 transition-colors" />
            }
          </button>
        </div>

        {/* FAB — New Class */}
        <div className="pb-6 flex justify-center">
          <button
            onClick={() => setAddOpen(true)}
            title="New Class"
            className="w-14 h-14 rounded-2xl bg-indigo-950/80 border border-indigo-900/40 flex items-center justify-center hover:bg-indigo-900/60 transition-colors shadow-xl shadow-black/50"
          >
            <Plus size={22} className="text-indigo-300" />
          </button>
        </div>
      </aside>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setNewName('') }} title="New Class">
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
            <Button variant="ghost" onClick={() => { setAddOpen(false); setNewName('') }}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd} disabled={!newName.trim()}>Create Class</Button>
          </div>
        </div>
      </Modal>

      {/* TA import error */}
      <Modal open={!!taError} onClose={() => setTaError(null)} title="Import failed">
        <p className="text-sm text-gray-300 mb-4">{taError}</p>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => setTaError(null)}>Close</Button>
        </div>
      </Modal>

      {/* TA marking overlay */}
      {taOpen && activeAssignment && (
        <TaMarkingView
          assignment={activeAssignment}
          onClose={async () => {
            setTaOpen(false)
            // Ask if they want to keep or clear the assignment
          }}
        />
      )}
    </>
  )
}
