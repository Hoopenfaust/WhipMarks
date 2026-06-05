import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getStroke } from 'perfect-freehand'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  X, ChevronLeft, ChevronRight, Download, Pen, Highlighter,
  Type, Stamp, Eraser, Minus, Plus, Undo2, Check, XCircle, HelpCircle, Star
} from 'lucide-react'
import type {
  Student, AnnotationTool, PageAnnotations,
  PenStroke, TextPin, HighlightRect, AnnotationStamp, StampType
} from '../../types'
import { saveAnnotations } from '../../db/hooks/useSubmissions'
import { cn } from '../../utils/cn'
import { newId } from '../../utils/id'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PEN_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ffffff', '#aaaaaa']
const HIGHLIGHT_COLORS = ['#ffd93d80', '#ff6b6b80', '#6bcb7780', '#4d96ff80']
const STAMP_ICONS: Record<StampType, React.ReactNode> = {
  check: <Check size={22} className="text-emerald-400" />,
  cross: <XCircle size={22} className="text-red-400" />,
  question: <HelpCircle size={22} className="text-amber-400" />,
  star: <Star size={22} className="text-yellow-300" />,
}

function svgPathFromStroke(points: number[][]): string {
  if (points.length < 2) return ''
  const d = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [px, py] = points[i - 1]
    const mx = (px + x) / 2
    const my = (py + y) / 2
    return `${acc} Q ${px} ${py} ${mx} ${my}`
  }, '')
  return d
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  student: Student
  projectId: string
  pdfData: ArrayBuffer
  filename: string
  initialAnnotations: PageAnnotations[]
  onClose: () => void
}

