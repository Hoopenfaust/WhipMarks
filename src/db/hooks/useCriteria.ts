import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { RubricCriterion } from '../../types'
import { newId } from '../../utils/id'

export function useCriteria(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.criteria.where('projectId').equals(projectId).sortBy('sortIndex') : [],
    [projectId]
  ) ?? []
}

export async function addCriterion(data: Omit<RubricCriterion, 'id'>): Promise<RubricCriterion> {
  const c: RubricCriterion = { ...data, id: newId() }
  await db.criteria.add(c)
  return c
}

export async function updateCriterion(id: string, data: Partial<Omit<RubricCriterion, 'id'>>) {
  await db.criteria.update(id, data)
}

export async function deleteCriterion(id: string) {
  await db.transaction('rw', db.criteria, db.marks, db.descriptors, async () => {
    await db.marks.filter(m => m.criterionId === id).delete()
    await db.descriptors.where('criterionId').equals(id).delete()
    await db.criteria.delete(id)
  })
}

export async function bulkAddCriteria(projectId: string, items: Omit<RubricCriterion, 'id' | 'projectId' | 'sortIndex'>[], startIndex = 0) {
  const criteria: RubricCriterion[] = items.map((item, i) => ({
    ...item,
    id: newId(),
    projectId,
    sortIndex: startIndex + i,
  }))
  await db.criteria.bulkAdd(criteria)
  return criteria
}

export async function reorderCriteria(orderedIds: string[]) {
  await db.transaction('rw', db.criteria, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.criteria.update(orderedIds[i], { sortIndex: i })
    }
  })
}
