import { useRef, useState, useEffect } from 'react'
import { FileDown } from 'lucide-react'
import type { Project } from '../../types'

// ─── Layout constants ────────────────────────────────────────────────────────
const SVG_W      = 1800
const LABEL_W    = 320
const PAD_R      = 28
const HEADER_H   = 80
const ROW_H      = 72
const BAR_H      = 38
const TIMELINE_W = SVG_W - LABEL_W - PAD_R

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Screen: colour palette ───────────────────────────────────────────────────
const BAR_COLORS = [
  '#4f86e8', '#9b6dea', '#34c48b', '#e89b34',
  '#e868a4', '#34bfd4', '#e86830', '#34b8a6', '#7b82f4',
]
function barColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return BAR_COLORS[Math.abs(h) % BAR_COLORS.length]
}

// ─── Print: grayscale fills ───────────────────────────────────────────────────
const BAR_FILLS = ['#bfbfbf', '#999999', '#d9d9d9', '#808080', '#c0c0c0', '#a8a8a8', '#e0e0e0', '#888888', '#b0b0b0']
function barFill(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return BAR_FILLS[Math.abs(h) % BAR_FILLS.length]
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
function getTokens(dark: boolean) {
  return dark ? {
    bgPage:      '#18181b',
    bgHeader:    '#1f1f22',
    gridLine:    '#3f3f46',
    rowAlt:      'rgba(255,255,255,0.018)',
    rowSep:      '#27272a',
    textMuted:   '#6b7280',
    textDimmer:  '#4b5563',
    textLabel:   '#d1d5db',
    textActive:  '#f3f4f6',
    textPast:    '#6b7280',
    legendText:  '#6b7280',
  } : {
    bgPage:      '#ffffff',
    bgHeader:    '#f5f5f7',
    gridLine:    '#e5e7eb',
    rowAlt:      'rgba(0,0,0,0.025)',
    rowSep:      '#e5e7eb',
    textMuted:   '#6b7280',
    textDimmer:  '#9ca3af',
    textLabel:   '#1f2937',
    textActive:  '#111827',
    textPast:    '#9ca3af',
    legendText:  '#6b7280',
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function parseLocal(iso: string): Date { return new Date(iso + 'T00:00:00') }
function daysBetween(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 86_400_000) }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function fmtDay(d: Date): string { return `${d.getDate()} ${MONTHS[d.getMonth()]}` }

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  projects: Project[]
  classStartDate?: string
  className?: string
}

// ─── Component ───────────────────────────────────────────────────────────────
export function GanttChart({ projects, classStartDate, className = 'Class' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const tk = getTokens(isDark)

  const dated = projects.filter(p => p.dueDate)

  if (dated.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400/50">
        <p className="text-sm">No projects with due dates yet.</p>
        <p className="text-xs">Add due dates to your projects to see the Gantt chart.</p>
      </div>
    )
  }

  // ── Compute timeline bounds ──────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const candidateDates: Date[] = []
  dated.forEach(p => {
    if (p.startDate) candidateDates.push(parseLocal(p.startDate))
    candidateDates.push(parseLocal(p.dueDate))
  })
  if (classStartDate) candidateDates.push(parseLocal(classStartDate))

  const minDate = candidateDates.reduce((a, b) => a < b ? a : b)
  const maxDate = candidateDates.reduce((a, b) => a > b ? a : b)

  const rangeStart = addDays(minDate, -7)
  const rangeEnd   = addDays(maxDate, 7)
  const totalDays  = Math.max(daysBetween(rangeStart, rangeEnd), 14)

  function dateToX(d: Date): number {
    return LABEL_W + Math.round((daysBetween(rangeStart, d) / totalDays) * TIMELINE_W)
  }
  function rowTopY(i: number): number { return HEADER_H + i * ROW_H }
  function rowMidY(i: number): number { return rowTopY(i) + Math.round(ROW_H / 2) }

  const totalH = HEADER_H + dated.length * ROW_H + 36

  const monthTicks: { x: number; label: string }[] = []
  {
    const c = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    if (c < rangeStart) c.setMonth(c.getMonth() + 1)
    while (c <= rangeEnd) {
      monthTicks.push({ x: dateToX(c), label: `${MONTHS[c.getMonth()]} ${c.getFullYear()}` })
      c.setMonth(c.getMonth() + 1)
    }
  }

  const todayInRange = today >= rangeStart && today <= rangeEnd
  const todayX = todayInRange ? dateToX(today) : null
  const hasAnyStart = dated.some(p => p.startDate)

  // ── Build B&W print SVG ──────────────────────────────────────────────────
  function buildPrintSvg(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg'
    const el = (tag: string, attrs: Record<string, string | number>) => {
      const node = document.createElementNS(ns, tag)
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
      return node
    }
    const txt = (content: string, attrs: Record<string, string | number>) => {
      const node = el('text', attrs)
      node.textContent = content
      return node
    }

    const svg = el('svg', {
      viewBox: `0 0 ${SVG_W} ${totalH}`,
      width: SVG_W,
      height: totalH,
      xmlns: ns,
    }) as unknown as SVGSVGElement

    svg.appendChild(el('rect', { width: SVG_W, height: totalH, fill: '#ffffff' }))
    svg.appendChild(el('rect', { width: SVG_W, height: HEADER_H, fill: '#f0f0f0' }))

    for (const t of monthTicks) {
      svg.appendChild(el('line', { x1: t.x, y1: 0, x2: t.x, y2: totalH, stroke: '#cccccc', 'stroke-width': 1 }))
      svg.appendChild(txt(t.label, { x: t.x + 8, y: 30, fill: '#222222', 'font-size': 17, 'font-family': 'ui-monospace, monospace', 'font-weight': 700 }))
    }

    svg.appendChild(el('line', { x1: 0, y1: HEADER_H, x2: SVG_W, y2: HEADER_H, stroke: '#888888', 'stroke-width': 1.5 }))
    svg.appendChild(el('line', { x1: LABEL_W, y1: 0, x2: LABEL_W, y2: totalH, stroke: '#888888', 'stroke-width': 1.5 }))
    svg.appendChild(txt('PROJECT', { x: 16, y: 36, fill: '#333333', 'font-size': 15, 'font-family': 'ui-sans-serif, system-ui, sans-serif', 'font-weight': 800, 'letter-spacing': '0.08em' }))
    svg.appendChild(txt(`${fmtDay(rangeStart)} → ${fmtDay(rangeEnd)}`, { x: 16, y: 62, fill: '#777777', 'font-size': 13, 'font-family': 'ui-monospace, monospace' }))

    dated.forEach((_, i) => {
      if (i % 2 !== 0) svg.appendChild(el('rect', { x: 0, y: rowTopY(i), width: SVG_W, height: ROW_H, fill: '#f8f8f8' }))
      svg.appendChild(el('line', { x1: 0, y1: rowTopY(i) + ROW_H, x2: SVG_W, y2: rowTopY(i) + ROW_H, stroke: '#dddddd', 'stroke-width': 1 }))
    })

    if (todayX !== null) {
      svg.appendChild(el('line', { x1: todayX, y1: HEADER_H, x2: todayX, y2: totalH, stroke: '#111111', 'stroke-width': 2, 'stroke-dasharray': '7 4' }))
      svg.appendChild(el('rect', { x: todayX - 30, y: HEADER_H - 24, width: 60, height: 24, rx: 3, fill: '#111111' }))
      svg.appendChild(txt('TODAY', { x: todayX, y: HEADER_H - 7, fill: '#ffffff', 'font-size': 13, 'font-family': 'system-ui, sans-serif', 'font-weight': 800, 'text-anchor': 'middle', 'letter-spacing': '0.06em' }))
    }

    dated.forEach((p, i) => {
      const fill = barFill(p.id)
      const dueDate = parseLocal(p.dueDate)
      const startDate = p.startDate ? parseLocal(p.startDate) : null
      const dueX = dateToX(dueDate)
      const cy = rowMidY(i)
      const isPast = dueDate < today
      const isActive = startDate ? (startDate <= today && today <= dueDate) : false
      const opacity = isPast ? 0.5 : 1.0
      const label = p.name.length > 28 ? p.name.slice(0, 27) + '…' : p.name
      const labelFill = isPast ? '#aaaaaa' : '#111111'
      const labelWeight = isActive ? 800 : 600
      const g = el('g', {})

      if (startDate) {
        const startX = dateToX(startDate)
        const barW = Math.max(dueX - startX, 10)
        g.appendChild(txt(label, { x: LABEL_W - 14, y: cy + 7, fill: labelFill, 'font-size': 18, 'font-family': 'system-ui, sans-serif', 'font-weight': labelWeight, 'text-anchor': 'end', opacity }))
        g.appendChild(el('rect', { x: startX, y: cy - BAR_H / 2, width: barW, height: BAR_H, rx: 4, fill, stroke: '#444444', 'stroke-width': 1, opacity }))
        if (barW > 120) g.appendChild(txt(`${fmtDay(startDate)} – ${fmtDay(dueDate)}`, { x: startX + barW / 2, y: cy + 6, fill: '#111111', 'font-size': 14, 'font-family': 'system-ui, sans-serif', 'font-weight': 700, 'text-anchor': 'middle', opacity }))
      } else {
        const ds = 14
        g.appendChild(txt(label, { x: LABEL_W - 14, y: cy + 7, fill: labelFill, 'font-size': 18, 'font-family': 'system-ui, sans-serif', 'font-weight': labelWeight, 'text-anchor': 'end', opacity }))
        g.appendChild(el('line', { x1: LABEL_W + 8, y1: cy, x2: dueX - ds - 4, y2: cy, stroke: '#bbbbbb', 'stroke-width': 1, 'stroke-dasharray': '5 4' }))
        g.appendChild(el('polygon', { points: `${dueX},${cy - ds} ${dueX + ds},${cy} ${dueX},${cy + ds} ${dueX - ds},${cy}`, fill: '#444444', stroke: '#222222', 'stroke-width': 1, opacity }))
        g.appendChild(txt(fmtDay(dueDate), { x: dueX + ds + 8, y: cy + 7, fill: '#333333', 'font-size': 15, 'font-family': 'ui-monospace, monospace', 'font-weight': 700, opacity }))
      }
      svg.appendChild(g)
    })

    const legendX = LABEL_W + 12, legendY = totalH - 12
    svg.appendChild(el('line', { x1: legendX, y1: legendY, x2: legendX + 28, y2: legendY, stroke: '#111111', 'stroke-width': 2, 'stroke-dasharray': '7 4' }))
    svg.appendChild(txt('Today', { x: legendX + 36, y: legendY + 5, fill: '#555555', 'font-size': 13, 'font-family': 'system-ui, sans-serif' }))
    if (hasAnyStart) {
      svg.appendChild(el('rect', { x: legendX + 106, y: legendY - 8, width: 16, height: 16, rx: 3, fill: '#aaaaaa', stroke: '#444444', 'stroke-width': 1 }))
      svg.appendChild(txt('Project bar', { x: legendX + 128, y: legendY + 5, fill: '#555555', 'font-size': 13, 'font-family': 'system-ui, sans-serif' }))
    } else {
      const px = legendX + 120, py = legendY
      svg.appendChild(el('polygon', { points: `${px},${py - 10} ${px + 10},${py} ${px},${py + 10} ${px - 10},${py}`, fill: '#444444', stroke: '#222222', 'stroke-width': 1 }))
      svg.appendChild(txt('Due date — add start date for full bars', { x: legendX + 136, y: legendY + 5, fill: '#555555', 'font-size': 13, 'font-family': 'system-ui, sans-serif' }))
    }

    return svg
  }

  // ── PDF export ───────────────────────────────────────────────────────────
  function exportPdf() {
    const printSvg = buildPrintSvg()
    printSvg.style.cssText = 'width:100%;height:auto;display:block;'
    const overlay = document.createElement('div')
    overlay.id = '__gantt_print_root'
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:white;padding:20px;box-sizing:border-box;visibility:hidden;pointer-events:none;'
    overlay.appendChild(printSvg)
    const printStyle = document.createElement('style')
    printStyle.textContent = `@media print { @page { size: A4 landscape; margin: 0; } body > * { visibility: hidden !important; } #__gantt_print_root, #__gantt_print_root * { visibility: visible !important; } }`
    document.head.appendChild(printStyle)
    document.body.appendChild(overlay)
    const cleanup = () => { printStyle.remove(); overlay.remove() }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    setTimeout(cleanup, 5000)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-400/60">
          {fmtDay(rangeStart)} → {fmtDay(rangeEnd)} · {dated.length} project{dated.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={exportPdf}
          className="btn-accent flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:brightness-110"
        >
          <FileDown size={15} />
          Export PDF
        </button>
      </div>

      {/* SVG chart */}
      <div className="rounded-xl border border-gray-700 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${totalH}`}
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block' }}
        >
          <title>Gantt Chart – {className}</title>

          {/* Backgrounds */}
          <rect width={SVG_W} height={totalH} fill={tk.bgPage} />
          <rect width={SVG_W} height={HEADER_H} fill={tk.bgHeader} />

          {/* Month tick lines */}
          {monthTicks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={36} x2={t.x} y2={totalH} stroke={tk.gridLine} strokeWidth="1" />
              <text x={t.x + 8} y={28} fill={tk.textMuted} fontSize="15"
                fontFamily="ui-monospace, monospace" fontWeight="600">{t.label}</text>
            </g>
          ))}

          {/* Header borders */}
          <line x1={0} y1={HEADER_H} x2={SVG_W} y2={HEADER_H} stroke={tk.gridLine} strokeWidth="1" />
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={totalH} stroke={tk.gridLine} strokeWidth="1" />

          {/* Header labels */}
          <text x={16} y={36} fill={tk.textMuted} fontSize="13"
            fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="700" letterSpacing="0.08em">
            PROJECT
          </text>
          <text x={16} y={60} fill={tk.textDimmer} fontSize="13" fontFamily="ui-monospace, monospace">
            {fmtDay(rangeStart)} → {fmtDay(rangeEnd)}
          </text>

          {/* Row backgrounds + separators */}
          {dated.map((p, i) => (
            <g key={p.id + '-row'}>
              {i % 2 !== 0 && (
                <rect x={0} y={rowTopY(i)} width={SVG_W} height={ROW_H} fill={tk.rowAlt} />
              )}
              <line x1={0} y1={rowTopY(i) + ROW_H} x2={SVG_W} y2={rowTopY(i) + ROW_H}
                stroke={tk.rowSep} strokeWidth="1" />
            </g>
          ))}

          {/* Today marker */}
          {todayX !== null && (
            <g>
              <line x1={todayX} y1={HEADER_H} x2={todayX} y2={totalH}
                stroke="#6366f1" strokeWidth="2" strokeDasharray="5 4" />
              <rect x={todayX - 26} y={HEADER_H - 22} width={52} height={22} rx="4" fill="#6366f1" />
              <text x={todayX} y={HEADER_H - 6} fill="#fff" fontSize="11"
                fontFamily="system-ui, sans-serif" fontWeight="700"
                textAnchor="middle" letterSpacing="0.06em">TODAY</text>
            </g>
          )}

          {/* Project bars / markers */}
          {dated.map((p, i) => {
            const color     = barColor(p.id)
            const dueDate   = parseLocal(p.dueDate)
            const startDate = p.startDate ? parseLocal(p.startDate) : null
            const dueX      = dateToX(dueDate)
            const cy        = rowMidY(i)
            const isPast    = dueDate < today
            const isActive  = startDate ? (startDate <= today && today <= dueDate) : false
            const opacity   = isPast ? 0.45 : 1.0
            const label     = p.name.length > 28 ? p.name.slice(0, 27) + '…' : p.name
            const labelFill   = isPast ? tk.textPast : isActive ? tk.textActive : tk.textLabel
            const labelWeight = isActive ? '600' : '400'

            if (startDate) {
              const startX = dateToX(startDate)
              const barW   = Math.max(dueX - startX, 10)
              return (
                <g key={p.id}>
                  <text x={LABEL_W - 14} y={cy + 6} fill={labelFill} fontSize="16"
                    fontFamily="system-ui, sans-serif" fontWeight={labelWeight}
                    textAnchor="end">{label}</text>
                  <rect x={startX} y={cy - BAR_H / 2} width={barW} height={BAR_H}
                    rx="6" fill={color} opacity={opacity} />
                  <rect x={startX} y={cy - BAR_H / 2} width={5} height={BAR_H}
                    rx="3" fill={isDark ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.50)'} opacity={opacity} />
                  {barW > 120 && (
                    <text x={startX + barW / 2} y={cy + 5} fill="#fff" fontSize="13"
                      fontFamily="system-ui, sans-serif" fontWeight="600"
                      textAnchor="middle" opacity={opacity}>
                      {fmtDay(startDate)} – {fmtDay(dueDate)}
                    </text>
                  )}
                  <circle cx={dueX} cy={cy} r="6" fill={isDark ? '#fff' : '#fff'} opacity={opacity * 0.8} />
                </g>
              )
            } else {
              const ds = 13
              return (
                <g key={p.id}>
                  <text x={LABEL_W - 14} y={cy + 6} fill={labelFill} fontSize="16"
                    fontFamily="system-ui, sans-serif" fontWeight={labelWeight}
                    textAnchor="end">{label}</text>
                  <line x1={LABEL_W + 8} y1={cy} x2={dueX - ds - 4} y2={cy}
                    stroke={color} strokeWidth="1.5" strokeDasharray="5 5" opacity="0.28" />
                  <polygon
                    points={`${dueX},${cy - ds} ${dueX + ds},${cy} ${dueX},${cy + ds} ${dueX - ds},${cy}`}
                    fill={color} opacity={opacity} />
                  <text x={dueX + ds + 8} y={cy + 6} fill={color} fontSize="13"
                    fontFamily="ui-monospace, monospace" opacity={opacity}>{fmtDay(dueDate)}</text>
                </g>
              )
            }
          })}

          {/* Legend */}
          <g transform={`translate(${LABEL_W + 12}, ${totalH - 12})`}>
            <line x1={0} y1={0} x2={28} y2={0} stroke="#6366f1" strokeWidth="2" strokeDasharray="5 4" />
            <text x={36} y={5} fill={tk.legendText} fontSize="13" fontFamily="system-ui, sans-serif">Today</text>
            {hasAnyStart ? (
              <>
                <circle cx={110} cy={0} r={5} fill="#9b9b9b" opacity={0.6} />
                <text x={120} y={5} fill={tk.legendText} fontSize="13" fontFamily="system-ui, sans-serif">Due date</text>
              </>
            ) : (
              <>
                <polygon points="120,-10 130,0 120,10 110,0" fill="#9b9b9b" opacity={0.6} />
                <text x={136} y={5} fill={tk.legendText} fontSize="13" fontFamily="system-ui, sans-serif">Due date — add start date for full bars</text>
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}
