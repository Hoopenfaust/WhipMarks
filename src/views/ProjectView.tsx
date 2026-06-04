import { useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, UserCheck } from 'lucide-react'
import { useProject, updateProject } from '../db/hooks/useProjects'
import { useCriteria, bulkAddCriteria } from '../db/hooks/useCriteria'
import { useProjectMarks } from '../db/hooks/useMarks'
import { useTaMarksForProject } from '../db/hooks/useTaMarks'
import { useProjectSheet } from '../db/hooks/useProjectSheet'
import { useStudents } from '../db/hooks/useStudents'
import { useClass } from '../db/hooks/useClasses'
import { useProjectDescriptors } from '../db/hooks/useDescriptors'
import { useCompetencies, useAllCriterionCompetenciesForProject } from '../db/hooks/useCompetencies'
import { useSnippets } from '../db/hooks/useSnippets'
import { useProjectImprovementNotes } from '../db/hooks/useImprovementNotes'
import { AnalyticsTab } from '../components/project/AnalyticsTab'
import { CompetencyTab } from '../components/project/CompetencyTab'
import { TabBar } from '../components/ui/TabBar'
import { Badge } from '../components/ui/Badge'
import { FileUploadZone } from '../components/rubric/FileUploadZone'
import { PdfViewer } from '../components/rubric/PdfViewer'
import { CriteriaEditor } from '../components/rubric/CriteriaEditor'
import { RubricBuilder } from '../components/rubric/RubricBuilder'
import { MarkingGrid } from '../components/marking/MarkingGrid'
import { StudentReportModal } from '../components/marking/StudentReportModal'
import { TaAssignModal } from '../components/marking/TaAssignModal'
import { TaModerationView } from '../components/marking/TaModerationView'
import { projectMarkingProgress } from '../utils/marks'
import type { Student } from '../types'
import { generateRubricFromDocument } from '../utils/claude'
import type { ProjectSheet } from '../types'

