import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Snippet } from '../../types'
import { newId } from '../../utils/id'

export function useSnippets(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.snippets.where('projectId').equals(projectId).sortBy('createdAt') : [],
    [projectId]
  ) ?? []
}

export async function addSnippet(projectId: string, label: string, text: string) {
  const s: Snippet = { id: newId(), projectId, label, text, usageCount: 0, createdAt: Date.now() }
  await db.snippets.add(s)
  return s
}

export async function updateSnippet(id: string, fields: Partial<Pick<Snippet, 'label' | 'text'>>) {
  await db.snippets.update(id, fields)
}

export async function deleteSnippet(id: string) {
  await db.snippets.delete(id)
}

export async function incrementSnippetUsage(id: string) {
  const s = await db.snippets.get(id)
  if (s) await db.snippets.update(id, { usageCount: s.usageCount + 1 })
}
