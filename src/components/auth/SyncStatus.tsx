import { useState, type ReactNode } from 'react'
import { useObservable } from 'dexie-react-hooks'
import { Cloud, CloudOff, RefreshCw, LogOut, AlertTriangle, WifiOff } from 'lucide-react'
import { db } from '../../db/db'

const CLOUD_URL = import.meta.env.VITE_DEXIE_CLOUD_URL as string | undefined

/**
 * Shows in the app header. When cloud is not configured, renders nothing.
 * When configured, shows login state + sync status.
 *
 * Dexie Cloud's syncState.phase can be 'error' or 'offline' (or 'not-in-sync',
 * 'initial') just as easily as 'in-sync' — those are distinct pills below
 * rather than being folded into a reassuring "Synced" for anything that isn't
 * actively pushing/pulling. The pill is a real button — clicking it forces a
 * manual sync attempt, since there was previously no way to retry at all.
 */
export function SyncStatus({ onLoginClick }: { onLoginClick: () => void }) {
  const currentUser = useObservable(db.cloud.currentUser)
  const syncState = useObservable(db.cloud.syncState)
  const [retrying, setRetrying] = useState(false)

  if (!CLOUD_URL) return null

  const isLoggedIn = currentUser?.isLoggedIn === true

  if (!isLoggedIn) {
    return (
      <button
        onClick={onLoginClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors border border-gray-700 hover:border-gray-600"
        title="Sign in to sync across devices"
      >
        <CloudOff size={13} />
        Sign in to sync
      </button>
    )
  }

  const phase = syncState?.phase
  const isSyncing = retrying || phase === 'pushing' || phase === 'pulling'
  const hasError = phase === 'error' || syncState?.status === 'error'
  const isOffline = phase === 'offline' || syncState?.status === 'offline' || syncState?.status === 'disconnected'
  const isBehind = phase === 'not-in-sync' || phase === 'initial'

  let pill: { icon: ReactNode; label: string; classes: string; hint: string }

  if (hasError) {
    pill = {
      icon: <AlertTriangle size={13} />,
      label: 'Sync error',
      classes: 'text-red-600 dark:text-red-400 border-red-500/50 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30',
      hint: syncState?.error?.message ?? 'Sync failed',
    }
  } else if (isOffline) {
    pill = {
      icon: <WifiOff size={13} />,
      label: 'Offline',
      classes: 'text-amber-600 dark:text-amber-400 border-amber-500/50 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30',
      hint: 'No connection to the sync server — changes are saved locally',
    }
  } else if (isBehind) {
    pill = {
      icon: <RefreshCw size={12} />,
      label: 'Not synced yet',
      classes: 'text-amber-600 dark:text-amber-400 border-amber-500/50 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30',
      hint: `Sync phase: ${phase ?? 'unknown'}`,
    }
  } else {
    pill = {
      icon: isSyncing ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={13} />,
      label: isSyncing ? 'Syncing…' : 'Synced',
      classes: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/50 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30',
      hint: 'Up to date',
    }
  }

  async function retrySync() {
    if (isSyncing) return
    setRetrying(true)
    try {
      await db.cloud.sync({ wait: true, purpose: 'pull' })
    } catch {
      // Surfaced through syncState.error on the next render — nothing else to do here.
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={retrySync}
        disabled={isSyncing}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:cursor-wait ${!isSyncing ? 'cursor-pointer hover:brightness-110' : ''} ${pill.classes}`}
        title={`${pill.hint} — click to sync now`}
      >
        {pill.icon}
        {pill.label}
      </button>
      <button
        onClick={() => db.cloud.logout()}
        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        title={`Signed in as ${currentUser?.email ?? currentUser?.userId ?? 'you'} — click to sign out`}
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
