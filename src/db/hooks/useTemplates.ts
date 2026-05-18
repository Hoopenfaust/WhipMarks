import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { RubricTemplate, TemplateCriterion } from '../../types'
import { newId } from '../../utils/id'
import { bulkAddCriteria } from './useCriteria'
import { updateProject } from './useProjects'

export function useTemplates() {
  return useLiveQuery(
    () => db.rubricTemplates.orderBy('createdAt').reverse().toArray()
  ) ?? []
}

export async function saveTemplate(name: string, criteria: TemplateCriterion[]) {
  const t: RubricTemplate = {
    id: newId(),
    name,
    criteriaJson: JSON.stringify(criteria),
    createdAt: Date.now(),
  }
  await db.rubricTemplates.add(t)
  return t
}

export async function deleteTemplate(id: string) {
  await db.rubricTemplates.delete(id)
}

export async function applyTemplate(
  projectId: string,
  templateId: string,
  mode: 'append' | 'replace',
) {
  const template = await db.rubricTemplates.get(templateId)
  if (!template) return

  const items: TemplateCriterion[] = JSON.parse(template.criteriaJson)

  if (mode === 'replace') {
    const existing = await db.criteria.where('projectId').equals(projectId).toArray()
    await db.transaction('rw', db.criteria, db.marks, db.descriptors, async () => {
      for (const c of existing) {
        await db.marks.filter(m => m.criterionId === c.id).delete()
        await db.descriptors.where('criterionId').equals(c.id).delete()
      }
      await db.criteria.where('projectId').equals(projectId).delete()
    })
  }

  const existingCount = mode === 'append'
    ? await db.criteria.where('projectId').equals(projectId).count()
    : 0

  const added = await bulkAddCriteria(projectId, items, existingCount)
  const totalMarks = added.reduce((sum, c) => sum + c.maxMarks, 0)
  await updateProject(projectId, { totalMarks })
}
