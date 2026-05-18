import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { RubricCriterion, RubricTemplate, TemplateCriterion } from '../../types'
import { newId } from '../../utils/id'

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

  // Fetch existing state before entering the transaction
  const existing = await db.criteria.where('projectId').equals(projectId).toArray()
  const startIndex = mode === 'append' ? existing.length : 0

  // Build the new criteria rows before the transaction (no DB access needed)
  const newCriteria: RubricCriterion[] = items.map((item, i) => ({
    ...item,
    id: newId(),
    projectId,
    sortIndex: startIndex + i,
  }))
  const totalMarks = newCriteria.reduce((sum, c) => sum + c.maxMarks, 0)

  // Single atomic transaction: delete (replace mode) + insert + update project
  await db.transaction('rw', [db.criteria, db.marks, db.descriptors, db.projects], async () => {
    if (mode === 'replace') {
      for (const c of existing) {
        await db.marks.filter(m => m.criterionId === c.id).delete()
        await db.descriptors.where('criterionId').equals(c.id).delete()
      }
      await db.criteria.where('projectId').equals(projectId).delete()
    }
    await db.criteria.bulkAdd(newCriteria)
    const projectCount = await db.projects.update(projectId, { totalMarks })
    if (projectCount === 0) throw new Error(`applyTemplate: project ${projectId} not found in DB`)
  })
}
