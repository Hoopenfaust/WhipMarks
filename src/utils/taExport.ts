import type { TaAssignmentFile, TaResultsFile, TaMark, TaAssignment } from '../types'

// ─── Teacher exports: .whipmarks-ta ──────────────────────────────────────────

export function downloadTaAssignment(file: TaAssignmentFile) {
  const json = JSON.stringify(file, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const safe = file.projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  a.href     = url
  a.download = `ta-assignment-${safe}.whipmarks-ta`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── TA imports assignment file ───────────────────────────────────────────────

export function parseTaAssignmentFile(json: string): TaAssignment {
  const file = JSON.parse(json) as TaAssignmentFile
  if (file.version !== 1) throw new Error('Unrecognised file version')
  return {
    projectId:   file.projectId,
    projectName: file.projectName,
    className:   file.className,
    taName:      file.taName,
    students:    file.students,
    criteria:    file.criteria,
    descriptors: file.descriptors,
    importedAt:  Date.now(),
  }
}

// ─── TA exports results: .whipmarks-taresults ────────────────────────────────

export function downloadTaResults(
  projectId: string,
  projectName: string,
  taName: string,
  taMarks: TaMark[],
) {
  const file: TaResultsFile = {
    version:     1,
    projectId,
    projectName,
    taName,
    exportedAt:  Date.now(),
    marks: taMarks.map(m => ({
      studentId:   m.studentId,
      criterionId: m.criterionId,
      score:       m.score,
      feedback:    m.feedback,
    })),
  }
  const json = JSON.stringify(file, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const safe = projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  a.href     = url
  a.download = `ta-results-${taName.replace(/\s+/g, '-').toLowerCase()}-${safe}.whipmarks-taresults`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Teacher imports TA results ───────────────────────────────────────────────

export function parseTaResultsFile(json: string): TaResultsFile {
  const file = JSON.parse(json) as TaResultsFile
  if (file.version !== 1) throw new Error('Unrecognised file version')
  return file
}

// ─── File picker helpers ──────────────────────────────────────────────────────

export function openFilePicker(accept: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file selected'))
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    }
    input.click()
  })
}
