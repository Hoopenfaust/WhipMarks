import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Mark } from '../../types'
import { newId } from '../../utils/id'

export function useProjectMarks(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.marks.where('projectId').equals(projectId).toArray() : [],
    [projectId]
  ) ?? []
}

export function useAllMarksForClass(projectIds: string[]) {
  return useLiveQuery(
    () => projectIds.length > 0 ? db.marks.where('projectId').anyOf(projectIds).toArray() : [],
    [projectIds.join(',')]
  ) ?? []
}

export async function upsertMark(
  studentId: string,
  projectId: string,
  criterionId: string,
  score: number,
  feedback: string
) {
  const existing = await db.marks
    .where('[studentId+projectId+criterionId]')
    .equals([studentId, projectId, criterionId])
    .first()

  if (existing) {
    await db.marks.update(existing.id, { score, feedback, updatedAt: Date.now() })
  } else {
    const m: Mark = { id: newId(), studentId, projectId, criterionId, score, feedback, updatedAt: Date.now() }
    await db.marks.add(m)
  }
}

export async function deleteMark(studentId: string, projectId: string, criterionId: string) {
  const existing = await db.marks
    .where('[studentId+projectId+criterionId]')
    .equals([studentId, projectId, criterionId])
    .first()
  if (existing) await db.marks.delete(existing.id)
}
