import Dexie, { type Table } from 'dexie'
import type { Class, Student, Project, RubricCriterion, Mark, ProjectSheet, RubricDescriptor, RubricTemplate, ScheduleWeek } from '../types'

class AppDatabase extends Dexie {
  classes!: Table<Class>
  students!: Table<Student>
  projects!: Table<Project>
  criteria!: Table<RubricCriterion>
  marks!: Table<Mark>
  projectSheets!: Table<ProjectSheet>
  descriptors!: Table<RubricDescriptor>
  rubricTemplates!: Table<RubricTemplate>
  scheduleWeeks!: Table<ScheduleWeek>

  constructor() {
    super('GradeDesk')
    this.version(3).stores({
      classes: '&id, createdAt',
      students: '&id, classId, sortIndex',
      projects: '&id, classId, createdAt',
      criteria: '&id, projectId, sortIndex',
      marks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      projectSheets: '&id, projectId',
    })
    this.version(4).stores({
      classes: '&id, createdAt',
      students: '&id, classId, sortIndex',
      projects: '&id, classId, createdAt',
      criteria: '&id, projectId, sortIndex',
      marks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      projectSheets: '&id, projectId',
      descriptors: '&id, criterionId',
      rubricTemplates: '&id, createdAt',
    })
    this.version(5).stores({
      classes: '&id, createdAt',
      students: '&id, classId, sortIndex',
      projects: '&id, classId, createdAt',
      criteria: '&id, projectId, sortIndex',
      marks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      projectSheets: '&id, projectId',
      descriptors: '&id, criterionId',
      rubricTemplates: '&id, createdAt',
      scheduleWeeks: '&id, [classId+weekNumber], classId',
    })
  }
}

export const db = new AppDatabase()
