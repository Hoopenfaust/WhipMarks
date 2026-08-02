import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Upload, Shuffle, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { useCategoryDraw, useCategoryAssignments, setupCategoryDraw, drawNextCategory, resetCategoryDraw } from '../../db/hooks/useCategoryDraws'
import type { Project, Student } from '../../types'
import { cn } from '../../utils/cn'

interface Props {
  projects: Project[]
  students: Student[]
}

const ITEM_HEIGHT = 48

function extractColumnValues(rows: Record<string, string>[], col: string): string[] {
  if (!col) return []
  return rows.map(r => (r[col] ?? '').trim()).filter(Boolean)
}

function randomFrom(source: string[]): string {
  return source.length > 0 ? source[Math.floor(Math.random() * source.length)] : '…'
}

// Builds the reel's item list plus one extra "overshoot" item after the winner,
// so the spin can fly past the result and bounce back into place for some tension.
function buildReelFiller(finalValue: string, fillerSource: string[]): { filler: string[]; finalIndex: number } {
  const filler: string[] = []
  for (let i = 0; i < 22; i++) filler.push(randomFrom(fillerSource))
  const finalIndex = filler.length
  filler.push(finalValue)
  filler.push(randomFrom(fillerSource))
  return { filler, finalIndex }
}

function Reel({ label, containerRef, spinning, popping }: { label: string; containerRef: React.RefObject<HTMLDivElement | null>; spinning: boolean; popping: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider text-gray-400 mb-1.5">{label}</div>
      <div className={cn(
        'relative h-[110px] rounded-lg border bg-gray-950 transition-colors',
        popping ? 'overflow-visible' : 'overflow-hidden',
        spinning ? 'category-draw-spinning' : 'border-gray-700'
      )}>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-6 h-px bg-orange-500/60 z-10" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 translate-y-6 h-px bg-orange-500/60 z-10" />
        <div
          ref={containerRef}
          className="absolute left-0 right-0 top-1/2"
          style={{ transform: 'translateY(-50%)' }}
        >
          <div className="h-12 flex items-center justify-center text-sm font-semibold text-gray-100 px-3 text-center">
            READY
          </div>
        </div>
      </div>
    </div>
  )
}

