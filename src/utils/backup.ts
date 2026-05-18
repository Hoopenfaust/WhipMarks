import { db } from '../db/db'
import type { Class, Student, Project, RubricCriterion, Mark, RubricDescriptor, RubricTemplate, ScheduleWeek } from '../types'

const LS_KEY = 'gradedesk-backup'

interface BackupPayload {
  v: number
  ts: number
  classes: Class[]
  students: Student[]
  projects: Project[]
  criteria: RubricCriterion[]
  marks: Mark[]
  projectSheets?: { id: string; projectId: string; mimeType: string; filename: string; data: string }[]
  descriptors?: RubricDescriptor[]
  rubricTemplates?: RubricTemplate[]
  scheduleWeeks?: ScheduleWeek[]
}

// ── LocalStorage (auto, no binary sheets) ────────────────────────────────────

export async function saveToLocalStorage() {
  const [classes, students, projects, criteria, marks, descriptors, rubricTemplates, scheduleWeeks] = await Promise.all([
    db.classes.toArray(),
    db.students.toArray(),
    db.projects.toArray(),
    db.criteria.toArray(),
    db.marks.toArray(),
    db.descriptors.toArray(),
    db.rubricTemplates.toArray(),
    db.scheduleWeeks.toArray(),
  ])
  const payload: BackupPayload = { v: 1, ts: Date.now(), classes, students, projects, criteria, marks, descriptors, rubricTemplates, scheduleWeeks }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload))
  } catch {
    // Quota exceeded — silently skip
  }
}

export function localStorageBackupDate(): Date | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as BackupPayload
    return new Date(p.ts)
  } catch { return null }
}

export async function restoreFromLocalStorage(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return false
    const payload = JSON.parse(raw) as BackupPayload
    if (!payload.classes?.length && !payload.students?.length) return false
    await applyPayload(payload)
    return true
  } catch { return false }
}

// ── File backup/restore (full, includes project sheets) ──────────────────────

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function downloadBackup() {
  const [classes, students, projects, criteria, marks, sheets, descriptors, rubricTemplates, scheduleWeeks] = await Promise.all([
    db.classes.toArray(),
    db.students.toArray(),
    db.projects.toArray(),
    db.criteria.toArray(),
    db.marks.toArray(),
    db.projectSheets.toArray(),
    db.descriptors.toArray(),
    db.rubricTemplates.toArray(),
    db.scheduleWeeks.toArray(),
  ])
  const payload: BackupPayload = {
    v: 1,
    ts: Date.now(),
    classes, students, projects, criteria, marks,
    projectSheets: sheets.map(s => ({ ...s, data: arrayBufferToBase64(s.data) })),
    descriptors,
    rubricTemplates,
    scheduleWeeks,
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gradedesk-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function restoreFromFile(file: File) {
  const text = await file.text()
  const payload = JSON.parse(text) as BackupPayload
  await applyPayload(payload, true)
}

// ── Shared restore logic ──────────────────────────────────────────────────────

async function applyPayload(payload: BackupPayload, includeSheets = false) {
  await db.transaction('rw', [
    db.classes, db.students, db.projects, db.criteria,
    db.marks, db.projectSheets, db.descriptors, db.rubricTemplates, db.scheduleWeeks,
  ], async () => {
    await db.classes.clear()
    await db.students.clear()
    await db.projects.clear()
    await db.criteria.clear()
    await db.marks.clear()
    await db.projectSheets.clear()
    await db.descriptors.clear()
    await db.rubricTemplates.clear()
    await db.scheduleWeeks.clear()

    if (payload.classes?.length)         await db.classes.bulkAdd(payload.classes)
    if (payload.students?.length)        await db.students.bulkAdd(payload.students)
    if (payload.projects?.length)        await db.projects.bulkAdd(payload.projects)
    if (payload.criteria?.length)        await db.criteria.bulkAdd(payload.criteria)
    if (payload.marks?.length)           await db.marks.bulkAdd(payload.marks)
    if (payload.descriptors?.length)     await db.descriptors.bulkAdd(payload.descriptors)
    if (payload.rubricTemplates?.length) await db.rubricTemplates.bulkAdd(payload.rubricTemplates)
    if (payload.scheduleWeeks?.length)   await db.scheduleWeeks.bulkAdd(payload.scheduleWeeks)
    if (includeSheets && payload.projectSheets?.length) {
      await db.projectSheets.bulkAdd(
        payload.projectSheets.map(s => ({ ...s, data: base64ToArrayBuffer(s.data) }))
      )
    }
  })
}
