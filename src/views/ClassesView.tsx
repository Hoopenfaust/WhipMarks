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
import { db } from '../db/db'
import { downloadBackup, restoreFromFile, restoreFromLocalStorage } from '../utils/backup'

function ClassCard({ c, isFirst }: { c: { id: string; name: string; createdAt: number }; isFirst?: boolean }) {
  const students = useStudents(c.id)
  const projects = useProjects(c.id)
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/classes/${c.id}`)}
      {...(isFirst ? { 'data-tutorial': 'class-card' } : {})}
      className="relative bg-gray-850 border border-gray-700 rounded-2xl p-6 text-left hover:border-indigo-500/30 hover:bg-gray-800 transition-all duration-200 group overflow-hidden shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/25"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-600 dark:bg-indigo-600">
          <BookOpen size={20} className="text-white" />
        </div>
        <span className="text-xs text-gray-400/70">{new Date(c.createdAt).toLocaleDateString()}</span>
      </div>

      <h3 className="text-lg font-medium text-gray-100 mb-1 group-hover:text-white transition-colors leading-snug">{c.name}</h3>

      <div className="flex gap-4 mt-4 pt-4 border-t border-gray-700/60">
        <span className="flex items-center gap-1.5 text-sm text-gray-400 group-hover:text-gray-400 transition-colors">
          <Users size={13} /> {students.length} <span className="text-gray-400/50">students</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-gray-400 group-hover:text-gray-400 transition-colors">
          <FolderOpen size={13} /> {projects.length} <span className="text-gray-400/50">projects</span>
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
  emailCol: string      // empty string = none
  className: string
}

export function ClassesView() {
  const classes = useClasses()
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)
  const [restoreDragging, setRestoreDragging] = useState(false)
  const [importState, setImportState] = useState<ImportState | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
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
    setRestoreError(null)
    try {
      await restoreFromFile(file)
      setShowRestorePrompt(false)
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'File may be corrupt or from an incompatible version')
    } finally {
      setRestoring(false)
    }
  }

  async function processFile(file: File) {
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return
    setImportError(null)
    try {
      const { headers, rows } = await parseSpreadsheetFile(file)
      const nameCol = detectNameColumn(headers) ?? headers[0]
      const firstNameCol = headers.find(h => /first.?name|given.?name|forename/i.test(h)) ?? ''
      const emailCol = headers.find(h => /^e.?mail/i.test(h)) ?? ''
      const className = file.name.replace(/\.(csv|xlsx|xls)$/i, '')
      setImportState({ file, headers, rows, nameCol, firstNameCol, emailCol, className })
    } catch (err) {
      setImportError('Could not read file: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
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
    setImportError(null)
    try {
      const students = importState.rows
        .map(r => ({
          name: r[importState.nameCol]?.trim() ?? '',
          firstName: importState.firstNameCol ? r[importState.firstNameCol]?.trim() : undefined,
          email: importState.emailCol ? r[importState.emailCol]?.trim() : undefined,
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

      setImportState(null)
      navigate(`/classes/${classId}`)
    } catch (err) {
      setImportError('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setImporting(false)
    }
  }

  const previewName = (r: Record<string, string>) => {
    const last = importState ? r[importState.nameCol]?.trim() : ''
    const first = importState?.firstNameCol ? r[importState.firstNameCol]?.trim() : ''
    return [first, last].filter(Boolean).join(' ') || '—'
  }

  if (!dbChecked) return null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <span className="text-base font-medium text-gray-100 tracking-wide">Your classes</span>
        <div className="flex items-center gap-2">
          {classes.length > 0 && (
            <button onClick={downloadBackup} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              <Download size={15} /> Save Backup
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} data-tutorial="import-btn" className="btn-accent inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all">
            <Upload size={15} /> Import
          </button>
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

      {importError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {importError}
          <button onClick={() => setImportError(null)} className="shrink-0 text-red-400/70 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Restore prompt — shown when DB is empty and no localStorage backup */}
      {showRestorePrompt && classes.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setRestoreDragging(true) }}
          onDragLeave={() => setRestoreDragging(false)}
          onDrop={e => { e.preventDefault(); setRestoreDragging(false); const f = e.dataTransfer.files[0]; if (f) handleRestoreFile(f) }}
          onClick={() => restoreRef.current?.click()}
          className={`mb-6 border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            restoreDragging ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700/60 bg-gray-950/20 hover:border-indigo-700/40'
          }`}
        >
          <RotateCcw size={32} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-100 font-medium">Restore from backup</p>
          <p className="text-sm text-gray-400 mt-1">Drop your <span className="text-gray-100">whipmarks-*.json</span> backup file here, or click to browse</p>
          {restoring && <p className="text-sm text-gray-100 mt-3">Restoring…</p>}
          {restoreError && <p className="text-sm text-red-400 mt-3">{restoreError}</p>}
          <div className="mt-5 border-t border-gray-800 pt-5">
            <p className="text-xs text-gray-400/70 mb-2">No backup? Start fresh by importing a class list below</p>
            <button
              onClick={e => { e.stopPropagation(); setShowRestorePrompt(false) }}
              className="text-xs text-gray-400 hover:text-gray-100 underline underline-offset-2"
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
            dragging ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Upload size={32} className="text-gray-400/70 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Drop a class list here</p>
          <p className="text-sm text-gray-400/70 mt-1">or click to browse — CSV or Excel (.xlsx) with a name column</p>
        </div>
      )}

      {classes.length > 0 && (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`mb-6 border border-dashed rounded-lg p-3 text-center transition-colors ${
              dragging ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-800 hover:border-gray-700'
            }`}
          >
            <p className="text-xs text-gray-400/70">Drop CSV or Excel file to import a class</p>
          </div>

          <div className={`grid gap-4 ${classes.length === 1 ? 'grid-cols-1 max-w-sm' : classes.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {classes.map((c, i) => <ClassCard key={c.id} c={c} isFirst={i === 0} />)}
          </div>
        </>
      )}

      {/* Import Column Mapper Modal */}
      <Modal open={!!importState} onClose={() => { setImportState(null); setImportError(null) }} title="Import Class List" maxWidth="max-w-lg">
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-400"
                  value={importState.nameCol}
                  onChange={e => setImportState(s => s ? { ...s, nameCol: e.target.value } : s)}
                >
                  {importState.headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">First name column <span className="text-gray-400/70">(optional)</span></label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-400"
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
              <label className="text-xs font-medium text-gray-400 mb-1 block">Email column <span className="text-gray-400/70">(optional — used to email mark reports)</span></label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-400"
                value={importState.emailCol}
                onChange={e => setImportState(s => s ? { ...s, emailCol: e.target.value } : s)}
              >
                <option value="">— none —</option>
                {importState.headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Preview (first 5)</p>
              <div className="bg-gray-900 rounded-lg p-3 flex flex-col gap-1">
                {importState.rows.slice(0, 5).map((r, i) => (
                  <span key={i} className="text-sm text-gray-100">{previewName(r)}</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{importState.rows.length} students total</p>
            </div>

            {importError && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{importError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setImportState(null); setImportError(null) }}>Cancel</Button>
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
