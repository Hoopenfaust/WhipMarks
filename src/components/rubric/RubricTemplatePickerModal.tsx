import { useState } from 'react'
import { Trash2, BookTemplate, CheckCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useTemplates, deleteTemplate, applyTemplate } from '../../db/hooks/useTemplates'
import type { TemplateCriterion } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  existingCount: number
}

export function RubricTemplatePickerModal({ open, onClose, projectId, existingCount }: Props) {
  const templates = useTemplates()
  const [applying, setApplying] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState<string | null>(null)

  async function handleApply(templateId: string, mode: 'append' | 'replace') {
    setApplying(templateId)
    setConfirmReplace(null)
    await applyTemplate(projectId, templateId, mode)
    setApplying(null)
    onClose()
  }

  function handleApplyClick(templateId: string) {
    if (existingCount > 0) {
      setConfirmReplace(templateId)
    } else {
      handleApply(templateId, 'replace')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Apply Template" size="lg">
      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <BookTemplate size={36} className="text-gray-600" />
          <p className="text-sm text-gray-400">No templates saved yet.</p>
          <p className="text-xs text-gray-500">Build a rubric and click "Save as template" to create one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map(t => {
            const items: TemplateCriterion[] = JSON.parse(t.criteriaJson)
            const isConfirming = confirmReplace === t.id
            const isApplying = applying === t.id

            return (
              <div key={t.id} className="flex flex-col gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {items.length} {items.length === 1 ? 'criterion' : 'criteria'} ·{' '}
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => { await deleteTemplate(t.id) }}
                      className="p-1.5 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isApplying}
                      onClick={() => handleApplyClick(t.id)}
                    >
                      {isApplying ? 'Applying…' : 'Apply'}
                    </Button>
                  </div>
                </div>

                {isConfirming && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-700 mt-1">
                    <p className="text-xs text-amber-400 flex-1">
                      This project already has criteria. Replace or append?
                    </p>
                    <Button size="sm" variant="danger" onClick={() => handleApply(t.id, 'replace')}>
                      Replace all
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleApply(t.id, 'append')}>
                      Append
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmReplace(null)}>
                      Cancel
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap gap-1 mt-0.5">
                  {items.map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-750 border border-gray-700 rounded px-2 py-0.5 text-gray-300">
                      <CheckCircle size={10} className="text-gray-500" />
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
