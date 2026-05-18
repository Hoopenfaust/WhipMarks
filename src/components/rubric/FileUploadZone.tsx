import { useRef, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import { saveProjectSheet, deleteProjectSheet } from '../../db/hooks/useProjectSheet'
import { Button } from '../ui/Button'
import type { ProjectSheet } from '../../types'

interface Props {
  projectId: string
  sheet: ProjectSheet | undefined | null
  onUploaded?: (sheet: ProjectSheet) => void
}

export function FileUploadZone({ projectId, sheet, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setSaving(true)
    const saved = await saveProjectSheet(projectId, file)
    setSaving(false)
    onUploaded?.(saved)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (sheet) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg">
        <FileText size={16} className="text-orange-400 shrink-0" />
        <span className="text-sm text-gray-300 flex-1 truncate">{sheet.filename}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => { await deleteProjectSheet(projectId) }}
          className="p-1 text-gray-500 hover:text-red-400"
        >
          <X size={14} />
        </Button>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
        dragging ? 'border-orange-500 bg-orange-950/20' : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      <Upload size={24} className="text-gray-600" />
      <p className="text-sm text-gray-500">{saving ? 'Saving…' : 'Upload project sheet (PDF, image)'}</p>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}
