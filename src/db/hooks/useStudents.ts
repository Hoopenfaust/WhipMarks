import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Student, ChecklistItem } from '../../types'
import { newId } from '../../utils/id'

export function useStudents(classId: string | undefined) {
  return useLiveQuery(
    () => classId ? db.students.where('classId').equals(classId).sortBy('sortIndex') : [],
    [classId]
  ) ?? []
}

export interface StudentImportData {
  name: string
  firstName?: string
}

export async function addStudent(classId: string, name: string, sortIndex: number): Promise<Student> {
  const s: Student = { id: newId(), classId, name, sortIndex }
  await db.students.add(s)
  return s
}

export async function bulkAddStudents(classId: string, students: StudentImportData[] | string[], startIndex = 0) {
  const normalized: StudentImportData[] = students.map(s =>
    typeof s === 'string' ? { name: s } : s
  )
  const rows: Student[] = normalized.map((s, i) => ({
    id: newId(),
    classId,
    name: s.name,
    ...(s.firstName ? { firstName: s.firstName } : {}),
    sortIndex: startIndex + i,
  }))
  await db.students.bulkAdd(rows)
  return rows
}

export async function deleteStudent(id: string) {
  await db.transaction('rw', db.students, db.marks, async () => {
    await db.marks.where('studentId').equals(id).delete()
    await db.students.delete(id)
  })
}

export async function updateStudentName(id: string, name: string) {
  await db.students.update(id, { name })
}

export async function updateStudentNames(id: string, firstName: string, name: string) {
  await db.students.update(id, { firstName: firstName || undefined, name })
}

export async function updateStudentPhoto(id: string, photo: string | undefined) {
  await db.students.update(id, { photo })
}

export async function updateStudentNotes(id: string, notes: string) {
  const count = await db.students.update(id, { notes })
  if (count === 0) throw new Error(`updateStudentNotes: student ${id} not found in DB`)
}

export async function updateStudentChecklist(id: string, items: ChecklistItem[]) {
  const count = await db.students.update(id, { checklistItems: JSON.stringify(items) })
  if (count === 0) throw new Error(`updateStudentChecklist: student ${id} not found in DB`)
}