export function ProjectView() {
  const { classId, projectId } = useParams<{ classId: string; projectId: string }>()
  const project     = useProject(projectId)
  const classObj    = useClass(classId)
  const students    = useStudents(classId)
  const criteria    = useCriteria(projectId)
  const marks       = useProjectMarks(projectId)
  const taMarks     = useTaMarksForProject(projectId)
  const sheet       = useProjectSheet(projectId)
  const descriptors = useProjectDescriptors(projectId)

  const competencies   = useCompetencies(projectId)
  const criterionComps = useAllCriterionCompetenciesForProject(criteria.map(c => c.id))
  const snippets            = useSnippets(projectId)
  const improvementNotes    = useProjectImprovementNotes(projectId)

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'builder'
  function setTab(t: string) { setSearchParams({ tab: t }) }

  const [generating, setGenerating]       = useState(false)
  const [genError, setGenError]           = useState<string | null>(null)
  const [reportStudent, setReportStudent] = useState<Student | null>(null)
  const [showAssign, setShowAssign]       = useState(false)
  const [taRefresh, setTaRefresh]         = useState(0)

  if (!project || !classObj) return <div className="p-8 text-gray-400 text-sm">Project not found.</div>

  const hasTaMarks = taMarks.length > 0

  const TABS = [
    { id: 'builder',     label: 'Build Rubric' },
    { id: 'rubric',      label: 'Rubric' },
    { id: 'marking',     label: 'Marking Grid' },
    { id: 'analytics',   label: 'Analytics' },
    { id: 'competencies',label: 'Competencies' },
    { id: 'moderation',  label: 'Moderation' },
  ]

  const { marked, total } = projectMarkingProgress(marks, students, projectId!, criteria)
  const progress = total > 0 ? Math.round((marked / total) * 100) : 0

  async function runGeneration(s: ProjectSheet) {
    setGenerating(true); setGenError(null)
    try {
      const generated = await generateRubricFromDocument(s.data, s.mimeType)
      await bulkAddCriteria(projectId!, generated)
      await updateProject(projectId!, { totalMarks: generated.reduce((sum, c) => sum + c.maxMarks, 0) })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb header */}
      <div className="border-b border-gray-700 px-8 py-6">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2.5">
          <Link to="/classes" className="hover:text-gray-100">Classes</Link>
          <ChevronRight size={14} />
          <Link to={`/classes/${classId}`} className="hover:text-gray-100">{classObj.name}</Link>
          <ChevronRight size={14} />
          <Link to={`/classes/${classId}?tab=projects`} className="hover:text-gray-100">Projects</Link>
          <ChevronRight size={14} />
          <span className="text-gray-100">{project.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-normal text-gray-100">{project.name}</h1>
          <Badge variant="orange">{Math.round(project.semesterWeight * 100)}% of semester</Badge>
          {project.dueDate && (
            <Badge variant="default">Due {new Date(project.dueDate).toLocaleDateString()}</Badge>
          )}
          {hasTaMarks && (
            <Badge variant="default">
              <UserCheck size={11} className="inline mr-1" />
              TA marked
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-3">
            {/* Assign to TA button */}
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500 transition-colors"
            >
              <UserCheck size={13} />
              Assign to TA
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span>{marked}/{total} marked</span>
            </div>
          </div>
        </div>
      </div>

      <div data-tutorial="marking-grid-tab">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* BUILD RUBRIC TAB */}
      {tab === 'builder' && (
        <div className="flex-1 overflow-hidden flex">
          <RubricBuilder projectId={projectId!} criteria={criteria} projectName={project.name} />
        </div>
      )}

      {/* RUBRIC TAB */}
      {tab === 'rubric' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden border-r border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Sheet</span>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              {sheet ? <PdfViewer sheet={sheet} /> : <FileUploadZone projectId={projectId!} sheet={sheet} onUploaded={s => runGeneration(s)} />}
            </div>
            {sheet && (
              <div className="px-4 pb-4">
                <FileUploadZone projectId={projectId!} sheet={sheet} onUploaded={s => runGeneration(s)} />
              </div>
            )}
          </div>
          <div className="w-96 shrink-0 overflow-y-auto p-4 flex flex-col gap-3">
            {genError && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{genError}</div>
            )}
            <CriteriaEditor projectId={projectId!} criteria={criteria} generating={generating}
              onRequestGenerate={sheet ? () => runGeneration(sheet) : undefined} />
          </div>
        </div>
      )}

      {/* MARKING GRID TAB */}
      {tab === 'marking' && (
        <div className="flex-1 overflow-hidden">
          <MarkingGrid
            students={students} criteria={criteria} marks={marks}
            projectId={projectId!} descriptors={descriptors} snippets={snippets}
            onExportStudent={setReportStudent}
          />
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div className="flex-1 overflow-hidden">
          <AnalyticsTab students={students} criteria={criteria} marks={marks} />
        </div>
      )}

      {/* COMPETENCIES TAB */}
      {tab === 'competencies' && (
        <div className="flex-1 overflow-y-auto">
          <CompetencyTab projectId={projectId!} criteria={criteria} />
        </div>
      )}

      {/* MODERATION TAB */}
      {tab === 'moderation' && (
        <div className="flex-1 overflow-y-auto">
          <TaModerationView
            key={taRefresh}
            students={students} criteria={criteria}
            teacherMarks={marks} taMarks={taMarks}
            projectId={projectId!}
            onTaMarksImported={() => setTaRefresh(n => n + 1)}
          />
        </div>
      )}

      {/* PDF report modal */}
      {reportStudent && (
        <StudentReportModal
          student={reportStudent}
          project={project}
          className={classObj.name}
          criteria={criteria}
          marks={marks.filter(m => m.studentId === reportStudent.id)}
          taMarks={taMarks.filter(m => m.studentId === reportStudent.id)}
          taName={taMarks[0]?.taName}
          competencies={competencies}
          criterionCompetencies={criterionComps}
          improvementNote={improvementNotes.find(n => n.studentId === reportStudent.id)?.text}
          onClose={() => setReportStudent(null)}
        />
      )}

      {/* TA assign modal */}
      {showAssign && (
        <TaAssignModal
          project={project}
          className={classObj.name}
          students={students}
          criteria={criteria}
          descriptors={descriptors}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  )
}
