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
  await db.transaction('rw', [db.projects, db.criteria, db.marks, db.projectSheets, db.descriptors, db.categoryDraws, db.categoryAssignments, db.groups, db.groupMembers, db.criterionCompetencies], async () => {
    await db.marks.where('projectId').equals(id).delete()
    if (criterionIds.length) {
      await db.descriptors.where('criterionId').anyOf(criterionIds).delete()
      await db.criterionCompetencies.where('criterionId').anyOf(criterionIds).delete()
    }
    await db.criteria.where('id').anyOf(criterionIds).delete()
    await db.projectSheets.where('projectId').equals(id).delete()
    await db.categoryAssignments.where('projectId').equals(id).delete()
    await db.categoryDraws.delete(id)
    const groupIds = (await db.groups.where('projectId').equals(id).toArray()).map(g => g.id)
    if (groupIds.length) await db.groupMembers.where('groupId').anyOf(groupIds).delete()
    await db.groups.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}
