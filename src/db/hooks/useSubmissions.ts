import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { StudentSubmission, SubmissionAnnotation, PageAnnotations } from '../../types'
import { newId } from '../../utils/id'

export function useSubmission(studentId: string | undefined, projectId: string | undefined) {
  return useLiveQuery(
    () => studentId && projectId
      ? db.studentSubmissions.where('[studentId+projectId]').equals([studentId, projectId]).first()
      : undefined,
    [studentId, projectId]
  )
}

export function useSubmissionAnnotation(studentId: string | undefined, projectId: string | undefined) {
  return useLiveQuery(
    () => studentId && projectId
      ? db.submissionAnnotations.where('[studentId+projectId]').equals([studentId, projectId]).first()
      : undefined,
    [studentId, projectId]
  )
}

export async function saveSubmission(
  studentId: string,
  projectId: string,
  data: ArrayBuffer,
  filename: string
): Promise<StudentSubmission> {
  // Delete existing submission for this student+project first
  await db.studentSubmissions.where('[studentId+projectId]').equals([studentId, projectId]).delete()
  const s: StudentSubmission = { id: newId(), studentId, projectId, data, filename, uploadedAt: Date.now() }
  await db.studentSubmissions.add(s)
  return s
}

export async function deleteSubmission(studentId: string, projectId: string) {
  await db.studentSubmissions.where('[studentId+projectId]').equals([studentId, projectId]).delete()
  await db.submissionAnnotations.where('[studentId+projectId]').equals([studentId, projectId]).delete()
}

export async function saveAnnotations(studentId: string, projectId: string, pages: PageAnnotations[]) {
  const id = `${studentId}-${projectId}`
  const existing = await db.submissionAnnotations.get(id)
  const record: SubmissionAnnotation = {
    id,
    studentId,
    projectId,
    pagesJson: JSON.stringify(pages),
    updatedAt: Date.now(),
  }
  if (existing) await db.submissionAnnotations.put(record)
  else await db.submissionAnnotations.add(record)
}

export function parseAnnotations(annotation: SubmissionAnnotation | undefined): PageAnnotations[] {
  if (!annotation) return []
  try { return JSON.parse(annotation.pagesJson) as PageAnnotations[] } catch { return [] }
}
