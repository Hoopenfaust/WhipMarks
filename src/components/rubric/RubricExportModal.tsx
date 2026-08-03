import { Printer, X } from 'lucide-react'
import type { Project, RubricCriterion, RubricDescriptor } from '../../types'
import { LEVELS } from '../../utils/levels'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
function today() {
  const d = new Date()
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page:          { fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111', background: 'white' },
  header:        { background: '#111', padding: '18px 28px' },
  headerRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLabel:   { color: 'rgba(255,255,255,0.45)', fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 5px' },
  headerName:    { color: 'white', fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.15 },
  headerRight:   { textAlign: 'right' },
  headerBrand:   { color: 'rgba(255,255,255,0.35)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 3px' },
  headerDate:    { color: 'rgba(255,255,255,0.65)', fontSize: 10, margin: 0 },
  meta:          { background: '#f5f5f5', borderBottom: '1px solid #ddd', padding: '16px 28px', display: 'flex', gap: 36, flexWrap: 'wrap' },
  metaLabel:     { fontSize: 8, color: '#999', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, margin: '0 0 4px' },
  metaValue:     { fontSize: 16, fontWeight: 600, color: '#222', margin: 0 },
  body:          { padding: '20px 28px' },
  critBlock:     { breakInside: 'avoid', marginBottom: 22 },
  critHeadRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '2px solid #111', paddingBottom: 8, marginBottom: 12 },
  critName:      { fontSize: 16, fontWeight: 800, color: '#111', margin: 0 },
  critDesc:      { fontSize: 11, color: '#777', margin: '4px 0 0', maxWidth: 420 },
  critBadges:    { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  badge:         { fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' },
  badgeMarks:    { background: '#eee', color: '#444' },
  badgeWeight:   { background: '#111', color: 'white' },
  grid:          { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  levelCell:     { border: '1px solid #e2e2e2', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  levelHead:     { padding: '6px 9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  levelLabel:    { fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' },
  levelScore:    { fontSize: 8.5, fontWeight: 700, color: '#fff', background: '#111', borderRadius: 999, padding: '1px 6px' },
  levelText:     { fontSize: 10, color: '#333', padding: '8px 9px', lineHeight: 1.4, flex: 1, margin: 0 },
  levelTextEmpty:{ fontSize: 10, color: '#bbb', fontStyle: 'italic', padding: '8px 9px', margin: 0 },
  footer:        { borderTop: '1px solid #ebebeb', padding: '8px 28px', display: 'flex', justifyContent: 'space-between' },
  footerText:    { fontSize: 8, color: '#bbb', margin: 0 },
}

const LEVEL_ACCENT: Record<string, string> = {
  excellent: '#10b981',
  good: '#3b82f6',
  satisfactory: '#f59e0b',
  poor: '#ef4444',
}

// ─── Rubric document ────────────────────────────────────────────────────────

interface DocProps {
  project: Project
  className: string
  criteria: RubricCriterion[]
  descriptors: RubricDescriptor[]
}

function RubricDocument({ project, className, criteria, descriptors }: DocProps) {
  const sorted = criteria.slice().sort((a, b) => a.sortIndex - b.sortIndex)

  return (
    <div className="print-report" style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerRow}>
          <div>
            <p style={S.headerLabel}>Assessment Rubric</p>
            <h1 style={S.headerName}>{project.name}</h1>
          </div>
          <div style={S.headerRight}>
            <p style={S.headerBrand}>WhipMarks</p>
            <p style={S.headerDate}>{today()}</p>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={S.meta}>
        <div><p style={S.metaLabel}>Class</p><p style={S.metaValue}>{className}</p></div>
        {project.dueDate && <div><p style={S.metaLabel}>Due Date</p><p style={S.metaValue}>{fmtDate(project.dueDate)}</p></div>}
        <div><p style={S.metaLabel}>Total Marks</p><p style={S.metaValue}>{project.totalMarks}</p></div>
        {project.semesterWeight > 0 && (
          <div><p style={S.metaLabel}>Semester Weight</p><p style={S.metaValue}>{Math.round(project.semesterWeight * 100)}%</p></div>
        )}
      </div>

      {/* Criteria */}
      <div style={S.body}>
        {sorted.length === 0 && (
          <p style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '24px 0' }}>No criteria have been added to this rubric yet.</p>
        )}
        {sorted.map(c => {
          const byLevel = descriptors.filter(d => d.criterionId === c.id)
          return (
            <div key={c.id} style={S.critBlock}>
              <div style={S.critHeadRow}>
                <div>
                  <p style={S.critName}>{c.name || 'Untitled criterion'}</p>
                  {c.description && <p style={S.critDesc}>{c.description}</p>}
                </div>
                <div style={S.critBadges}>
                  <span style={{ ...S.badge, ...S.badgeMarks }}>{c.maxMarks} pts</span>
                  <span style={{ ...S.badge, ...S.badgeWeight }}>{Math.round(c.weight * 100)}%</span>
                </div>
              </div>

              <div style={S.grid}>
                {LEVELS.map(level => {
                  const d = byLevel.find(x => x.level === level.id)
                  const score = d?.score ?? level.defaultScore
                  const points = Math.round(score * c.maxMarks)
                  const text = d?.text.trim()
                  return (
                    <div key={level.id} style={S.levelCell}>
                      <div style={{ ...S.levelHead, borderBottom: `2px solid ${LEVEL_ACCENT[level.id]}` }}>
                        <span style={{ ...S.levelLabel, color: LEVEL_ACCENT[level.id] }}>{level.shortLabel}</span>
                        <span style={S.levelScore}>{points} pts</span>
                      </div>
                      {text
                        ? <p style={S.levelText}>{text}</p>
                        : <p style={S.levelTextEmpty}>No descriptor set</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <p style={S.footerText}>Generated by WhipMarks</p>
        <p style={S.footerText}>{className} · {project.name}</p>
      </div>

    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

interface Props extends DocProps {
  onClose: () => void
}

export function RubricExportModal({ onClose, ...docProps }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-3xl" onClick={e => e.stopPropagation()}>

        <div className="print:hidden flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-100">{docProps.project.name}</p>
            <p className="text-xs text-gray-400">Rubric export preview</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-100/80 text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg"
            >
              <Printer size={15} />
              Save as PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden shadow-2xl">
          <RubricDocument {...docProps} />
        </div>

        <p className="print:hidden text-center text-xs text-gray-400/70 mt-3">
          "Save as PDF" → select Microsoft Print to PDF in the dialog
        </p>
      </div>
    </div>
  )
}
