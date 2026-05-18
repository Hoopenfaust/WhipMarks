import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ScheduleWeek } from '../../types'
import { newId } from '../../utils/id'

export function useScheduleWeeks(classId: string | undefined) {
  return useLiveQuery(
    () => classId ? db.scheduleWeeks.where('classId').equals(classId).toArray() : [],
    [classId]
  ) ?? []
}

export async function upsertScheduleWeek(
  classId: string,
  weekNumber: number,
  title: string,
  notes: string,
  existingId?: string,
) {
  if (existingId) {
    await db.scheduleWeeks.update(existingId, { title, notes })
  } else if (title || notes) {
    // Only persist if there's actual content
    const row: ScheduleWeek = { id: newId(), classId, weekNumber, title, notes }
    await db.scheduleWeeks.add(row)
  }
}
