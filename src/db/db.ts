import Dexie, { type Table } from 'dexie'
import type { Class, Student, Project, RubricCriterion, Mark, ProjectSheet, RubricDescriptor, RubricTemplate, ScheduleWeek, TaMark, TaAssignment, Competency, CriterionCompetency, Snippet, ImprovementNote, LibraryProject, LibraryProjectCriterion } from '../types'

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
  taMarks!: Table<TaMark>
  taAssignments!: Table<TaAssignment>
  competencies!: Table<Competency>
  criterionCompetencies!: Table<CriterionCompetency>
  snippets!: Table<Snippet>
  improvementNotes!: Table<ImprovementNote>
  libraryProjects!: Table<LibraryProject>
  libraryProjectCriteria!: Table<LibraryProjectCriterion>

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
    this.version(6).stores({
      classes: '&id, createdAt',
      students: '&id, classId, sortIndex',
      projects: '&id, classId, createdAt',
      criteria: '&id, projectId, sortIndex',
      marks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      projectSheets: '&id, projectId',
      descriptors: '&id, criterionId',
      rubricTemplates: '&id, createdAt',
      scheduleWeeks: '&id, [classId+weekNumber], classId',
      taMarks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      taAssignments: '&projectId',
    })
    this.version(7).stores({
      classes: '&id, createdAt',
      students: '&id, classId, sortIndex',
      projects: '&id, classId, createdAt',
      criteria: '&id, projectId, sortIndex',
      marks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      projectSheets: '&id, projectId',
      descriptors: '&id, criterionId',
      rubricTemplates: '&id, createdAt',
      scheduleWeeks: '&id, [classId+weekNumber], classId',
      taMarks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      taAssignments: '&projectId',
      competencies: '&id, projectId, sortIndex',
      criterionCompetencies: '&id, criterionId, competencyId',
      snippets: '&id, projectId, createdAt',
    })
    this.version(8).stores({
      classes: '&id, createdAt',
      students: '&id, classId, sortIndex',
      projects: '&id, classId, createdAt',
      criteria: '&id, projectId, sortIndex',
      marks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      projectSheets: '&id, projectId',
      descriptors: '&id, criterionId',
      rubricTemplates: '&id, createdAt',
      scheduleWeeks: '&id, [classId+weekNumber], classId',
      taMarks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      taAssignments: '&projectId',
      competencies: '&id, projectId, sortIndex',
      criterionCompetencies: '&id, criterionId, competencyId',
      snippets: '&id, projectId, createdAt',
      improvementNotes: '&id, [studentId+projectId], projectId',
    })
    this.version(9).stores({
      classes: '&id, createdAt',
      students: '&id, classId, sortIndex',
      projects: '&id, classId, createdAt',
      criteria: '&id, projectId, sortIndex',
      marks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      projectSheets: '&id, projectId',
      descriptors: '&id, criterionId',
      rubricTemplates: '&id, createdAt',
      scheduleWeeks: '&id, [classId+weekNumber], classId',
      taMarks: '&id, [studentId+projectId+criterionId], studentId, projectId',
      taAssignments: '&projectId',
      competencies: '&id, projectId, sortIndex',
      criterionCompetencies: '&id, criterionId, competencyId',
      snippets: '&id, projectId, createdAt',
      improvementNotes: '&id, [studentId+projectId], projectId',
      libraryProjects: '&id, createdAt',
      libraryProjectCriteria: '&id, libraryProjectId, sortIndex',
    })
  }
}

export const db = new AppDatabase()
