export interface GeneratedCriterion {
  name: string
  description: string
  maxMarks: number
  weight: number
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function generateRubricFromDocument(
  data: ArrayBuffer,
  mimeType: string,
): Promise<GeneratedCriterion[]> {
  const base64 = arrayBufferToBase64(data)

  const res = await fetch('/api/generate-rubric', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, mimeType }),
  })

  const result = await res.json() as { content?: { type: string; text: string }[]; error?: string }

  if (!res.ok) {
    throw new Error(result.error ?? `Server error ${res.status}`)
  }

  const text = result.content?.find(b => b.type === 'text')?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON found in response')

  return JSON.parse(match[0]) as GeneratedCriterion[]
}
