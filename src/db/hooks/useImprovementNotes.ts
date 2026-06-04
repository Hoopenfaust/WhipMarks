import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { newId } from '../../utils/id'

export function useProjectImprovementNotes(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.improvementNotes.where('projectId').equals(projectId).toArray() : [],
    [projectId],
    []
  )
}

export async function upsertImprovementNote(studentId: string, projectId: string, text: string) {
  const existing = await db.improvementNotes
    .where('[studentId+projectId]').equals([studentId, projectId]).first()
  if (existing) {
    await db.improvementNotes.update(existing.id, { text, updatedAt: Date.now() })
  } else {
    await db.improvementNotes.add({ id: newId(), studentId, projectId, text, updatedAt: Date.now() })
  }
}
