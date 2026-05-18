import { useEffect, useRef } from 'react'
import type { ProjectSheet } from '../../types'

interface Props {
  sheet: ProjectSheet
}

export function PdfViewer({ sheet }: Props) {
  const urlRef = useRef<string | null>(null)

  const blob = new Blob([sheet.data], { type: sheet.mimeType })
  if (!urlRef.current) urlRef.current = URL.createObjectURL(blob)

  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [])

  if (sheet.mimeType.startsWith('image/')) {
    return (
      <img
        src={urlRef.current!}
        alt={sheet.filename}
        className="w-full h-full object-contain"
      />
    )
  }

  return (
    <iframe
      src={urlRef.current!}
      title={sheet.filename}
      className="w-full h-full border-0"
    />
  )
}
