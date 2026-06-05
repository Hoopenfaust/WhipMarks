export interface Class {
  id: string
  name: string
  createdAt: number
  startDate?: string   // ISO date string — Monday of Week 1
}

export interface ScheduleWeek {
  id: string
  classId: string
  weekNumber: number   // 1–13
  title: string
  notes: string
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Student {
  id: string
  classId: string
  name: string
  firstName?: string
  email?: string
  photo?: string       // base64 data URL, resized thumbnail
  notes?: string       // free-text teacher notes
  checklistItems?: string  // JSON: ChecklistItem[]
  sortIndex: number
}

export interface Project {
  id: string
  classId: string
  name: string
  startDate?: string   // ISO date string — project start (optional)
  dueDate: string
  semesterWeight: number
  totalMarks: number
  createdAt: number
}

export interface RubricCriterion {
  id: string
  projectId: string
  name: string
  description: string
  maxMarks: number
  weight: number
  sortIndex: number
}

export interface Mark {
  id: string
  studentId: string
  projectId: string
  criterionId: string
  score: number
  feedback: string
  updatedAt: number
}

export interface ProjectSheet {
  id: string
  projectId: string
  data: ArrayBuffer
  mimeType: string
  filename: string
}

export type DescriptorLevel = 'excellent' | 'good' | 'satisfactory' | 'poor'

export interface RubricDescriptor {
  id: string
  criterionId: string
  level: DescriptorLevel
  text: string
  score?: number  // fraction of maxMarks (0–1); defaults to level's defaultScore if absent
}

export interface TaMark {
  id: string
  studentId: string
  projectId: string
  criterionId: string
  score: number
  feedback: string
  taName: string
  updatedAt: number
}

// Persisted on the TA's machine while they work
export interface TaAssignment {
  projectId: string          // primary key
  projectName: string
  className: string
  taName: string
  students: { id: string; name: string; firstName?: string }[]
  criteria: RubricCriterion[]
  descriptors: RubricDescriptor[]
  importedAt: number
}

// The file the teacher exports → TA opens
export interface TaAssignmentFile {
  version: 1
  projectId: string
  projectName: string
  className: string
  taName: string
  students: { id: string; name: string; firstName?: string }[]
  criteria: RubricCriterion[]
  descriptors: RubricDescriptor[]
  exportedAt: number
}

// The file the TA exports → teacher imports
export interface TaResultsFile {
  version: 1
  projectId: string
  projectName: string
  taName: string
  exportedAt: number
  marks: { studentId: string; criterionId: string; score: number; feedback: string }[]
}

export interface Competency {
  id: string
  projectId: string
  name: string
  description: string
  sortIndex: number
}

export interface CriterionCompetency {
  id: string
  criterionId: string
  competencyId: string
}

export interface Snippet {
  id: string
  projectId: string
  label: string
  text: string
  usageCount: number
  createdAt: number
}

export interface ImprovementNote {
  id: string
  studentId: string
  projectId: string
  text: string
  updatedAt: number
}

// ─── Student Submissions & Annotations ──────────────────────────────────────

export interface StudentSubmission {
  id: string
  studentId: string
  projectId: string
  data: ArrayBuffer        // raw PDF bytes
  filename: string
  uploadedAt: number
}

export type AnnotationTool = 'pen' | 'highlight' | 'text' | 'stamp' | 'eraser'
export type StampType = 'check' | 'cross' | 'question' | 'star'

export interface PenStroke {
  id: string
  points: number[][]       // [x, y, pressure] normalized 0–1
  color: string
  width: number
}

export interface TextPin {
  id: string
  x: number                // normalized 0–1
  y: number
  text: string
  color: string
}

export interface HighlightRect {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

export interface AnnotationStamp {
  id: string
  x: number
  y: number
  type: StampType
}

export interface PageAnnotations {
  pageNumber: number
  strokes: PenStroke[]
  textPins: TextPin[]
  highlights: HighlightRect[]
  stamps: AnnotationStamp[]
}

export interface SubmissionAnnotation {
  id: string               // `${studentId}-${projectId}`
  studentId: string
  projectId: string
  pagesJson: string        // JSON.stringify(PageAnnotations[])
  updatedAt: number
}

// ─── Library ─────────────────────────────────────────────────────────────────

export interface LibraryProject {
  id: string
  name: string
  description?: string
  totalMarks: number
  createdAt: number
}

export interface LibraryProjectCriterion {
  id: string
  libraryProjectId: string
  name: string
  description: string
  maxMarks: number
  weight: number
  sortIndex: number
}

export interface RubricTemplate {
  id: string
  name: string
  criteriaJson: string   // JSON.stringify of TemplateCriterion[]
  createdAt: number
}

export interface TemplateCriterion {
  name: string
  description: string
  maxMarks: number
  weight: number   // decimal 0–1
}
