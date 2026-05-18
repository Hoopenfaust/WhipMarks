import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, BookOpen, Users, FolderOpen, Download, RotateCcw } from 'lucide-react'
import { useClasses, createClass } from '../db/hooks/useClasses'
import { useStudents } from '../db/hooks/useStudents'
import { useProjects } from '../db/hooks/useProjects'
import { bulkAddStudents } from '../db/hooks/useStudents'
import { parseSpreadsheetFile, detectNameColumn } from '../utils/csv'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { db } from '../db/db'
import { downloadBackup, restoreFromFile, restoreFromLocalStorage } from '../utils/backup'

function ClassCard({ c }: { c: { id: string; name: string; createdAt: number } }) {
  const students = useStudents(c.id)
  const projects = useProjects(c.id)
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/classes/${c.id}`)}
      className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-left hover:border-gray-600 hover:bg-gray-750 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-orange-950 rounded-lg">
          <BookOpen size={18} className="text-orange-400" />
        </div>
        <Badge variant="default">{new Date(c.createdAt).toLocaleDateString()}</Badge>
      </div>
      <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-white">{c.name}</h3>
      <div className="flex gap-3">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Users size={12} /> {students.length} students
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <FolderOpen size={12} /> {projects.length} projects
        </span>
      </div>
    </button>
  )
}

interface ImportState {
  file: File
  headers: string[]
  rows: Record<string, string>[]
  nameCol: string
  firstNameCol: string  // empty string = none
  className: string
}

export function ClassesView() {
  const classes = useClasses()
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)
  const [restoreDragging, setRestoreDragging] = useState(false)
  const [importState, setImportState] = useState<ImportState | null>(null)
  const [importing, setImporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [dbChecked, setDbChecked] = useState(false)
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLInputElement>(null)

  // On mount: if DB is empty, try auto-restore from localStorage backup
  useEffect(() => {
    async function check() {
      const count = await db.classes.count()
      if (count === 0) await restoreFromLocalStorage()
      setDbChecked(true)
    }
    check()
  }, [])

  async function handleRestoreFile(file: File) {
    if (!file.name.match(/\.json$/i)) return
    setRestoring(true)
    try {
      await restoreFromFile(file)
      setShowRestorePrompt(false)
    } finally {
      setRestoring(false)
    }
  }

  async function processFile(file: File) {
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return
    const { headers, rows } = await parseSpreadsheetFile(file)
    const nameCol = detectNameColumn(headers) ?? headers[0]
    const firstNameCol = headers.find(h => /first.?name|given.?name|forename/i.test(h)) ?? ''
    const className = file.name.replace(/\.(csv|xlsx|xls)$/i, '')
    setImportState({ file, headers, rows, nameCol, firstNameCol, className })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  async function handleImport() {
    if (!importState) return
    setImporting(true)

    const students = importState.rows
      .map(r => ({
        name: r[importState.nameCol]?.trim() ?? '',
        firstName: importState.firstNameCol ? r[importState.firstNameCol]?.trim() : undefined,
      }))
      .filter(s => s.name)

    const existing = classes.find(c => c.name === importState.className)
    let classId: string
    if (existing) {
      classId = existing.id
      const existingStudents = await db.students.where('classId').equals(classId).toArray()
      await bulkAddStudents(classId, students, existingStudents.length)
    } else {
      const c = await createClass(importState.className)
      classId = c.id
      await bulkAddStudents(classId, students)
    }

    setImporting(false)
    setImportState(null)
    navigate(`/classes/${classId}`)
  }

  const previewName = (r: Record<string, string>) => {
    const last = importState ? r[importState.nameCol]?.trim() : ''
    const first = importState?.firstNameCol ? r[importState.firstNameCol]?.trim() : ''
    return [first, last].filter(Boolean).join(' ') || '—'
  }

  if (!dbChecked) return null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Classes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your classes and students</p>
        </div>
        <div className="flex items-center gap-2">
          {classes.length > 0 && (
            <Button variant="ghost" size="sm" onClick={downloadBackup}>
              <Download size={15} /> Save Backup
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        <input
          ref={restoreRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleRestoreFile(f); e.target.value = '' }}
        />
      </div>

      {/* Restore prompt — shown when DB is empty and no localStorage backup */}
      {showRestorePrompt && classes.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setRestoreDragging(true) }}
          onDragLeave={() => setRestoreDragging(false)}
          onDrop={e => { e.preventDefault(); setRestoreDragging(false); const f = e.dataTransfer.files[0]; if (f) handleRestoreFile(f) }}
          onClick={() => restoreRef.current?.click()}
          className={`mb-6 border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            restoreDragging ? 'border-orange-500 bg-orange-950/20' : 'border-orange-900/60 bg-orange-950/10 hover:border-orange-700/60'
          }`}
        >
          <RotateCcw size={32} className="text-orange-600 mx-auto mb-3" />
          <p className="text-gray-300 font-medium">Restore from backup</p>
          <p className="text-sm text-gray-500 mt-1">Drop your <span className="text-gray-300">gradedesk-*.json</span> backup file here, or click to browse</p>
          {restoring && <p className="text-sm text-orange-400 mt-3">Restoring…</p>}
          <div className="mt-5 border-t border-gray-800 pt-5">
            <p className="text-xs text-gray-600 mb-2">No backup? Start fresh by importing a class list below</p>
            <button
              onClick={e => { e.stopPropagation(); setShowRestorePrompt(false) }}
              className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
            >
              Skip and start fresh
            </button>
          </div>
        </div>
      )}

      {/* Drop Zone — shown when no classes and not showing restore prompt */}
      {!showRestorePrompt && classes.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`mb-6 border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragging ? 'border-orange-500 bg-orange-950/20' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Upload size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Drop a class list here</p>
          <p className="text-sm text-gray-600 mt-1">or click to browse — CSV or Excel (.xlsx) with a name column</p>
        </div>
      )}

      {classes.length > 0 && (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`mb-6 border border-dashed rounded-lg p-3 text-center transition-colors ${
              dragging ? 'border-orange-500 bg-orange-950/20' : 'border-gray-800 hover:border-gray-700'
            }`}
          >
            <p className="text-xs text-gray-600">Drop CSV or Excel file to import a class</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(c => <ClassCard key={c.id} c={c} />)}
          </div>
        </>
      )}

      {/* Import Column Mapper Modal */}
      <Modal open={!!importState} onClose={() => setImportState(null)} title="Import Class List" maxWidth="max-w-lg">
        {importState && (
          <div className="flex flex-col gap-4">
            <Input
              label="Class name"
              value={importState.className}
              onChange={e => setImportState(s => s ? { ...s, className: e.target.value } : s)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Last / full name column</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500"
                  value={importState.nameCol}
                  onChange={e => setImportState(s => s ? { ...s, nameCol: e.target.value } : s)}
                >
                  {importState.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">First name column <span className="text-gray-600">(optional)</span></label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500"
                  value={importState.firstNameCol}
                  onChange={e => setImportState(s => s ? { ...s, firstNameCol: e.target.value } : s)}
                >
                  <option value="">— none —</option>
                  {importState.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Preview (first 5)</p>
              <div className="bg-gray-900 rounded-lg p-3 flex flex-col gap-1">
                {importState.rows.slice(0, 5).map((r, i) => (
                  <span key={i} className="text-sm text-gray-300">{previewName(r)}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{importState.rows.length} students total</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setImportState(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleImport} disabled={importing}>
                {importing ? 'Importing…' : `Import ${importState.rows.length} Students`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
