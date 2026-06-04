export interface ExtractedCompetency {
  name: string
  description: string
}

export interface GeneratedCriterion {
  name: string
  description: string
  maxMarks: number
  weight: number
}

export interface GuidedRubricAnswers {
  projectName: string
  discipline: string
  deliverables: string[]
  focusAreas: string[]
  excellenceDescription: string
  failureDescription: string
  criteriaCount: number
  outcomeWeight: number   // 0–100
}

export interface GeneratedDescriptor {
  text: string
  score: number
}

export interface GeneratedCriterionWithDescriptors extends GeneratedCriterion {
  descriptors: {
    excellent:    GeneratedDescriptor
    good:         GeneratedDescriptor
    satisfactory: GeneratedDescriptor
    poor:         GeneratedDescriptor
  }
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

export async function extractCompetenciesFromDocument(
  data: ArrayBuffer,
  mimeType: string,
): Promise<ExtractedCompetency[]> {
  const base64 = arrayBufferToBase64(data)

  const res = await fetch('/api/extract-competencies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, mimeType }),
  })

  const result = await res.json() as { content?: { type: string; text: string }[]; error?: string }

  if (!res.ok) throw new Error(result.error ?? `Server error ${res.status}`)

  const text  = result.content?.find(b => b.type === 'text')?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON found in response')

  return JSON.parse(match[0]) as ExtractedCompetency[]
}

export async function generateRubricFromAnswers(answers: GuidedRubricAnswers): Promise<GeneratedCriterionWithDescriptors[]> {
  const res = await fetch('/api/guided-rubric', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(answers),
  })

  const result = await res.json() as { content?: { type: string; text: string }[]; error?: string }
  if (!res.ok) throw new Error(result.error ?? `Server error ${res.status}`)

  const text  = result.content?.find(b => b.type === 'text')?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON found in response')

  return JSON.parse(match[0]) as GeneratedCriterionWithDescriptors[]
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
