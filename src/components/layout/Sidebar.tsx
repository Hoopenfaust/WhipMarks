import { useState } from 'react'
import { NavLink, useNavigate, useMatch } from 'react-router-dom'
import { Plus, GraduationCap, BarChart2, HelpCircle, Briefcase, Layers, Eye, EyeOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClass, useClass } from '../../db/hooks/useClasses'
import { useActiveTaAssignment, saveTaAssignment } from '../../db/hooks/useTaMarks'
import { openFilePicker, parseTaAssignmentFile } from '../../utils/taExport'
import { cn } from '../../utils/cn'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { TaMarkingView } from '../marking/TaMarkingView'
import { usePresenting, setPresenting } from '../../utils/presentation'

// Icon-only rail tile; the name shows as a tooltip.
const tileClass = (active: boolean, disabled = false) => cn(
  'relative w-14 h-14 rounded-2xl flex items-center justify-center border transition-all',
  active
    ? 'text-orange-400 bg-orange-500/10 border-orange-500/25 shadow-[inset_0_0_24px_rgba(139,92,246,0.18),0_0_20px_rgba(139,92,246,0.12)]'
    : disabled
      ? 'text-gray-400/30 border-transparent'
      : 'text-gray-400 border-transparent hover:text-gray-100 hover:bg-white/[0.04]'
)

function RailLink({ to, label, icon: Icon, disabled }: { to: string; label: string; icon: LucideIcon; disabled?: boolean }) {
  return (
    <NavLink to={to} title={label} aria-label={label}>
      {({ isActive }) => <span className={tileClass(isActive && !disabled, disabled)}><Icon size={22} strokeWidth={1.6} /></span>}
    </NavLink>
  )
}

export function Sidebar() {
  const navigate = useNavigate()
  const classMatch = useMatch('/classes/:classId/*')
  const classId = classMatch?.params.classId
  const currentClass = useClass(classId)
  const [addOpen, setAddOpen]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [taOpen, setTaOpen]     = useState(false)
  const [taError, setTaError]   = useState<string | null>(null)
  const activeAssignment        = useActiveTaAssignment()
  const presenting              = usePresenting()

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
      <aside className="w-24 flex flex-col items-center bg-white/[0.02] border-r border-gray-700/60 shrink-0" style={{ zIndex: 10, position: 'relative' }}>
        {/* Brand */}
        <div className="h-20 flex items-center justify-center">
          <GraduationCap size={30} strokeWidth={1.8} className="text-orange-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]" />
        </div>

        <nav className="flex-1 flex flex-col items-center gap-3 pt-8">
          <RailLink to="/classes" label="Classes" icon={GraduationCap} />
          <RailLink to="/library" label="Project Library" icon={Layers} />
          <RailLink
            to={classId ? `/classes/${classId}/semester` : '/classes'}
            label={classId ? 'Semester Summary' : 'Semester Summary — open a class first'}
            icon={BarChart2}
            disabled={!classId}
          />
          <button
            onClick={() => activeAssignment ? setTaOpen(true) : importTaAssignment()}
            title={activeAssignment ? `Resume TA marking — ${activeAssignment.projectName}` : 'TA Mode — open a TA assignment'}
            aria-label="TA Mode"
            className={tileClass(!!activeAssignment)}
          >
            <Briefcase size={22} strokeWidth={1.6} />
            {activeAssignment && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_#a78bfa]" />}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('gradedesk-tutorial-done')
              localStorage.removeItem('gradedesk-tutorial-step')
              window.location.reload()
            }}
            title="Help — replay the tour"
            aria-label="Help"
            className={tileClass(false)}
          >
            <HelpCircle size={22} strokeWidth={1.6} />
          </button>

          {/* Presentation mode: blurs every mark so WhipMarks can go on a projector */}
          <button
            onClick={() => setPresenting(!presenting)}
            title={presenting ? 'Presentation mode is on — marks are hidden. Click to show marks.' : 'Presentation mode — hide all marks for showing on a projector'}
            aria-label="Presentation mode"
            aria-pressed={presenting}
            className={tileClass(presenting)}
          >
            {presenting ? <EyeOff size={22} strokeWidth={1.6} /> : <Eye size={22} strokeWidth={1.6} />}
          </button>
        </nav>

        {/* New class */}
        <button
          onClick={() => setAddOpen(true)}
          title="New Class"
          aria-label="New Class"
          className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 transition-colors shadow-[0_0_24px_rgba(139,92,246,0.2)]"
        >
          <Plus size={22} />
        </button>

        {/* Current class */}
        <div className="mt-5 mb-5 w-16 pt-4 border-t border-gray-700/60 text-center text-[11px] leading-snug text-gray-400 break-words">
          {currentClass ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_#a78bfa] mr-1 align-middle" />
              {currentClass.name}
            </>
          ) : <span className="text-gray-400/50">No class open</span>}
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
