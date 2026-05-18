import { Printer, X } from 'lucide-react'
import type { Student, Project, RubricCriterion, Mark } from '../../types'
import { calcProjectPercentage } from '../../utils/marks'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function levelLabel(pct: number): string {
  if (pct >= 85) return 'Demonstrates Mastery'
  if (pct >= 65) return 'Demonstrates Understanding'
  if (pct >= 45) return 'Demonstrates Some Understanding'
  return 'Needs Improvement'
}

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

// ─── Styles — strict monochrome ───────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page:        { fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111', background: 'white' },

  // Header — solid dark bar
  header:      { background: '#111', padding: '18px 28px' },
  headerRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 5px' },
  headerName:  { color: 'white', fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.15 },
  headerRight: { textAlign: 'right' },
  headerBrand: { color: 'rgba(255,255,255,0.35)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 3px' },
  headerDate:  { color: 'rgba(255,255,255,0.65)', fontSize: 10, margin: 0 },

  // Meta band
  meta:        { background: '#f5f5f5', borderBottom: '1px solid #ddd', padding: '16px 28px', display: 'flex', gap: 36, flexWrap: 'wrap' },
  metaLabel:   { fontSize: 8, color: '#999', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, margin: '0 0 4px' },
  metaValue:   { fontSize: 16, fontWeight: 600, color: '#222', margin: 0 },

  // Table
  tableWrap:   { padding: '18px 28px 16px' },
  tableHead:   { display: 'flex', background: '#333', borderRadius: '4px 4px 0 0', padding: '10px 16px', gap: 8 },
  th:          { fontSize: 9, fontWeight: 700, color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.14em' },
  rowEven:     { background: 'white',   borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #ebebeb' },
  rowOdd:      { background: '#f9f9f9', borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #ebebeb' },
  rowCells:    { display: 'flex', padding: '24px 16px', gap: 8, alignItems: 'center' },
  critName:    { fontSize: 14, fontWeight: 600, color: '#111', margin: 0 },
  critDesc:    { fontSize: 11, color: '#888', margin: '3px 0 0' },

  // Feedback — Architex font, all caps
  feedbackWrap:{ padding: '4px 28px 28px 28px' },
  feedbackText:{ fontFamily: "'Architex', sans-serif", fontSize: 26, color: '#333', lineHeight: 1.8, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' },

  // Overall
  overall:     { borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', borderRadius: '0 0 4px 4px', background: '#f5f5f5', borderTop: '2px solid #333', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  // Footer
  footer:      { borderTop: '1px solid #ebebeb', padding: '8px 28px', display: 'flex', justifyContent: 'space-between' },
  footerText:  { fontSize: 8, color: '#bbb', margin: 0 },
}

// ─── Report document ──────────────────────────────────────────────────────────

interface ReportProps {
  student: Student
  project: Project
  className: string
  criteria: RubricCriterion[]
  marks: Mark[]
}

function StudentReport({ student, project, className, criteria, marks }: ReportProps) {
  const displayName = student.firstName ? `${student.firstName} ${student.name}` : student.name
  const overallPct  = calcProjectPercentage(marks, criteria)

  function getMark(criterionId: string) {
    return marks.find(m => m.criterionId === criterionId)
  }

  return (
    <div className="print-report" style={S.page}>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.headerRow}>
          <div>
            <p style={S.headerLabel}>Student Assessment Report</p>
            <h1 style={S.headerName}>{displayName}</h1>
          </div>
          <div style={S.headerRight}>
            <p style={S.headerBrand}>GradeDesk</p>
            <p style={S.headerDate}>{today()}</p>
          </div>
        </div>
      </div>

      {/* ── Meta ── */}
      <div style={S.meta}>
        <div><p style={S.metaLabel}>Class</p><p style={S.metaValue}>{className}</p></div>
        <div><p style={S.metaLabel}>Project</p><p style={{ ...S.metaValue, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em' }}>{project.name}</p></div>
        {project.dueDate && (
          <div><p style={S.metaLabel}>Due Date</p><p style={S.metaValue}>{fmtDate(project.dueDate)}</p></div>
        )}
        <div><p style={S.metaLabel}>Semester Weight</p><p style={S.metaValue}>{Math.round(project.semesterWeight * 100)}%</p></div>
      </div>

      {/* ── Table ── */}
      <div style={S.tableWrap}>

        <div style={S.tableHead}>
          <span style={{ ...S.th, flex: 1 }}>Criterion</span>
          <span style={{ ...S.th, width: 48, textAlign: 'center' }}>Score</span>
          <span style={{ ...S.th, width: 48, textAlign: 'center' }}>Max</span>
          <span style={{ ...S.th, width: 48, textAlign: 'center' }}>Pct</span>
        </div>

        {criteria.map((c, i) => {
          const mark  = getMark(c.id)
          const score = mark?.score
          const pct   = score !== undefined ? (score / c.maxMarks) * 100 : null

          return (
            <div key={c.id} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
              <div style={S.rowCells}>
                <div style={{ flex: 1 }}>
                  <p style={S.critName}>{c.name}</p>
                  {c.description && <p style={S.critDesc}>{c.description}</p>}
                </div>
                <span style={{ width: 48, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#111' }}>
                  {score !== undefined ? score : <span style={{ color: '#ccc' }}>—</span>}
                </span>
                <span style={{ width: 48, textAlign: 'center', fontSize: 11, color: '#aaa' }}>{c.maxMarks}</span>
                <span style={{ width: 48, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#111' }}>
                  {pct !== null ? `${pct.toFixed(0)}%` : <span style={{ color: '#ccc' }}>—</span>}
                </span>
              </div>
              {mark?.feedback && (
                <div style={S.feedbackWrap}>
                  <p style={S.feedbackText}>{mark.feedback}</p>
                </div>
              )}
            </div>
          )
        })}

        {/* Overall */}
        <div style={S.overall}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            Overall Result
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#111', lineHeight: 1 }}>
              {overallPct.toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#555', borderLeft: '1px solid #ccc', paddingLeft: 14 }}>
              {levelLabel(overallPct)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={S.footer}>
        <p style={S.footerText}>Generated by GradeDesk</p>
        <p style={S.footerText}>{displayName} · {project.name}</p>
      </div>

    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export interface StudentReportModalProps extends ReportProps {
  onClose: () => void
}

export function StudentReportModal({ onClose, ...reportProps }: StudentReportModalProps) {
  const displayName = reportProps.student.firstName
    ? `${reportProps.student.firstName} ${reportProps.student.name}`
    : reportProps.student.name

  // NOTE: backdrop must NOT have print:hidden (display:none kills the subtree).
  // body{visibility:hidden} in print CSS suppresses everything; .print-report
  // overrides with visibility:visible.
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-3xl" onClick={e => e.stopPropagation()}>

        {/* Action bar — hidden in print */}
        <div className="print:hidden flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-200">{displayName}</p>
            <p className="text-xs text-gray-500">Assessment report preview</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg"
            >
              <Printer size={15} />
              Save as PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Report */}
        <div className="rounded-xl overflow-hidden shadow-2xl">
          <StudentReport {...reportProps} />
        </div>

        <p className="print:hidden text-center text-xs text-gray-600 mt-3">
          "Save as PDF" → select Microsoft Print to PDF in the dialog
        </p>
      </div>
    </div>
  )
}
