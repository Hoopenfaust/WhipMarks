import { useObservable } from 'dexie-react-hooks'
import { Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-react'
import { db } from '../../db/db'

const CLOUD_URL = import.meta.env.VITE_DEXIE_CLOUD_URL as string | undefined

/**
 * Shows in the app header. When cloud is not configured, renders nothing.
 * When configured, shows login state + sync status.
 */
export function SyncStatus({ onLoginClick }: { onLoginClick: () => void }) {
  const currentUser = useObservable(db.cloud.currentUser)
  const syncState = useObservable(db.cloud.syncState)

  if (!CLOUD_URL) return null

  const isLoggedIn = currentUser?.isLoggedIn === true
  const isSyncing = syncState?.phase === 'pushing' || syncState?.phase === 'pulling'

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

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/50 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30">
        {isSyncing
          ? <RefreshCw size={12} className="animate-spin" />
          : <Cloud size={13} />
        }
        {isSyncing ? 'Syncing…' : 'Synced'}
      </div>
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
