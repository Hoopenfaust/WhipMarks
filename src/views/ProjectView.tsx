import { useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useProject, updateProject } from '../db/hooks/useProjects'
import { useCriteria, bulkAddCriteria } from '../db/hooks/useCriteria'
import { useProjectMarks } from '../db/hooks/useMarks'
import { useProjectSheet } from '../db/hooks/useProjectSheet'
import { useStudents } from '../db/hooks/useStudents'
import { useClass } from '../db/hooks/useClasses'
import { useProjectDescriptors } from '../db/hooks/useDescriptors'
import { TabBar } from '../components/ui/TabBar'
import { Badge } from '../components/ui/Badge'
import { FileUploadZone } from '../components/rubric/FileUploadZone'
import { PdfViewer } from '../components/rubric/PdfViewer'
import { CriteriaEditor } from '../components/rubric/CriteriaEditor'
import { RubricBuilder } from '../components/rubric/RubricBuilder'
import { MarkingGrid } from '../components/marking/MarkingGrid'
import { StudentReportModal } from '../components/marking/StudentReportModal'
import { projectMarkingProgress } from '../utils/marks'
import type { Student } from '../types'
import { generateRubricFromDocument } from '../utils/claude'
import type { ProjectSheet } from '../types'

const TABS = [
  { id: 'builder', label: 'Build Rubric' },
  { id: 'rubric', label: 'Rubric' },
  { id: 'marking', label: 'Marking Grid' },
]

export function ProjectView() {
  const { classId, projectId } = useParams<{ classId: string; projectId: string }>()
  const project = useProject(projectId)
  const classObj = useClass(classId)
  const students = useStudents(classId)
  const criteria = useCriteria(projectId)
  const marks = useProjectMarks(projectId)
  const sheet = useProjectSheet(projectId)
  const descriptors = useProjectDescriptors(projectId)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'builder'
  function setTab(t: string) { setSearchParams({ tab: t }) }
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [reportStudent, setReportStudent] = useState<Student | null>(null)

  if (!project || !classObj) return <div className="p-8 text-gray-500 text-sm">Project not found.</div>

  const { marked, total } = projectMarkingProgress(marks, students, projectId!, criteria)
  const progress = total > 0 ? Math.round((marked / total) * 100) : 0

  async function runGeneration(s: ProjectSheet) {
    setGenerating(true)
    setGenError(null)
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

  function handleUploaded(uploaded: ProjectSheet) {
    runGeneration(uploaded)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb header */}
      <div className="border-b border-gray-800 px-8 py-6">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2.5">
          <Link to="/classes" className="hover:text-gray-300">Classes</Link>
          <ChevronRight size={14} />
          <Link to={`/classes/${classId}`} className="hover:text-gray-300">{classObj.name}</Link>
          <ChevronRight size={14} />
          <Link to={`/classes/${classId}?tab=projects`} className="hover:text-gray-300">Projects</Link>
          <ChevronRight size={14} />
          <span className="text-gray-300">{project.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-100">{project.name}</h1>
          <Badge variant="orange">{Math.round(project.semesterWeight * 100)}% of semester</Badge>
          {project.dueDate && (
            <Badge variant="default">Due {new Date(project.dueDate).toLocaleDateString()}</Badge>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span>{marked}/{total} marked</span>
          </div>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* BUILD RUBRIC TAB */}
      {tab === 'builder' && (
        <div className="flex-1 overflow-hidden flex">
          <RubricBuilder projectId={projectId!} criteria={criteria} projectName={project.name} />
        </div>
      )}

      {/* RUBRIC TAB */}
      {tab === 'rubric' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: PDF viewer */}
          <div className="flex-1 overflow-hidden border-r border-gray-800 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project Sheet</span>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              {sheet ? <PdfViewer sheet={sheet} /> : <FileUploadZone projectId={projectId!} sheet={sheet} onUploaded={handleUploaded} />}
            </div>
            {sheet && (
              <div className="px-4 pb-4">
                <FileUploadZone projectId={projectId!} sheet={sheet} onUploaded={handleUploaded} />
              </div>
            )}
          </div>

          {/* Right: Criteria editor */}
          <div className="w-96 shrink-0 overflow-y-auto p-4 flex flex-col gap-3">
            {genError && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                {genError}
              </div>
            )}
            <CriteriaEditor
              projectId={projectId!}
              criteria={criteria}
              generating={generating}
              onRequestGenerate={sheet ? () => runGeneration(sheet) : undefined}
            />
          </div>
        </div>
      )}

      {/* MARKING GRID TAB */}
      {tab === 'marking' && (
        <div className="flex-1 overflow-hidden">
          <MarkingGrid
            students={students}
            criteria={criteria}
            marks={marks}
            projectId={projectId!}
            descriptors={descriptors}
            onExportStudent={setReportStudent}
          />
        </div>
      )}

      {/* PDF export modal */}
      {reportStudent && (
        <StudentReportModal
          student={reportStudent}
          project={project}
          className={classObj.name}
          criteria={criteria}
          marks={marks.filter(m => m.studentId === reportStudent.id)}
          onClose={() => setReportStudent(null)}
        />
      )}
    </div>
  )
}
