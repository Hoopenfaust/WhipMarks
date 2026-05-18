import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { saveToLocalStorage } from '../../utils/backup'
import { Sidebar } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'

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
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute top-5 right-6 z-40">
          <GlobalSearch />
        </div>
        <div className="pt-24">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
