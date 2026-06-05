import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { saveToLocalStorage } from '../../utils/backup'
import { Sidebar } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
import { SyncStatus } from '../auth/SyncStatus'
import { SyncLoginModal } from '../auth/SyncLoginModal'

function AutoBackup() {
  // Watch row counts across all key tables — any change triggers a debounced save
  const tick = useLiveQuery(async () => {
    const [c, s, p, cr, m] = await Promise.all([
      db.classes.count(),
      db.students.count(),
      db.projects.count(),
      db.criteria.count(),
      db.marks.count(),
    ])
    return `${c}-${s}-${p}-${cr}-${m}`
  })

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (tick === undefined) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveToLocalStorage(), 1500)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [tick])

  return null
}

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <AutoBackup />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top App Bar */}
        <header className="h-16 bg-gray-900 border-b border-gray-700 flex items-center px-6 gap-4 shrink-0">
          <h1 className="text-lg font-medium text-gray-100 tracking-wide">WhipMarks</h1>
          <div className="ml-auto flex items-center gap-3">
            <SyncStatus />
            <GlobalSearch />
          </div>
        </header>
        <SyncLoginModal />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
