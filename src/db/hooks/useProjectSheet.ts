import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ProjectSheet } from '../../types'
import { newId } from '../../utils/id'

export function useProjectSheet(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.projectSheets.where('projectId').equals(projectId).first() : undefined,
    [projectId]
  )
}

export async function saveProjectSheet(projectId: string, file: File): Promise<ProjectSheet> {
  const data = await file.arrayBuffer()
  const existing = await db.projectSheets.where('projectId').equals(projectId).first()

  const sheet: ProjectSheet = {
    id: existing?.id ?? newId(),
    projectId,
    data,
    mimeType: file.type,
    filename: file.name,
  }

  if (existing) {
    await db.projectSheets.update(sheet.id, sheet)
  } else {
    await db.projectSheets.add(sheet)
  }
  return sheet
}

export async function deleteProjectSheet(projectId: string) {
  await db.projectSheets.where('projectId').equals(projectId).delete()
}
