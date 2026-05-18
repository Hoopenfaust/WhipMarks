import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { RubricDescriptor, DescriptorLevel } from '../../types'
import { newId } from '../../utils/id'

export function useProjectDescriptors(projectId: string | undefined) {
  return useLiveQuery(async () => {
    if (!projectId) return []
    const criteria = await db.criteria.where('projectId').equals(projectId).toArray()
    const ids = criteria.map(c => c.id)
    if (ids.length === 0) return []
    return db.descriptors.where('criterionId').anyOf(ids).toArray()
  }, [projectId]) ?? []
}

export async function setDescriptor(
  criterionId: string,
  level: DescriptorLevel,
  text: string,
  score?: number,
) {
  const existing = await db.descriptors
    .where('criterionId').equals(criterionId)
    .toArray()
  const match = existing.find(d => d.level === level)
  const patch: Partial<RubricDescriptor> = { text }
  if (score !== undefined) patch.score = score
  if (match) {
    const count = await db.descriptors.update(match.id, patch)
    if (count === 0) throw new Error(`setDescriptor: descriptor ${match.id} not found in DB`)
  } else {
    const d: RubricDescriptor = { id: newId(), criterionId, level, text, ...(score !== undefined ? { score } : {}) }
    await db.descriptors.add(d)
  }
}

export async function deleteDescriptorsForCriterion(criterionId: string) {
  await db.descriptors.where('criterionId').equals(criterionId).delete()
}

export async function bulkSetDescriptors(items: Omit<RubricDescriptor, 'id'>[]) {
  const descriptors: RubricDescriptor[] = items.map(d => ({ ...d, id: newId() }))
  await db.descriptors.bulkAdd(descriptors)
}
