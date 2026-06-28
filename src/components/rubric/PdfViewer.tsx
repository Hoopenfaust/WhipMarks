import { useState, useEffect } from 'react'
import type { ProjectSheet } from '../../types'

interface Props {
  sheet: ProjectSheet
}

export function PdfViewer({ sheet }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const blob = new Blob([sheet.data], { type: sheet.mimeType })
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl) // eslint-disable-line react-hooks/set-state-in-effect
    return () => URL.revokeObjectURL(objectUrl)
  }, [sheet])

  if (!url) return null

  if (sheet.mimeType.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={sheet.filename}
        className="w-full h-full object-contain"
      />
    )
  }

  return (
    <iframe
      src={url}
      title={sheet.filename}
      className="w-full h-full border-0"
    />
  )
}
