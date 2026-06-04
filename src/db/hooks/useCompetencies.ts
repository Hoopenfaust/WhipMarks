import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Competency, CriterionCompetency } from '../../types'
import { newId } from '../../utils/id'

export function useCompetencies(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.competencies.where('projectId').equals(projectId).sortBy('sortIndex') : [],
    [projectId]
  ) ?? []
}

export function useCriterionCompetencies(criterionId: string | undefined) {
  return useLiveQuery(
    () => criterionId ? db.criterionCompetencies.where('criterionId').equals(criterionId).toArray() : [],
    [criterionId]
  ) ?? []
}

export function useAllCriterionCompetenciesForProject(criteriaIds: string[]) {
  return useLiveQuery(
    () => criteriaIds.length > 0 ? db.criterionCompetencies.where('criterionId').anyOf(criteriaIds).toArray() : [],
    [criteriaIds.join(',')]
  ) ?? []
}

export async function addCompetency(projectId: string, name: string, description: string, sortIndex: number) {
  const c: Competency = { id: newId(), projectId, name, description, sortIndex }
  await db.competencies.add(c)
  return c
}

export async function updateCompetency(id: string, fields: Partial<Pick<Competency, 'name' | 'description'>>) {
  await db.competencies.update(id, fields)
}

export async function deleteCompetency(id: string) {
  await db.transaction('rw', [db.competencies, db.criterionCompetencies], async () => {
    await db.competencies.delete(id)
    await db.criterionCompetencies.where('competencyId').equals(id).delete()
  })
}

export async function bulkAddCompetencies(projectId: string, items: { name: string; description: string }[]) {
  const records: Competency[] = items.map((c, i) => ({ id: newId(), projectId, name: c.name, description: c.description, sortIndex: i }))
  await db.competencies.bulkAdd(records)
  return records
}

export async function toggleCriterionCompetency(criterionId: string, competencyId: string) {
  const existing = await db.criterionCompetencies
    .where('criterionId').equals(criterionId)
    .and(r => r.competencyId === competencyId)
    .first()
  if (existing) {
    await db.criterionCompetencies.delete(existing.id)
  } else {
    const r: CriterionCompetency = { id: newId(), criterionId, competencyId }
    await db.criterionCompetencies.add(r)
  }
}
