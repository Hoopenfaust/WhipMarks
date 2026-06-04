import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { TaMark, TaAssignment } from '../../types'
import { newId } from '../../utils/id'

// ─── TA Marks ────────────────────────────────────────────────────────────────

export function useTaMarksForProject(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.taMarks.where('projectId').equals(projectId).toArray() : [],
    [projectId]
  ) ?? []
}

export async function upsertTaMark(
  studentId: string,
  projectId: string,
  criterionId: string,
  score: number,
  feedback: string,
  taName: string,
) {
  const existing = await db.taMarks
    .where('[studentId+projectId+criterionId]')
    .equals([studentId, projectId, criterionId])
    .first()

  if (existing) {
    await db.taMarks.update(existing.id, { score, feedback, updatedAt: Date.now() })
  } else {
    const m: TaMark = { id: newId(), studentId, projectId, criterionId, score, feedback, taName, updatedAt: Date.now() }
    await db.taMarks.add(m)
  }
}

export async function deleteTaMarksForProject(projectId: string) {
  await db.taMarks.where('projectId').equals(projectId).delete()
}

// ─── TA Assignments (TA machine only) ────────────────────────────────────────

export function useActiveTaAssignment() {
  return useLiveQuery(() => db.taAssignments.toArray().then(a => a[0] ?? null), [])
}

export async function saveTaAssignment(assignment: TaAssignment) {
  await db.taAssignments.put(assignment)
}

export async function clearTaAssignment(projectId: string) {
  await db.taAssignments.delete(projectId)
}
