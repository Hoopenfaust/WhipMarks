import { useParams, Link } from 'react-router-dom'
import { Download, ChevronRight } from 'lucide-react'
import { useClass } from '../db/hooks/useClasses'
import { useStudents } from '../db/hooks/useStudents'
import { useProjects } from '../db/hooks/useProjects'
import { useAllMarksForClass } from '../db/hooks/useMarks'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { calcProjectPercentage, calcSemesterMark, gradeBg, weightTotal } from '../utils/marks'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

export function SemesterSummaryView() {
  const { classId } = useParams<{ classId: string }>()
  const classObj = useClass(classId)
  const students = useStudents(classId)
  const projects = useProjects(classId)

  const projectIds = projects.map(p => p.id)
  const marks = useAllMarksForClass(projectIds)

  const allCriteria = useLiveQuery(
    () => projectIds.length > 0 ? db.criteria.where('projectId').anyOf(projectIds).toArray() : [],
    [projectIds.join(',')]
  ) ?? []

  const activeProjects = projects.filter(p => p.semesterWeight > 0)
  const totalWeight = weightTotal(projects)

  function getProjectPct(studentId: string, projectId: string) {
    const projectCriteria = allCriteria.filter(c => c.projectId === projectId)
    const studentMarks = marks.filter(m => m.studentId === studentId && m.projectId === projectId)
    return calcProjectPercentage(studentMarks, projectCriteria)
  }

  function getSemesterMark(studentId: string) {
    return calcSemesterMark(
      activeProjects.map(p => ({
        weight: p.semesterWeight,
        percentage: getProjectPct(studentId, p.id),
      }))
    )
  }

  function exportCsv() {
    const headers = ['Student', ...activeProjects.map(p => `${p.name} (${Math.round(p.semesterWeight * 100)}%)`), 'Semester Mark']
    const rows = students.map(s => [
      s.name,
      ...activeProjects.map(p => getProjectPct(s.id, p.id).toFixed(1)),
      getSemesterMark(s.id).toFixed(1),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${classObj?.name ?? 'class'}-semester.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!classObj) return <div className="p-8 text-gray-500 text-sm">Class not found.</div>

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-800 px-8 py-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2.5">
            <Link to="/classes" className="hover:text-gray-300">Classes</Link>
            <ChevronRight size={14} />
            <Link to={`/classes/${classId}`} className="hover:text-gray-300">{classObj.name}</Link>
            <ChevronRight size={14} />
            <span className="text-gray-300">Semester Summary</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-100">Semester Summary</h1>
            <Badge variant={Math.abs(totalWeight - 1) < 0.01 ? 'success' : 'warning'}>
              Total weight: {Math.round(totalWeight * 100)}%
            </Badge>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <Download size={15} /> Export CSV
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeProjects.length === 0 ? (
          <p className="p-8 text-sm text-gray-600">No weighted projects yet. Add projects with a semester weight &gt; 0.</p>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-gray-900 border-b border-r border-gray-800 px-5 py-3 text-left text-xs font-semibold text-gray-500 min-w-40 whitespace-nowrap">
                  Student
                </th>
                {activeProjects.map(p => (
                  <th key={p.id} className="sticky top-0 z-10 bg-gray-900 border-b border-r border-gray-800 px-4 py-3 text-left whitespace-nowrap">
                    <Link to={`/classes/${classId}/projects/${p.id}`} className="hover:text-orange-400 transition-colors">
                      <div className="text-xs font-semibold text-gray-300">{p.name}</div>
                      <div className="text-xs text-gray-600">{Math.round(p.semesterWeight * 100)}% of semester</div>
                    </Link>
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-5 py-3 text-left text-xs font-semibold text-orange-400 whitespace-nowrap">
                  Semester Mark
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const semester = getSemesterMark(s.id)
                return (
                  <tr key={s.id} className="hover:bg-gray-900/50">
                    <td className="sticky left-0 bg-gray-950 border-b border-r border-gray-800 px-5 py-3 text-gray-300 font-medium whitespace-nowrap">
                      {s.name}
                    </td>
                    {activeProjects.map(p => {
                      const pct = getProjectPct(s.id, p.id)
                      const projectCriteria = allCriteria.filter(c => c.projectId === p.id)
                      const studentMarks = marks.filter(m => m.studentId === s.id && m.projectId === p.id)
                      const complete = projectCriteria.every(c => studentMarks.some(m => m.criterionId === c.id))
                      return (
                        <td key={p.id} className="border-b border-r border-gray-800 px-4 py-3">
                          {complete ? (
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${gradeBg(pct)}`}>
                              {pct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-gray-800 px-5 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-bold ${gradeBg(semester)}`}>
                        {semester.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Class averages footer */}
            <tfoot>
              <tr className="bg-gray-900">
                <td className="sticky left-0 bg-gray-900 border-t border-gray-700 px-5 py-2.5 text-xs font-semibold text-gray-500">Class average</td>
                {activeProjects.map(p => {
                  const pcts = students.map(s => {
                    const projectCriteria = allCriteria.filter(c => c.projectId === p.id)
                    const sm = marks.filter(m => m.studentId === s.id && m.projectId === p.id)
                    return { pct: calcProjectPercentage(sm, projectCriteria), complete: projectCriteria.every(c => sm.some(m => m.criterionId === c.id)) }
                  }).filter(x => x.complete)
                  const avg = pcts.length > 0 ? pcts.reduce((s, x) => s + x.pct, 0) / pcts.length : null
                  return (
                    <td key={p.id} className="border-t border-r border-gray-700 px-4 py-2.5 text-xs text-gray-500">
                      {avg !== null ? avg.toFixed(1) + '%' : '—'}
                    </td>
                  )
                })}
                <td className="border-t border-gray-700 px-5 py-2.5 text-xs text-gray-500">
                  {(() => {
                    const avgs = students.map(s => getSemesterMark(s.id))
                    return avgs.length > 0 ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) + '%' : '—'
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
