import type { Mark, RubricCriterion, Project } from '../types'

export function calcProjectPercentage(
  marks: Mark[],
  criteria: RubricCriterion[]
): number {
  if (criteria.length === 0) return 0
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0)
  if (totalWeight === 0) return 0

  return criteria.reduce((sum, c) => {
    const mark = marks.find(m => m.criterionId === c.id)
    const score = mark?.score ?? 0
    return sum + (score / c.maxMarks) * (c.weight / totalWeight) * 100
  }, 0)
}

export function calcSemesterMark(
  projectSummaries: { weight: number; percentage: number }[]
): number {
  return projectSummaries.reduce(
    (sum, p) => sum + p.weight * p.percentage,
    0
  )
}

export function isMarkingComplete(marks: Mark[], criteria: RubricCriterion[]): boolean {
  return criteria.every(c => marks.some(m => m.criterionId === c.id))
}

export function projectMarkingProgress(
  allMarks: Mark[],
  students: { id: string }[],
  projectId: string,
  criteria: RubricCriterion[]
): { marked: number; total: number } {
  if (criteria.length === 0 || students.length === 0) return { marked: 0, total: students.length }
  const marked = students.filter(s =>
    criteria.every(c => allMarks.some(m => m.studentId === s.id && m.criterionId === c.id && m.projectId === projectId))
  ).length
  return { marked, total: students.length }
}

export function gradeColor(pct: number): string {
  if (pct >= 65) return 'text-emerald-400'
  if (pct >= 50) return 'text-amber-400'
  return 'text-red-400'
}

export function gradeBg(pct: number): string {
  if (pct >= 65) return 'bg-emerald-950 text-emerald-300'
  if (pct >= 50) return 'bg-amber-950 text-amber-300'
  return 'bg-red-950 text-red-300'
}

export function weightTotal(projects: Project[]): number {
  return projects.filter(p => p.semesterWeight > 0).reduce((s, p) => s + p.semesterWeight, 0)
}
