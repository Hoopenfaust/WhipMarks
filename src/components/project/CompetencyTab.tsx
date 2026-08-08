import { Link } from 'react-router-dom'
import type { RubricCriterion } from '../../types'
import { useCompetencies, useAllCriterionCompetenciesForProject, toggleCriterionCompetency } from '../../db/hooks/useCompetencies'
import { cn } from '../../utils/cn'

interface Props {
  classId: string
  criteria: RubricCriterion[]
}

export function CompetencyTab({ classId, criteria }: Props) {
  const competencies   = useCompetencies(classId)
  const criterionComps = useAllCriterionCompetenciesForProject(criteria.map(c => c.id))

  function isMapped(criterionId: string, competencyId: string) {
    return criterionComps.some(r => r.criterionId === criterionId && r.competencyId === competencyId)
  }

  if (competencies.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="text-sm font-medium text-gray-300">No competencies for this class yet</p>
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
          Add your institution's learning outcomes once from the class's Competencies tab, then come back here to map this project's rubric criteria to them.
        </p>
        <Link
          to={`/classes/${classId}?tab=competencies`}
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
        >
          Go to class Competencies
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-gray-100">Map criteria to competencies</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Check which of this project's rubric criteria demonstrate each course-wide learning outcome.{' '}
          <Link to={`/classes/${classId}?tab=competencies`} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
            Manage the competency list
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {competencies.map(comp => (
          <div key={comp.id} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/50">
              <p className="text-sm font-semibold text-gray-100">{comp.name}</p>
              {comp.description && <p className="text-xs text-gray-400 mt-0.5">{comp.description}</p>}
            </div>
            <div className="px-4 py-2.5 flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold text-gray-400/70 uppercase tracking-wider mb-1">Mapped criteria</p>
              {criteria.length === 0 ? (
                <p className="text-xs text-gray-500">This project has no rubric criteria yet.</p>
              ) : criteria.map(c => {
                const mapped = isMapped(c.id, comp.id)
                return (
                  <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={mapped}
                      onChange={() => toggleCriterionCompetency(c.id, comp.id)}
                      className="accent-indigo-400 w-3.5 h-3.5" />
                    <span className={cn('text-xs transition-colors', mapped ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-300')}>
                      {c.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
