import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Class } from '../../types'
import { newId } from '../../utils/id'

export function useClasses() {
  return useLiveQuery(() => db.classes.orderBy('createdAt').toArray(), []) ?? []
}

export function useClass(id: string | undefined) {
  return useLiveQuery(() => (id ? db.classes.get(id) : undefined), [id])
}

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

export async function deleteClass(id: string) {
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
    await db.projects.where('id').anyOf(projectIds).delete()
  }
  if (studentIds.length) await db.students.where('id').anyOf(studentIds).delete()

  // Push all tombstones to the server, then pull to reconcile.
  // If the server still sends the class back (tombstone not yet acknowledged),
  // delete it again and push once more.
  try {
    await db.cloud.sync({ wait: true, purpose: 'push' })
    await db.cloud.sync({ wait: true, purpose: 'pull' })
    const restored = await db.classes.get(id)
    if (restored) {
      await db.classes.delete(id)
      await db.cloud.sync({ wait: true, purpose: 'push' })
    }
  } catch { /* non-fatal if offline */ }
}
