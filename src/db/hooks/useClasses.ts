import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Class } from '../../types'
import { newId } from '../../utils/id'

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useClasses() {
  return useLiveQuery(async () => {
    const [all, deleted] = await Promise.all([
      db.classes.orderBy('createdAt').toArray(),
      db.deletedClassIds.toArray(),
    ])
    if (deleted.length === 0) return all
    const g = new Set(deleted.map(d => d.id))
    return all.filter(c => !g.has(c.id))
  }, []) ?? []
}

export function useClass(id: string | undefined) {
  return useLiveQuery(() => (id ? db.classes.get(id) : undefined), [id])
}

// Watches db.classes live. When Dexie Cloud restores a deleted class,
// this immediately re-purges it and pushes the tombstone again.
export function useReapDeletedClasses() {
  const classes = useLiveQuery(() => db.classes.toArray(), []) ?? []
  const deleted = useLiveQuery(() => db.deletedClassIds.toArray(), []) ?? []

  useEffect(() => {
    if (deleted.length === 0) return
    const g = new Set(deleted.map(d => d.id))
    const zombies = classes.filter(c => g.has(c.id))
    if (zombies.length === 0) return
    Promise.all(zombies.map(c => purgeClassLocally(c.id)))
      .then(() => db.cloud.sync({ wait: true, purpose: 'push' }).catch(() => {}))
  }, [classes, deleted])
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export async function createClass(name: string): Promise<Class> {
  const c: Class = { id: newId(), name, createdAt: Date.now() }
  await db.classes.add(c)
  return c
}

export async function updateClass(id: string, name: string) {
  const count = await db.classes.update(id, { name })
  if (count === 0) throw new Error(`updateClass: class ${id} not found in DB`)
}

export async function updateClassStartDate(id: string, startDate: string) {
  const count = await db.classes.update(id, { startDate })
  if (count === 0) throw new Error(`updateClassStartDate: class ${id} not found in DB`)
}

// Deletes all IndexedDB records for a class — no graveyard, no sync.
async function purgeClassLocally(id: string) {
  const students = await db.students.where('classId').equals(id).toArray()
  const projects = await db.projects.where('classId').equals(id).toArray()
  const projectIds = projects.map(p => p.id)
  const criteria = projectIds.length
    ? await db.criteria.where('projectId').anyOf(projectIds).toArray()
    : []
  const criterionIds = criteria.map(c => c.id)
  const studentIds = students.map(s => s.id)
  const projectIdSet = new Set(projectIds)

  await db.scheduleWeeks.where('classId').equals(id).delete()
  await db.classes.delete(id)

  if (criterionIds.length) {
    await db.descriptors.where('criterionId').anyOf(criterionIds).delete()
    await db.criterionCompetencies.where('criterionId').anyOf(criterionIds).delete()
  }
  if (projectIds.length) {
    await db.marks.where('projectId').anyOf(projectIds).delete()
    await db.taMarks.where('projectId').anyOf(projectIds).delete()
    await db.taAssignments.bulkDelete(projectIds)
    await db.criteria.where('projectId').anyOf(projectIds).delete()
    await db.projectSheets.where('projectId').anyOf(projectIds).delete()
    await db.competencies.where('projectId').anyOf(projectIds).delete()
    await db.snippets.where('projectId').anyOf(projectIds).delete()
    await db.improvementNotes.where('projectId').anyOf(projectIds).delete()
    await db.studentSubmissions.where('projectId').anyOf(projectIds).delete()
    await db.submissionAnnotations.filter(a => projectIdSet.has(a.projectId)).delete()
    await db.categoryAssignments.where('projectId').anyOf(projectIds).delete()
    await db.categoryDraws.where('id').anyOf(projectIds).delete()
    await db.projects.where('id').anyOf(projectIds).delete()
  }
  if (studentIds.length) await db.students.where('id').anyOf(studentIds).delete()
}

export async function deleteClass(id: string) {
  // Write to the unsynced graveyard table first — this survives app restarts
  // and cloud pulls because deletedClassIds is never synced.
  await db.deletedClassIds.put({ id })

  await purgeClassLocally(id)

  // Best-effort push — don't remove from graveyard here.
  // The graveyard entry stays until a subsequent pull confirms the class
  // is gone from the server (handled passively by the reaper).
  try { await db.cloud.sync({ wait: true, purpose: 'push' }) } catch { /* best-effort */ }
}
