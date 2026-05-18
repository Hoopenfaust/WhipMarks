import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Project } from '../../types'
import { newId } from '../../utils/id'

export function useProjects(classId: string | undefined) {
  return useLiveQuery(
    () => classId ? db.projects.where('classId').equals(classId).sortBy('createdAt') : [],
    [classId]
  ) ?? []
}

export function useProject(id: string | undefined) {
  return useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
}

export async function createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  const p: Project = { ...data, id: newId(), createdAt: Date.now() }
  await db.projects.add(p)
  return p
}

export async function updateProject(id: string, data: Partial<Omit<Project, 'id'>>) {
  const count = await db.projects.update(id, data)
  if (count === 0) throw new Error(`updateProject: project ${id} not found in DB`)
}

export async function deleteProject(id: string) {
  const criteria = await db.criteria.where('projectId').equals(id).toArray()
  const criterionIds = criteria.map(c => c.id)
  await db.transaction('rw', [db.projects, db.criteria, db.marks, db.projectSheets, db.descriptors], async () => {
    await db.marks.where('projectId').equals(id).delete()
    if (criterionIds.length) await db.descriptors.where('criterionId').anyOf(criterionIds).delete()
    await db.criteria.where('id').anyOf(criterionIds).delete()
    await db.projectSheets.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}