export function AnnotatorView({ student, projectId, pdfData, filename, initialAnnotations, onClose }: Props) {
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const [penColor, setPenColor] = useState('#ff6b6b')
  const [highlightColor, setHighlightColor] = useState('#ffd93d80')
  const [penWidth, setPenWidth] = useState(3)
  const [stampType, setStampType] = useState<StampType>('check')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [pages, setPages] = useState<PageAnnotations[]>(initialAnnotations)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<number[][]>([])
  const [highlightStart, setHighlightStart] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const [textColor, setTextColor] = useState('#ffd93d')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const historyRef = useRef<PageAnnotations[][]>([])

  // ─── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    pdfjsLib.getDocument({ data: new Uint8Array(pdfData) }).promise.then(pdf => {
      pdfDocRef.current = pdf
      setTotalPages(pdf.numPages)
      renderPage(pdf, 1)
    })
    return () => { pdfDocRef.current?.destroy() }
  }, [pdfData])

  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = pdfCanvasRef.current
    const drawCanvas = drawCanvasRef.current
    if (!canvas || !drawCanvas) return
    canvas.width = viewport.width
    canvas.height = viewport.height
    drawCanvas.width = viewport.width
    drawCanvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport } as any).promise
    redrawAnnotations(drawCanvas, pageNum)
  }, [scale])

  useEffect(() => {
    if (pdfDocRef.current) renderPage(pdfDocRef.current, currentPage)
  }, [currentPage, scale, renderPage])

  useEffect(() => {
    const drawCanvas = drawCanvasRef.current
    if (drawCanvas) redrawAnnotations(drawCanvas, currentPage)
  }, [pages, currentPage])

  // ─── Redraw annotations ────────────────────────────────────────────────────
  function redrawAnnotations(canvas: HTMLCanvasElement, pageNum: number) {
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const pageAnns = pages.find(p => p.pageNumber === pageNum)
    if (!pageAnns) return

    const W = canvas.width
    const H = canvas.height

    // Highlights
    for (const h of pageAnns.highlights) {
      ctx.fillStyle = h.color
      ctx.fillRect(h.x * W, h.y * H, h.width * W, h.height * H)
    }

    // Strokes
    for (const stroke of pageAnns.strokes) {
      if (stroke.points.length < 2) continue
      const outlinePoints = getStroke(
        stroke.points.map(([x, y, p]) => [x * W, y * H, p ?? 0.5]),
        { size: stroke.width * 2, smoothing: 0.5, thinning: 0.5, streamline: 0.5 }
      )
      const path = new Path2D(svgPathFromStroke(outlinePoints))
      ctx.fillStyle = stroke.color
      ctx.fill(path)
    }

    // Text pins
    for (const pin of pageAnns.textPins) {
      const x = pin.x * W
      const y = pin.y * H
      ctx.font = 'bold 14px sans-serif'
      ctx.fillStyle = pin.color
      // Background pill
      const metrics = ctx.measureText(pin.text)
      const padX = 6, padY = 4
      ctx.fillStyle = '#0f0f10cc'
      ctx.beginPath()
      ctx.roundRect(x - padX, y - 16 - padY, metrics.width + padX * 2, 20 + padY * 2, 6)
      ctx.fill()
      ctx.fillStyle = pin.color
      ctx.fillText(pin.text, x, y)
    }

    // Stamps
    for (const stamp of pageAnns.stamps) {
      const x = stamp.x * W
      const y = stamp.y * H
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const emoji = { check: '✓', cross: '✕', question: '?', star: '★' }[stamp.type]
      const color = { check: '#6bcb77', cross: '#ff6b6b', question: '#ffd93d', star: '#fbbf24' }[stamp.type]
      ctx.fillStyle = '#0f0f10cc'
      ctx.beginPath()
      ctx.arc(x, y, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color
      ctx.fillText(emoji, x, y)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
  }

  // ─── Page annotations helpers ──────────────────────────────────────────────
  function getOrCreatePage(pageNum: number): PageAnnotations {
    return pages.find(p => p.pageNumber === pageNum) ?? {
      pageNumber: pageNum,
      strokes: [],
      textPins: [],
      highlights: [],
      stamps: [],
    }
  }

  function pushHistory() {
    historyRef.current.push(JSON.parse(JSON.stringify(pages)))
  }

  function undo() {
    const prev = historyRef.current.pop()
    if (prev) setPages(prev)
  }

  function updatePage(updated: PageAnnotations) {
    setPages(prev => {
      const filtered = prev.filter(p => p.pageNumber !== updated.pageNumber)
      return [...filtered, updated]
    })
  }

  // ─── Pointer coordinate helpers ────────────────────────────────────────────
  function getNormalizedCoords(e: React.PointerEvent): { x: number; y: number; pressure: number } {
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    }
  }

  // ─── Drawing handlers ──────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    if (textInput) { commitText(); return }
    e.preventDefault()
    const { x, y, pressure } = getNormalizedCoords(e)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    if (tool === 'pen' || tool === 'eraser') {
      pushHistory()
      setIsDrawing(true)
      setCurrentStroke([[x, y, pressure]])
    } else if (tool === 'highlight') {
      pushHistory()
      setIsDrawing(true)
      setHighlightStart({ x, y })
      // highlight preview tracked via highlightStart only
    } else if (tool === 'text') {
      setTextInput({ x, y })
      setTextValue('')
    } else if (tool === 'stamp') {
      pushHistory()
      const page = getOrCreatePage(currentPage)
      const stamp: AnnotationStamp = { id: newId(), x, y, type: stampType }
      updatePage({ ...page, stamps: [...page.stamps, stamp] })
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDrawing) return
    e.preventDefault()
    const { x, y, pressure } = getNormalizedCoords(e)

    if (tool === 'pen') {
      const newStroke = [...currentStroke, [x, y, pressure]]
      setCurrentStroke(newStroke)
      // Live draw on canvas
      const canvas = drawCanvasRef.current!
      const ctx = canvas.getContext('2d')!
      const W = canvas.width, H = canvas.height
      const outlinePoints = getStroke(
        newStroke.map(([sx, sy, sp]) => [sx * W, sy * H, sp ?? 0.5]),
        { size: penWidth * 2, smoothing: 0.5, thinning: 0.5, streamline: 0.5 }
      )
      redrawAnnotations(canvas, currentPage)
      const path = new Path2D(svgPathFromStroke(outlinePoints))
      ctx.fillStyle = penColor
      ctx.fill(path)
    } else if (tool === 'eraser') {
      // Erase strokes near cursor
      const page = getOrCreatePage(currentPage)
      const canvas = drawCanvasRef.current!
      const W = canvas.width, H = canvas.height
      const updated = {
        ...page,
        strokes: page.strokes.filter(s =>
          !s.points.some(([sx, sy]) => {
            const dx = (sx - x) * W, dy = (sy - y) * H
            return Math.sqrt(dx * dx + dy * dy) < 20
          })
        ),
        textPins: page.textPins.filter(p => {
          const dx = (p.x - x) * W, dy = (p.y - y) * H
          return Math.sqrt(dx * dx + dy * dy) > 30
        }),
        stamps: page.stamps.filter(s => {
          const dx = (s.x - x) * W, dy = (s.y - y) * H
          return Math.sqrt(dx * dx + dy * dy) > 20
        }),
      }
      updatePage(updated)
    } else if (tool === 'highlight') {
      // highlight preview tracked via highlightStart only
      // Live preview
      const canvas = drawCanvasRef.current!
      const ctx = canvas.getContext('2d')!
      const W = canvas.width, H = canvas.height
      redrawAnnotations(canvas, currentPage)
      if (highlightStart) {
        ctx.fillStyle = highlightColor
        ctx.fillRect(
          highlightStart.x * W, highlightStart.y * H,
          (x - highlightStart.x) * W, (y - highlightStart.y) * H
        )
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!isDrawing) return
    setIsDrawing(false)
    const { x, y } = getNormalizedCoords(e)

    if (tool === 'pen' && currentStroke.length > 1) {
      const page = getOrCreatePage(currentPage)
      const stroke: PenStroke = { id: newId(), points: currentStroke, color: penColor, width: penWidth }
      updatePage({ ...page, strokes: [...page.strokes, stroke] })
      setCurrentStroke([])
    } else if (tool === 'highlight' && highlightStart) {
      const page = getOrCreatePage(currentPage)
      const rect: HighlightRect = {
        id: newId(),
        x: Math.min(highlightStart.x, x),
        y: Math.min(highlightStart.y, y),
        width: Math.abs(x - highlightStart.x),
        height: Math.abs(y - highlightStart.y),
        color: highlightColor,
      }
      if (rect.width > 0.005 && rect.height > 0.002) {
        updatePage({ ...page, highlights: [...page.highlights, rect] })
      }
      setHighlightStart(null)
    }
  }

  function commitText() {
    if (textInput && textValue.trim()) {
      const page = getOrCreatePage(currentPage)
      const pin: TextPin = { id: newId(), x: textInput.x, y: textInput.y, text: textValue.trim(), color: textColor }
      updatePage({ ...page, textPins: [...page.textPins, pin] })
    }
    setTextInput(null)
    setTextValue('')
  }

  // ─── Auto-save ─────────────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const studentIdRef = useRef(student.id)

  useEffect(() => {
    studentIdRef.current = student.id
  }, [student.id])

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await saveAnnotations(studentIdRef.current, projectId, pages)
      setSaving(false)
    }, 1000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [pages, projectId])

  // ─── Export annotated PDF ──────────────────────────────────────────────────
  async function exportPdf() {
    if (!pdfDocRef.current) return
    setExporting(true)
    try {
      const pdfDoc = await PDFDocument.load(pdfData)
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const pdfPages = pdfDoc.getPages()

      for (let i = 0; i < pdfPages.length; i++) {
        const pageNum = i + 1
        const pageAnns = pages.find(p => p.pageNumber === pageNum)
        if (!pageAnns) continue

        const pdfPage = pdfPages[i]
        const { width: W, height: H } = pdfPage.getSize()

        // Render the page to a canvas to capture strokes+highlights as image
        const pdfJsPage = await pdfDocRef.current.getPage(pageNum)
        const viewport = pdfJsPage.getViewport({ scale: 2 })
        const offscreen = document.createElement('canvas')
        offscreen.width = viewport.width
        offscreen.height = viewport.height
        const ctx = offscreen.getContext('2d')!

        // Draw page
        await pdfJsPage.render({ canvasContext: ctx, viewport } as any).promise

        // Draw annotations on top
        const ow = offscreen.width, oh = offscreen.height

        // Highlights
        for (const h of pageAnns.highlights) {
          ctx.fillStyle = h.color
          ctx.fillRect(h.x * ow, h.y * oh, h.width * ow, h.height * oh)
        }

        // Strokes
        for (const stroke of pageAnns.strokes) {
          if (stroke.points.length < 2) continue
          const outlinePoints = getStroke(
            stroke.points.map(([x, y, p]) => [x * ow, y * oh, p ?? 0.5]),
            { size: stroke.width * 2, smoothing: 0.5, thinning: 0.5, streamline: 0.5 }
          )
          const path = new Path2D(svgPathFromStroke(outlinePoints))
          ctx.fillStyle = stroke.color
          ctx.fill(path)
        }

        // Stamps
        for (const stamp of pageAnns.stamps) {
          ctx.font = 'bold 36px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const emoji = { check: '✓', cross: '✕', question: '?', star: '★' }[stamp.type]
          const color = { check: '#6bcb77', cross: '#ff6b6b', question: '#ffd93d', star: '#fbbf24' }[stamp.type]
          ctx.fillStyle = '#0f0f10cc'
          ctx.beginPath()
          ctx.arc(stamp.x * ow, stamp.y * oh, 22, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = color
          ctx.fillText(emoji, stamp.x * ow, stamp.y * oh)
        }

        // Embed the annotated canvas as image into PDF page
        const imgData = offscreen.toDataURL('image/png')
        const imgBytes = await fetch(imgData).then(r => r.arrayBuffer())
        const embeddedImg = await pdfDoc.embedPng(new Uint8Array(imgBytes))
        pdfPage.drawImage(embeddedImg, { x: 0, y: 0, width: W, height: H })

        // Text pins as actual PDF text (so they're selectable)
        for (const pin of pageAnns.textPins) {
          const [r, g, b] = hexToRgb(pin.color)
          pdfPage.drawText(pin.text, {
            x: pin.x * W,
            y: H - pin.y * H - 14,
            size: 11,
            font: helvetica,
            color: rgb(r, g, b),
          })
        }
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${student.name}_${filename}_annotated.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex)
    return result
      ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
      : [1, 1, 1]
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const toolBtn = (t: AnnotationTool, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTool(t)}
      title={label}
      className={cn(
        'flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-14',
        tool === t ? 'bg-orange-950/80 text-orange-300' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
      )}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-950">
      {/* Left toolbar */}
      <div className="w-20 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-4 gap-2 shrink-0">
        {toolBtn('pen', <Pen size={20} />, 'Pen')}
        {toolBtn('highlight', <Highlighter size={20} />, 'Highlight')}
        {toolBtn('text', <Type size={20} />, 'Text')}
        {toolBtn('stamp', <Stamp size={20} />, 'Stamp')}
        {toolBtn('eraser', <Eraser size={20} />, 'Eraser')}

        <div className="w-full border-t border-gray-700 my-1" />

        {/* Pen options */}
        {(tool === 'pen') && (
          <>
            <div className="flex flex-col gap-1 px-2">
              {PEN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={cn('w-7 h-7 rounded-full border-2 transition-transform', penColor === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex flex-col items-center gap-1 mt-1">
              <button onClick={() => setPenWidth(w => Math.max(1, w - 1))} className="p-1 text-gray-400 hover:text-gray-100"><Minus size={14} /></button>
              <span className="text-xs text-gray-400 w-4 text-center">{penWidth}</span>
              <button onClick={() => setPenWidth(w => Math.min(12, w + 1))} className="p-1 text-gray-400 hover:text-gray-100"><Plus size={14} /></button>
            </div>
          </>
        )}

        {/* Highlight colors */}
        {tool === 'highlight' && (
          <div className="flex flex-col gap-1 px-2">
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setHighlightColor(c)}
                className={cn('w-7 h-7 rounded border-2 transition-transform', highlightColor === c ? 'border-white scale-110' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        )}

        {/* Text color */}
        {tool === 'text' && (
          <div className="flex flex-col gap-1 px-2">
            {PEN_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setTextColor(c)}
                className={cn('w-7 h-7 rounded-full border-2 transition-transform', textColor === c ? 'border-white scale-110' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        )}

        {/* Stamp types */}
        {tool === 'stamp' && (
          <div className="flex flex-col gap-2 px-1">
            {(['check', 'cross', 'question', 'star'] as StampType[]).map(s => (
              <button
                key={s}
                onClick={() => setStampType(s)}
                className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                  stampType === s ? 'bg-gray-700' : 'hover:bg-gray-800')}
              >
                {STAMP_ICONS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3 shrink-0">
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate">
              {student.firstName ? `${student.firstName} ${student.name}` : student.name}
            </p>
            <p className="text-xs text-gray-500 truncate">{filename}</p>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-gray-300 tabular-nums min-w-[4rem] text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
              <Minus size={14} />
            </button>
            <span className="text-xs text-gray-400 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
              <Plus size={14} />
            </button>
          </div>

          <button onClick={undo} title="Undo" className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
            <Undo2 size={16} />
          </button>

          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#FFB59C', color: '#5F1500' }}
          >
            <Download size={15} />
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>

          {saving && <span className="text-xs text-gray-500">Saving…</span>}
        </div>

        {/* Canvas scroll area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex justify-center items-start p-6 bg-gray-950"
          style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'crosshair' : 'crosshair' }}
        >
          <div className="relative shadow-2xl shadow-black/60 select-none">
            {/* PDF layer */}
            <canvas ref={pdfCanvasRef} className="block" />
            {/* Annotation layer */}
            <canvas
              ref={drawCanvasRef}
              className="absolute inset-0"
              style={{ touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
            {/* Text input overlay */}
            {textInput && drawCanvasRef.current && (
              <div
                className="absolute"
                style={{
                  left: textInput.x * drawCanvasRef.current.width,
                  top: textInput.y * drawCanvasRef.current.height - 20,
                }}
              >
                <input
                  autoFocus
                  value={textValue}
                  onChange={e => setTextValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitText()
                    if (e.key === 'Escape') { setTextInput(null); setTextValue('') }
                  }}
                  onBlur={commitText}
                  placeholder="Type note…"
                  className="bg-gray-900/90 border border-orange-500/50 rounded px-2 py-1 text-sm text-gray-100 outline-none min-w-32"
                  style={{ color: textColor }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
