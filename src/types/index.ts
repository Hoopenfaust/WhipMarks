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
