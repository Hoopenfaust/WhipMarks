import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { LibraryProject, LibraryProjectCriterion, LibraryDescriptor, DescriptorLevel } from '../../types'
import { newId } from '../../utils/id'

export function useLibraryProjects() {
  return useLiveQuery(() => db.libraryProjects.orderBy('createdAt').toArray()) ?? []
}

export function useLibraryProject(id: string | undefined) {
  return useLiveQuery(() => (id ? db.libraryProjects.get(id) : undefined), [id])
}

export function useLibraryProjectCriteria(libraryProjectId: string | undefined) {
  return useLiveQuery(
    () => libraryProjectId
      ? db.libraryProjectCriteria.where('libraryProjectId').equals(libraryProjectId).sortBy('sortIndex')
      : [],
    [libraryProjectId]
  ) ?? []
}

export async function createLibraryProject(name: string, totalMarks: number, description?: string): Promise<LibraryProject> {
  const p: LibraryProject = { id: newId(), name, totalMarks, description, createdAt: Date.now() }
  await db.libraryProjects.add(p)
  return p
}

export async function updateLibraryProject(id: string, data: Partial<Omit<LibraryProject, 'id'>>) {
  await db.libraryProjects.update(id, data)
}

export async function deleteLibraryProject(id: string) {
  await db.transaction('rw', [db.libraryProjects, db.libraryProjectCriteria, db.libraryDescriptors], async () => {
    const criteria = await db.libraryProjectCriteria.where('libraryProjectId').equals(id).toArray()
    const criterionIds = criteria.map(c => c.id)
    if (criterionIds.length > 0) {
      await db.libraryDescriptors.where('libraryCriterionId').anyOf(criterionIds).delete()
    }
    await db.libraryProjectCriteria.where('libraryProjectId').equals(id).delete()
    await db.libraryProjects.delete(id)
  })
}

export async function addLibraryProjectCriterion(libraryProjectId: string, name: string, sortIndex: number): Promise<LibraryProjectCriterion> {
  const c: LibraryProjectCriterion = {
    id: newId(),
    libraryProjectId,
    name,
    description: '',
    maxMarks: 10,
    weight: 1,
    sortIndex,
  }
  await db.libraryProjectCriteria.add(c)
  return c
}

export async function updateLibraryProjectCriterion(id: string, data: Partial<Omit<LibraryProjectCriterion, 'id'>>) {
  await db.libraryProjectCriteria.update(id, data)
}

export async function deleteLibraryProjectCriterion(id: string) {
  await db.transaction('rw', [db.libraryProjectCriteria, db.libraryDescriptors], async () => {
    await db.libraryDescriptors.where('libraryCriterionId').equals(id).delete()
    await db.libraryProjectCriteria.delete(id)
  })
}

export async function clearLibraryProjectCriteria(libraryProjectId: string) {
  await db.transaction('rw', [db.libraryProjectCriteria, db.libraryDescriptors], async () => {
    const criteria = await db.libraryProjectCriteria.where('libraryProjectId').equals(libraryProjectId).toArray()
    const ids = criteria.map(c => c.id)
    if (ids.length > 0) await db.libraryDescriptors.where('libraryCriterionId').anyOf(ids).delete()
    await db.libraryProjectCriteria.where('libraryProjectId').equals(libraryProjectId).delete()
  })
}

export function useLibraryProjectDescriptors(libraryProjectId: string | undefined) {
  return useLiveQuery(async () => {
    if (!libraryProjectId) return []
    const criteria = await db.libraryProjectCriteria.where('libraryProjectId').equals(libraryProjectId).toArray()
    const ids = criteria.map(c => c.id)
    if (ids.length === 0) return []
    return db.libraryDescriptors.where('libraryCriterionId').anyOf(ids).toArray()
  }, [libraryProjectId]) ?? []
}

export async function setLibraryDescriptor(
  libraryCriterionId: string,
  level: DescriptorLevel,
  text: string,
  score?: number,
) {
  const existing = await db.libraryDescriptors.where('libraryCriterionId').equals(libraryCriterionId).toArray()
  const match = existing.find(d => d.level === level)
  const patch: Partial<LibraryDescriptor> = { text }
  if (score !== undefined) patch.score = score
  if (match) {
    await db.libraryDescriptors.update(match.id, patch)
  } else {
    const d: LibraryDescriptor = { id: newId(), libraryCriterionId, level, text, ...(score !== undefined ? { score } : {}) }
    await db.libraryDescriptors.add(d)
  }
}

export async function reorderLibraryProjectCriteria(orderedIds: string[]) {
  await db.transaction('rw', db.libraryProjectCriteria, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.libraryProjectCriteria.update(orderedIds[i], { sortIndex: i })
    }
  })
}
