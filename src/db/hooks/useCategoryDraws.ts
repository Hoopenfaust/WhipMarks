import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { CategoryAssignment } from '../../types'
import { newId } from '../../utils/id'

export function useCategoryDraw(projectId: string | undefined) {
  return useLiveQuery(() => (projectId ? db.categoryDraws.get(projectId) : undefined), [projectId])
}

export function useCategoryAssignments(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.categoryAssignments.where('projectId').equals(projectId).sortBy('createdAt') : [],
    [projectId]
  ) ?? []
}

export async function setupCategoryDraw(projectId: string, categories: string[]) {
  await db.transaction('rw', [db.categoryDraws, db.categoryAssignments], async () => {
    await db.categoryAssignments.where('projectId').equals(projectId).delete()
    await db.categoryDraws.put({
      id: projectId,
      projectId,
      categories,
      pool: [...categories],
      createdAt: Date.now(),
    })
  })
}

// Picks the next student/category and consumes it from the pool immediately (so a second
// draw can't repeat it), but does NOT write to the assignment log yet — the caller commits
// that with recordCategoryAssignment once the reel animation has finished revealing it, so
// the log doesn't show the result before the UI does.
export async function drawNextCategory(projectId: string, rosterIds: string[]): Promise<CategoryAssignment> {
  return db.transaction('rw', [db.categoryDraws, db.categoryAssignments], async () => {
    const draw = await db.categoryDraws.get(projectId)
    if (!draw) throw new Error(`drawNextCategory: no draw configured for project ${projectId}`)

    const assigned = await db.categoryAssignments.where('projectId').equals(projectId).toArray()
    const assignedStudentIds = new Set(assigned.map(a => a.studentId))
    const remainingStudents = rosterIds.filter(id => !assignedStudentIds.has(id))
    if (remainingStudents.length === 0) throw new Error('drawNextCategory: all students already drawn')

    let pool = draw.pool
    if (pool.length === 0) pool = [...draw.categories]

    const studentId = remainingStudents[Math.floor(Math.random() * remainingStudents.length)]
    const catIdx = Math.floor(Math.random() * pool.length)
    const category = pool[catIdx]
    const nextPool = pool.slice(0, catIdx).concat(pool.slice(catIdx + 1))

    await db.categoryDraws.update(projectId, { pool: nextPool })
    return { id: newId(), projectId, studentId, category, createdAt: Date.now() }
  })
}

export async function recordCategoryAssignment(entry: CategoryAssignment) {
  await db.categoryAssignments.add(entry)
}

export async function resetCategoryDraw(projectId: string) {
  await db.transaction('rw', [db.categoryDraws, db.categoryAssignments], async () => {
    const draw = await db.categoryDraws.get(projectId)
    if (!draw) return
    await db.categoryAssignments.where('projectId').equals(projectId).delete()
    await db.categoryDraws.update(projectId, { pool: [...draw.categories] })
  })
}

export async function deleteCategoryDrawsForProjects(projectIds: string[]) {
  if (projectIds.length === 0) return
  await db.categoryAssignments.where('projectId').anyOf(projectIds).delete()
  await db.categoryDraws.where('id').anyOf(projectIds).delete()
}
