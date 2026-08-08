import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Group, GroupMember } from '../../types'
import { newId } from '../../utils/id'

// Shared with each group's colored card and its members' chips.
export const GROUP_PALETTE = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#ef4444', // rose
  '#84cc16', // lime
]

export function useGroups(projectId: string | undefined) {
  return useLiveQuery(
    () => projectId ? db.groups.where('projectId').equals(projectId).sortBy('sortIndex') : [],
    [projectId]
  ) ?? []
}

export function useGroupMembers(groupIds: string[]) {
  return useLiveQuery(
    () => groupIds.length > 0 ? db.groupMembers.where('groupId').anyOf(groupIds).toArray() : [],
    [groupIds.join(',')]
  ) ?? []
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Replaces any existing groups for this project with a fresh random split of studentIds.
export async function generateGroups(projectId: string, studentIds: string[], groupSize: number): Promise<Group[]> {
  const chunks: string[][] = []
  const pool = shuffled(studentIds)
  for (let i = 0; i < pool.length; i += groupSize) chunks.push(pool.slice(i, i + groupSize))

  return db.transaction('rw', [db.groups, db.groupMembers], async () => {
    const oldGroupIds = (await db.groups.where('projectId').equals(projectId).toArray()).map(g => g.id)
    if (oldGroupIds.length) await db.groupMembers.where('groupId').anyOf(oldGroupIds).delete()
    await db.groups.where('projectId').equals(projectId).delete()

    const now = Date.now()
    const newGroups: Group[] = chunks.map((_, i) => ({
      id: newId(),
      projectId,
      name: `Group ${i + 1}`,
      color: GROUP_PALETTE[i % GROUP_PALETTE.length],
      sortIndex: i,
      createdAt: now,
    }))
    await db.groups.bulkAdd(newGroups)

    const members: GroupMember[] = newGroups.flatMap((g, i) =>
      chunks[i].map(studentId => ({ id: newId(), groupId: g.id, studentId }))
    )
    if (members.length) await db.groupMembers.bulkAdd(members)

    return newGroups
  })
}

export async function renameGroup(groupId: string, name: string) {
  await db.groups.update(groupId, { name })
}

// Moves a student to another existing group, deleting the source group if it's left empty.
export async function moveStudentToGroup(studentId: string, fromGroupId: string, toGroupId: string) {
  if (fromGroupId === toGroupId) return
  await db.transaction('rw', [db.groups, db.groupMembers], async () => {
    const member = await db.groupMembers.where('groupId').equals(fromGroupId).and(m => m.studentId === studentId).first()
    if (member) await db.groupMembers.update(member.id, { groupId: toGroupId })
    else await db.groupMembers.add({ id: newId(), groupId: toGroupId, studentId })

    const remaining = await db.groupMembers.where('groupId').equals(fromGroupId).count()
    if (remaining === 0) await db.groups.delete(fromGroupId)
  })
}

export async function clearGroups(projectId: string) {
  await db.transaction('rw', [db.groups, db.groupMembers], async () => {
    const groupIds = (await db.groups.where('projectId').equals(projectId).toArray()).map(g => g.id)
    if (groupIds.length) await db.groupMembers.where('groupId').anyOf(groupIds).delete()
    await db.groups.where('projectId').equals(projectId).delete()
  })
}

export async function deleteGroupsForProjects(projectIds: string[]) {
  if (projectIds.length === 0) return
  const groupIds = (await db.groups.where('projectId').anyOf(projectIds).toArray()).map(g => g.id)
  if (groupIds.length) await db.groupMembers.where('groupId').anyOf(groupIds).delete()
  await db.groups.where('projectId').anyOf(projectIds).delete()
}
