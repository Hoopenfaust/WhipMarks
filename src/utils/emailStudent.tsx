import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { Student, RubricCriterion, Mark, Group } from '../types'
import { db } from '../db/db'
import { StudentReport } from '../components/marking/StudentReportModal'
import { recordEmail, markSnapshot } from '../db/hooks/useEmailLogs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTauri = () => typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
const firstNameOf = (s: Student) => s.firstName || s.name.split(' ')[0]
const displayNameOf = (s: Student) => s.firstName ? `${s.firstName} ${s.name}` : s.name

/**
 * Desktop only: write a student's PDF marking sheet (and submission, if uploaded) to temp files
 * and return their paths. Returns the improvement note too, for the email log snapshot.
 */
async function buildAttachments(student: Student, projectId: string, criteria: RubricCriterion[], studentMarks: Mark[]) {
  const { invoke } = await import('@tauri-apps/api/core')
  const [project, improvement, submission] = await Promise.all([
    db.projects.get(projectId),
    db.improvementNotes.where('[studentId+projectId]').equals([student.id, projectId]).first(),
    db.studentSubmissions.where('[studentId+projectId]').equals([student.id, projectId]).first(),
  ])
  const displayName = displayNameOf(student)
  const paths: string[] = []

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
      paths.push(await invoke<string>('page_pdf_to_temp', { filename: `${displayName}_${project.name}.pdf` }))
    } finally {
      root.unmount()
      host.remove()
    }
  }

  if (submission) {
    const safeName = `${student.name.replace(/[^a-z0-9]/gi, '_')}_submission.pdf`
    paths.push(await invoke<string>('write_temp_file', { filename: safeName, data: Array.from(new Uint8Array(submission.data)) }))
  }

  return { paths, improvementNote: improvement?.text }
}

/**
 * Email a student their mark for a project. Desktop: opens the mail client with the PDF
 * marking sheet (and submission, if uploaded) attached. PWA / iPad: mailto link, no attachments.
 * `marks` may include other students' marks; only this student's are used.
 * Records the email (see useEmailLogs) once the mail client or mailto link has been opened.
 */
export async function emailStudentMark(student: Student, projectId: string, criteria: RubricCriterion[], marks: Mark[]) {
  if (!student.email) return
  const studentMarks = marks.filter(m => m.studentId === student.id)
  const project = await db.projects.get(projectId)
  const body = `Hello ${firstNameOf(student)}\n\nPlease find your ${project?.name ?? 'project'} assessment attached to this email.`
  const subject = `Assessment Feedback: ${displayNameOf(student)}`

  if (!isTauri()) {
    const improvement = await db.improvementNotes.where('[studentId+projectId]').equals([student.id, projectId]).first()
    window.location.href = `mailto:${student.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    await recordEmail(student.id, projectId, markSnapshot(studentMarks, improvement?.text))
    return
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const { paths, improvementNote } = await buildAttachments(student, projectId, criteria, studentMarks)
  await invoke('open_outlook', { to: student.email, subject, body, attachmentPaths: paths })
  await recordEmail(student.id, projectId, markSnapshot(studentMarks, improvementNote))
}

/**
 * Email a whole group in one message: To the first member, CC the rest, with every member's
 * own marking sheet (and submission) attached. Members without an email address are skipped.
 * Records the email against each member, so their individual mail icons turn green too.
 */
export async function emailGroupMark(group: Group, members: Student[], projectId: string, criteria: RubricCriterion[], marks: Mark[]) {
  const recipients = members.filter(s => s.email)
  if (recipients.length === 0) return
  const project = await db.projects.get(projectId)
  const names = recipients.map(firstNameOf)
  const greeting = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  const body = `Hello ${greeting}\n\nPlease find your ${project?.name ?? 'project'} assessments attached to this email.`
  const subject = `Assessment Feedback: ${group.name}`
  const [to, ...ccList] = recipients.map(s => s.email!)
  const cc = ccList.join('; ')

  if (!isTauri()) {
    window.location.href = `mailto:${to}?cc=${encodeURIComponent(ccList.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    for (const s of recipients) {
      const improvement = await db.improvementNotes.where('[studentId+projectId]').equals([s.id, projectId]).first()
      await recordEmail(s.id, projectId, markSnapshot(marks.filter(m => m.studentId === s.id), improvement?.text))
    }
    return
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const built = []
  for (const s of recipients) built.push(await buildAttachments(s, projectId, criteria, marks.filter(m => m.studentId === s.id)))
  await invoke('open_outlook', { to, cc, subject, body, attachmentPaths: built.flatMap(b => b.paths) })
  for (const [i, s] of recipients.entries()) {
    await recordEmail(s.id, projectId, markSnapshot(marks.filter(m => m.studentId === s.id), built[i].improvementNote))
  }
}
