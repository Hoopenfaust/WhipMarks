import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { newId } from '../../utils/id'
import type { EmailLog, Mark } from '../../types'

export function useProjectEmailLogs(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.emailLogs.where('projectId').equals(projectId).toArray() : [],
    [projectId],
    []
  )
}

export async function recordEmail(studentId: string, projectId: string, snapshot: string) {
  const existing = await db.emailLogs.where('[studentId+projectId]').equals([studentId, projectId]).first()
  if (existing) {
    await db.emailLogs.update(existing.id, { emailedAt: Date.now(), snapshot })
  } else {
    await db.emailLogs.add({ id: newId(), studentId, projectId, emailedAt: Date.now(), snapshot })
  }
}

/** Fingerprint of what the marking sheet shows for one student: scores, feedback, improvement note. */
export function markSnapshot(studentMarks: Mark[], improvementNote: string | undefined) {
  const lines = [...studentMarks]
    .sort((a, b) => a.criterionId.localeCompare(b.criterionId))
    .map(m => `${m.criterionId}:${m.score}:${m.feedback ?? ''}`)
  return [...lines, `note:${improvementNote ?? ''}`].join('\n')
}

export type EmailStatus = { state: 'none' } | { state: 'sent' | 'changed'; emailedAt: number }

export function emailStatus(log: EmailLog | undefined, studentMarks: Mark[], improvementNote: string | undefined): EmailStatus {
  if (!log) return { state: 'none' }
  const state = log.snapshot === markSnapshot(studentMarks, improvementNote) ? 'sent' : 'changed'
  return { state, emailedAt: log.emailedAt }
}

export function formatEmailedAt(ts: number) {
  return new Date(ts).toLocaleString('en-CA', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
