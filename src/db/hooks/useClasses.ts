import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Class } from '../../types'
import { newId } from '../../utils/id'

// ---------------------------------------------------------------------------
// Graveyard — persists deleted class IDs across app restarts so the cloud
// can't resurrect them via pull. IDs are removed only after a successful push.
// ---------------------------------------------------------------------------

const GRAVEYARD_KEY = 'whipmarks-class-graveyard'

function graveyardGet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(GRAVEYARD_KEY) ?? '[]')) }
  catch { return new Set() }
}
function graveyardAdd(id: string) {
  const g = graveyardGet(); g.add(id)
  localStorage.setItem(GRAVEYARD_KEY, JSON.stringify([...g]))
}
function graveyardRemove(id: string) {
  const g = graveyardGet(); g.delete(id)
  localStorage.setItem(GRAVEYARD_KEY, JSON.stringify([...g]))
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useClasses() {
  return useLiveQuery(async () => {
    const all = await db.classes.orderBy('createdAt').toArray()
    const g = graveyardGet()
    return g.size > 0 ? all.filter(c => !g.has(c.id)) : all
  }, []) ?? []
}

export function useClass(id: string | undefined) {
  return useLiveQuery(() => (id ? db.classes.get(id) : undefined), [id])
}

// Reaps any class the cloud restores that is still in the graveyard.
// Runs whenever the classes table changes (e.g. after a cloud pull).
export function useReapDeletedClasses() {
  const classes = useLiveQuery(() => db.classes.toArray(), []) ?? []
  useEffect(() => {
    const g = graveyardGet()
    if (g.size === 0) return
    const zombies = classes.filter(c => g.has(c.id))
    if (zombies.length === 0) return
    Promise.all(zombies.map(c => purgeClassLocally(c.id)))
      .then(() => db.cloud.sync({ wait: true, purpose: 'push' }).catch(() => {}))
  }, [classes])
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

// Deletes all IndexedDB records for a class without touching the graveyard or syncing.
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
    await db.projects.where('id').anyOf(projectIds).delete()
  }
  if (studentIds.length) await db.students.where('id').anyOf(studentIds).delete()
}

export async function deleteClass(id: string) {
  // Add to graveyard first — this survives app restarts and prevents the
  // cloud from ever showing this class in the UI again.
  graveyardAdd(id)

  await purgeClassLocally(id)

  // Best-effort push. If it succeeds, remove from graveyard.
  // If it fails, the reaper will re-delete on next pull and retry the push.
  try {
    await db.cloud.sync({ wait: true, purpose: 'push' })
    graveyardRemove(id)
  } catch { /* reaper will handle it */ }
}