export function CategoryDrawPanel({ projects, students }: Props) {
  const [projectId, setProjectId] = useState<string | undefined>(projects[0]?.id)
  const draw = useCategoryDraw(projectId)
  const assignments = useCategoryAssignments(projectId)

  const [replacing, setReplacing] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [colCategory, setColCategory] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [spinning, setSpinning] = useState(false)
  const [studentPopping, setStudentPopping] = useState(false)
  const [categoryPopping, setCategoryPopping] = useState(false)
  const reelStudentRef = useRef<HTMLDivElement>(null)
  const reelCategoryRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const project = projects.find(p => p.id === projectId)
  const studentName = (id: string) => {
    const s = students.find(s => s.id === id)
    if (!s) return 'Unknown student'
    return s.firstName ? `${s.firstName} ${s.name}` : s.name
  }
  const rosterIds = students.map(s => s.id)

  const assignedStudentIds = new Set(assignments.map(a => a.studentId))
  const remainingStudents = rosterIds.filter(id => !assignedStudentIds.has(id))
  const remainingCategoryCount = draw ? (draw.pool.length === 0 && remainingStudents.length > 0 ? draw.categories.length : draw.pool.length) : 0

  function resetUploadState() {
    setHeaders([]); setRawRows([]); setColCategory(''); setError(null)
  }

  function parseFile(file: File) {
    setError(null)
    if (!file.name.match(/\.(xlsx|xls|ods|csv)$/i)) {
      setError('Please upload an .xlsx, .xls, .ods, or .csv file.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
        const nonEmpty = grid.filter(r => r.some(c => c !== undefined && c !== null && String(c).trim() !== ''))
        if (nonEmpty.length < 2) { setError('Sheet appears empty or has only one row.'); return }
        const hdrs = nonEmpty[0].map(String)
        const rows = nonEmpty.slice(1).map(r =>
          Object.fromEntries(hdrs.map((h, i) => [h, String(r[i] ?? '')]))
        )
        setHeaders(hdrs)
        setRawRows(rows)
        setColCategory(hdrs.find(h => /categor|criteri/i.test(h)) ?? hdrs[0] ?? '')
      } catch {
        setError('Could not parse the file. Make sure it is a valid spreadsheet.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const parsedCategories = [...new Set(extractColumnValues(rawRows, colCategory))]

  async function handleStartDraw() {
    if (!projectId || parsedCategories.length === 0) return
    await setupCategoryDraw(projectId, parsedCategories)
    setReplacing(false)
    resetUploadState()
  }

  async function handleDrawNext() {
    if (!projectId || spinning || remainingStudents.length === 0) return
    setSpinning(true)
    try {
      const entry = await drawNextCategory(projectId, rosterIds)
      const student = buildReelFiller(studentName(entry.studentId), students.map(s => s.name))
      const category = buildReelFiller(entry.category, draw?.categories ?? [entry.category])

      // Student reel lands first; category reel is held back a beat so the
      // reveal lands in two stages instead of both stopping at once. The
      // category's pop is bigger and longer — it's the result that matters.
      const studentDone = animateReel(
        reelStudentRef.current, student.filler, student.finalIndex,
        'text-gray-100', 'category-draw-winner', 550, setStudentPopping,
      )
      const categoryDone = new Promise<void>(resolve => {
        setTimeout(() => {
          animateReel(
            reelCategoryRef.current, category.filler, category.finalIndex,
            'text-orange-400', 'category-draw-winner-featured', 800, setCategoryPopping,
          ).then(resolve)
        }, 450)
      })
      await Promise.all([studentDone, categoryDone])
    } finally {
      setSpinning(false)
    }
  }

  // Spins fast, overshoots one item past the result, then bounces back to land
  // on it, then pops the winning text large before it shrinks to its resting
  // size — closer to a real slot-machine reel than a flat scroll.
  function animateReel(
    el: HTMLDivElement | null,
    filler: string[],
    finalIndex: number,
    winnerColorClass: string,
    popClass: string,
    popDurationMs: number,
    onPopChange: (popping: boolean) => void,
  ): Promise<void> {
    return new Promise(resolve => {
      if (!el) { resolve(); return }
      el.style.transition = 'none'
      el.style.transform = 'translateY(-50%)'
      el.innerHTML = ''
      const itemEls: HTMLDivElement[] = []
      filler.forEach((text, i) => {
        const item = document.createElement('div')
        item.className = cn(
          'h-12 flex items-center justify-center text-sm font-semibold px-3 text-center whitespace-nowrap overflow-hidden text-ellipsis',
          i === finalIndex ? winnerColorClass : 'text-gray-100'
        )
        item.textContent = text
        el.appendChild(item)
        itemEls.push(item)
      })

      const overshootOffset = (filler.length - 1) * ITEM_HEIGHT
      const landOffset = finalIndex * ITEM_HEIGHT

      requestAnimationFrame(() => {
        el.style.transition = 'transform 2.1s cubic-bezier(.11,.79,.15,1)'
        el.style.transform = `translateY(calc(-50% - ${overshootOffset}px))`
      })

      setTimeout(() => {
        el.style.transition = 'transform 0.32s cubic-bezier(.34,1.56,.64,1)'
        el.style.transform = `translateY(calc(-50% - ${landOffset}px))`

        setTimeout(() => {
          const winner = itemEls[finalIndex]
          onPopChange(true)
          winner.classList.add(popClass)
          setTimeout(() => {
            winner.classList.remove(popClass)
            onPopChange(false)
            resolve()
          }, popDurationMs)
        }, 340)
      }, 2100)
    })
  }

  async function handleReset() {
    if (!projectId) return
    if (!confirm('Reset the category pool and clear the assignment log for this project?')) return
    await resetCategoryDraw(projectId)
    if (reelStudentRef.current) reelStudentRef.current.innerHTML = '<div class="h-12 flex items-center justify-center text-sm font-semibold text-gray-100">READY</div>'
    if (reelCategoryRef.current) reelCategoryRef.current.innerHTML = '<div class="h-12 flex items-center justify-center text-sm font-semibold text-gray-100">READY</div>'
  }

  if (projects.length === 0) {
    return <p className="text-sm text-gray-400/70 py-4">Add a project first to run a category draw.</p>
  }

  if (students.length === 0) {
    return <p className="text-sm text-gray-400/70 py-4">Add students to this class first to run a category draw.</p>
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="flex flex-col gap-1 max-w-xs">
        <label className="text-xs font-medium text-gray-400">Project</label>
        <select
          value={projectId ?? ''}
          onChange={e => { setProjectId(e.target.value); setReplacing(false); resetUploadState() }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-200"
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {(!draw || replacing) && project && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 flex flex-col gap-4">
          <p className="text-sm text-gray-100 font-medium">
            Upload a spreadsheet with the category list for <span className="text-orange-400">{project.name}</span>
          </p>
          <p className="text-xs text-gray-400/70 -mt-2">
            Students are pulled automatically from this class's roster ({students.length} student{students.length === 1 ? '' : 's'}) — just upload the categories.
          </p>

          {rawRows.length === 0 ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-all',
                dragOver ? 'border-gray-200 bg-gray-100/5' : 'border-gray-700 hover:border-gray-500'
              )}
            >
              <FileSpreadsheet size={32} className={dragOver ? 'text-gray-100' : 'text-gray-400'} />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-100">Drop your spreadsheet here</p>
                <p className="text-xs text-gray-400/70 mt-1">or click to browse — .xlsx, .xls, .ods, .csv</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.ods,.csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = '' }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Column mapping</p>
                <button onClick={resetUploadState} className="text-xs text-gray-400/70 hover:text-gray-400 flex items-center gap-1">
                  <Upload size={11} /> Change file
                </button>
              </div>
              <div className="flex flex-col gap-1 max-w-xs">
                <label className="text-xs text-gray-400">Category column *</label>
                <select value={colCategory} onChange={e => setColCategory(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-200">
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              {colCategory && (
                <p className="text-xs text-gray-400">{parsedCategories.length} categories found</p>
              )}
            </>
          )}

          {error && <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2">
            {replacing && <Button variant="ghost" onClick={() => { setReplacing(false); resetUploadState() }}>Cancel</Button>}
            <Button
              variant="primary"
              onClick={handleStartDraw}
              disabled={parsedCategories.length === 0}
            >
              Start Draw
            </Button>
          </div>
        </div>
      )}

      {draw && !replacing && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 flex flex-col gap-4">
          <div className="flex gap-4">
            <Reel label="Student" containerRef={reelStudentRef} spinning={spinning} popping={studentPopping} />
            <Reel label="Category" containerRef={reelCategoryRef} spinning={spinning} popping={categoryPopping} />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleDrawNext} disabled={spinning || remainingStudents.length === 0}>
              <Shuffle size={14} className={spinning ? 'animate-spin' : ''} /> {spinning ? 'Drawing…' : 'Draw Next'}
            </Button>
            <Button variant="ghost" onClick={handleReset}><RotateCcw size={14} /> Reset All</Button>
            <Button variant="ghost" onClick={() => setReplacing(true)}>Upload new list</Button>
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>{remainingCategoryCount} categories remaining this cycle</span>
            <span>{remainingStudents.length} students left to draw</span>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assignment Log</p>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-400/50 italic py-2">No assignments yet.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto divide-y divide-gray-800">
                {assignments.slice().reverse().map(a => (
                  <li key={a.id} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="text-gray-100 font-medium">{studentName(a.studentId)}</span>
                    <span className="text-gray-400 text-right">{a.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
