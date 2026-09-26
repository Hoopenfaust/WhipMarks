import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { Student, RubricCriterion, Mark } from '../types'
import { db } from '../db/db'
import { StudentReport } from '../components/marking/StudentReportModal'

/**
 * Email a student their mark for a project. Desktop: opens the mail client with the PDF
 * marking sheet (and submission, if uploaded) attached. PWA / iPad: mailto link, no attachments.
 * `marks` may include other students' marks; only this student's are used.
 */
export async function emailStudentMark(student: Student, projectId: string, criteria: RubricCriterion[], marks: Mark[]) {
  if (!student.email) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
  const firstName = student.firstName || student.name.split(' ')[0]
  const displayName = student.firstName ? `${student.firstName} ${student.name}` : student.name
  const studentMarks = marks.filter(m => m.studentId === student.id)

  const [project, improvement, submission] = await Promise.all([
    db.projects.get(projectId),
    db.improvementNotes.where('[studentId+projectId]').equals([student.id, projectId]).first(),
    db.studentSubmissions.where('[studentId+projectId]').equals([student.id, projectId]).first(),
  ])

  const body = `Hello ${firstName}\n\nPlease find your ${project?.name ?? 'project'} assessment attached to this email.`

  const subject = `Assessment Feedback: ${displayName}`

  if (!isTauri) {
    window.location.href = `mailto:${student.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    return
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const attachmentPaths: string[] = []

  // Marking sheet: render the same report as Project → Save as PDF into a print-only
  // portal (a direct child of <body>, see .print-portal in index.css), then print it to a temp PDF
  if (project) {
    const cls = await db.classes.get(project.classId)
    const taMarks = await db.taMarks.where('studentId').equals(student.id).filter(m => m.projectId === projectId).toArray()
    const host = document.createElement('div')
    host.className = 'print-portal'
    document.body.appendChild(host)
    const root = createRoot(host)
    try {
      flushSync(() => root.render(
        <StudentReport
          student={student} project={project} className={cls?.name ?? ''} criteria={criteria}
          marks={studentMarks} taMarks={taMarks} taName={taMarks[0]?.taName} improvementNote={improvement?.text}
        />
      ))
      await document.fonts.ready
      attachmentPaths.push(await invoke<string>('page_pdf_to_temp', { filename: `${displayName}_${project.name}.pdf` }))
    } finally {
      root.unmount()
      host.remove()
    }
  }

  if (submission) {
    const safeName = `${student.name.replace(/[^a-z0-9]/gi, '_')}_submission.pdf`
    attachmentPaths.push(await invoke<string>('write_temp_file', { filename: safeName, data: Array.from(new Uint8Array(submission.data)) }))
  }

  await invoke('open_outlook', { to: student.email, subject, body, attachmentPaths })
}
