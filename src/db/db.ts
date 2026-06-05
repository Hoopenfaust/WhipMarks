import Dexie, { type Table } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type { Class, Student, Project, RubricCriterion, Mark, ProjectSheet, RubricDescriptor, RubricTemplate, ScheduleWeek, TaMark, TaAssignment, Competency, CriterionCompetency, Snippet, ImprovementNote, LibraryProject, LibraryProjectCriterion, StudentSubmission, SubmissionAnnotation } from '../types'

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
  studentSubmissions!: Table<StudentSubmission>
  submissionAnnotations!: Table<SubmissionAnnotation>

  constructor() {
    super('GradeDesk', { addons: [dexieCloud] })
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
    this.version(10).stores({
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
      studentSubmissions: '&id, [studentId+projectId], projectId',
      submissionAnnotations: '&id, [studentId+projectId]',
    })
  }
}

export const db = new AppDatabase()

// Enable cloud sync when a URL is configured.
// Set VITE_DEXIE_CLOUD_URL in .env.local (desktop) or as a Vercel env var (PWA).
const cloudUrl = import.meta.env.VITE_DEXIE_CLOUD_URL as string | undefined
if (cloudUrl) {
  db.cloud.configure({
    databaseUrl: cloudUrl,
    requireAuth: false,      // app works offline/locally without login; sync is opt-in
    customLoginGui: true,    // we render our own OTP login modal
    socialAuth: false,       // OTP email only — no OAuth popups (works in Tauri + PWA)
    tryUseServiceWorker: false,
    unsyncedTables: [
      'projectSheets',        // raw PDF/image binary — too large to sync
      'taAssignments',        // local TA workflow state
      'taMarks',              // local TA marks before import
      'studentSubmissions',   // raw PDF binary — too large to sync
    ],
  })
}
