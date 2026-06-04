import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Upload, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { bulkAddCriteria } from '../../db/hooks/useCriteria'
import { updateProject } from '../../db/hooks/useProjects'

interface ParsedRow {
  name: string
  description: string
  maxMarks: number
  weight: number
}

interface Props {
  projectId: string
  existingCount: number
  onDone: () => void
  onClose: () => void
}

const NAME_HINTS = ['name', 'criterion', 'criteria', 'category', 'skill', 'outcome', 'standard', 'task', 'component']
const DESC_HINTS = ['description', 'desc', 'detail', 'standard', 'note', 'comment', 'indicator']
const MARKS_HINTS = ['mark', 'point', 'score', 'pts', 'max', 'total', 'out of', 'value']
const WEIGHT_HINTS = ['weight', 'weighting', 'percent', '%', 'proportion', 'contribution']

function detect(headers: string[], hints: string[]): string {
  return headers.find(h => hints.some(k => h.toLowerCase().includes(k))) ?? ''
}

function parseValue(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function buildRows(
  rawRows: Record<string, string>[],
  colName: string,
  colDesc: string,
  colMarks: string,
  colWeight: string,
): ParsedRow[] {
  const rows = rawRows
    .map(r => ({
      name: colName ? (r[colName] ?? '').trim() : '',
      description: colDesc ? (r[colDesc] ?? '').trim() : '',
      maxMarks: colMarks ? Math.max(1, Math.round(parseValue(r[colMarks] ?? '0'))) : 10,
      weight: colWeight ? parseValue(r[colWeight] ?? '0') : 0,
    }))
    .filter(r => r.name.length > 0)

  // If no weight column or all zeros, distribute evenly
  const totalW = rows.reduce((s, r) => s + r.weight, 0)
  if (totalW === 0) {
    const even = rows.length > 0 ? Math.round(100 / rows.length) : 0
    rows.forEach((r, i) => {
      r.weight = i === rows.length - 1 ? 100 - even * (rows.length - 1) : even
    })
  } else if (totalW > 5) {
    // Values look like percentages (e.g. 30, 20) — normalise to 0–100 range keeping as-is
    // but if max > 1, they're already percentages; if max <= 1, convert to %
    const maxW = Math.max(...rows.map(r => r.weight))
    if (maxW <= 1) rows.forEach(r => { r.weight = Math.round(r.weight * 100) })
  }

  return rows
}

export function XlsxRubricImportModal({ projectId, existingCount, onDone, onClose }: Props) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [colName, setColName] = useState('')
  const [colDesc, setColDesc] = useState('')
  const [colMarks, setColMarks] = useState('')
  const [colWeight, setColWeight] = useState('')
  const [editRows, setEditRows] = useState<ParsedRow[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (rawRows.length === 0) return
    setEditRows(buildRows(rawRows, colName, colDesc, colMarks, colWeight))
  }, [rawRows, colName, colDesc, colMarks, colWeight])

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
        setColName(detect(hdrs, NAME_HINTS))
        setColDesc(detect(hdrs, DESC_HINTS))
        setColMarks(detect(hdrs, MARKS_HINTS))
        setColWeight(detect(hdrs, WEIGHT_HINTS))
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

  function updateRow(i: number, field: keyof ParsedRow, value: string) {
    setEditRows(prev => prev.map((r, idx) =>
      idx === i
        ? { ...r, [field]: field === 'name' || field === 'description' ? value : Math.max(field === 'maxMarks' ? 1 : 0, parseFloat(value) || 0) }
        : r
    ))
  }

  function removeRow(i: number) {
    setEditRows(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleImport() {
    const valid = editRows.filter(r => r.name.trim())
    if (!valid.length) return
    setImporting(true)
    try {
      await bulkAddCriteria(projectId, valid.map(r => ({
        name: r.name.trim(),
        description: r.description.trim(),
        maxMarks: r.maxMarks,
        weight: r.weight / 100,
      })), existingCount)
      await updateProject(projectId, {
        totalMarks: valid.reduce((s, r) => s + r.maxMarks, 0),
      })
      onDone()
    } finally {
      setImporting(false)
    }
  }

  const totalWeight = editRows.reduce((s, r) => s + r.weight, 0)
  const weightOk = Math.abs(totalWeight - 100) < 1

  const selectClass = "bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-gray-200"
  const cellInput = "w-full bg-transparent text-sm text-gray-100 focus:outline-none"

  return (
    <Modal open onClose={onClose} title="Import rubric from spreadsheet" size="xl">
      <div className="flex flex-col gap-5">
        {/* Drop zone */}
        {rawRows.length === 0 ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-12 cursor-pointer transition-all ${dragOver ? 'border-gray-200 bg-gray-100/5' : 'border-gray-700 hover:border-gray-200-muted hover:bg-gray-800/40'}`}
          >
            <FileSpreadsheet size={36} className={dragOver ? 'text-gray-100' : 'text-gray-400'} />
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
            {/* Column mapping */}
            <div className="bg-gray-900/60 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Column mapping</p>
                <button
                  onClick={() => { setRawRows([]); setHeaders([]); setEditRows([]) }}
                  className="text-xs text-gray-400/70 hover:text-gray-400 flex items-center gap-1"
                >
                  <Upload size={11} /> Change file
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ['Criterion name *', colName, setColName],
                  ['Description', colDesc, setColDesc],
                  ['Max marks', colMarks, setColMarks],
                  ['Weight (%)', colWeight, setColWeight],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">{label}</label>
                    <select value={val} onChange={e => setter(e.target.value)} className={selectClass}>
                      <option value="">— none —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Editable preview table */}
            {editRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Preview — {editRows.length} {editRows.length === 1 ? 'criterion' : 'criteria'}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${weightOk ? 'text-emerald-400 bg-emerald-950/40' : 'text-amber-400 bg-amber-950/40'}`}>
                    Weights: {Math.round(totalWeight)}%{!weightOk && (totalWeight < 100 ? ` — ${Math.round(100 - totalWeight)}% unallocated` : ` — ${Math.round(totalWeight - 100)}% over`)}
                  </span>
                </div>
                <div className="rounded-xl border border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 bg-gray-900/60">
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 w-[38%]">Name</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-400">Description</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 w-20">Marks</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-400 w-20">Weight</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {editRows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
                          <td className="px-3 py-2">
                            <input
                              value={row.name}
                              onChange={e => updateRow(i, 'name', e.target.value)}
                              className={cellInput}
                              placeholder="Criterion name"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.description}
                              onChange={e => updateRow(i, 'description', e.target.value)}
                              className={`${cellInput} text-gray-400`}
                              placeholder="Optional description"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="1"
                              value={row.maxMarks}
                              onChange={e => updateRow(i, 'maxMarks', e.target.value)}
                              className={`${cellInput} text-right w-16 ml-auto`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={Math.round(row.weight)}
                                onChange={e => updateRow(i, 'weight', e.target.value)}
                                className={`${cellInput} text-right w-12`}
                              />
                              <span className="text-gray-400 text-xs">%</span>
                            </div>
                          </td>
                          <td className="px-2">
                            <button
                              onClick={() => removeRow(i)}
                              className="text-gray-400/50 hover:text-red-400 p-0.5 rounded transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {editRows.length === 0 && (
              <p className="text-sm text-gray-400/70 text-center py-4">
                No rows found. Make sure the <strong className="text-gray-400">Criterion name</strong> column is mapped correctly.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {editRows.length > 0 && (
            <Button variant="primary" onClick={handleImport} disabled={importing || editRows.filter(r => r.name.trim()).length === 0}>
              {importing ? 'Importing…' : `Import ${editRows.filter(r => r.name.trim()).length} criteria`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
