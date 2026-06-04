import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal(): Record<string, string> {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    const vars: Record<string, string> = {}
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
    return vars
  } catch {
    return {}
  }
}

async function callClaude(
  apiKey: string,
  data: string,
  mimeType: string,
  prompt: string,
): Promise<Response> {
  const isPdf = mimeType === 'application/pdf'
  const contentSource = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image',    source: { type: 'base64', media_type: mimeType, data } }

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: [contentSource, { type: 'text', text: prompt }] }],
    }),
  })
}

async function callClaudeText(apiKey: string, prompt: string): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
}

function anthropicProxyPlugin(): Plugin {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {

      // ── /api/generate-rubric ───────────────────────────────────────────────
      server.middlewares.use('/api/generate-rubric', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }

        const envLocal = loadEnvLocal()
        const apiKey = envLocal.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set in the environment' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const { data, mimeType } = JSON.parse(Buffer.concat(chunks).toString()) as { data: string; mimeType: string }

        const prompt = `Analyze this assignment/project sheet and produce a marking rubric.

Return ONLY a valid JSON array — no markdown fences, no commentary. Each element:
{
  "name": "short criterion name",
  "description": "one sentence: what is assessed and what earns full marks",
  "maxMarks": <integer>,
  "weight": <decimal 0–1>
}

Rules:
- weights must sum to exactly 1.0
- 3–8 criteria based on assignment complexity
- if the sheet shows a mark breakdown, use those exact marks and weights
- descriptions should be concise enough to fit in a marking grid cell`

        try {
          const upstream = await callClaude(apiKey, data, mimeType, prompt)
          const result = await upstream.json()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      // ── /api/guided-rubric ────────────────────────────────────────────────────
      server.middlewares.use('/api/guided-rubric', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }

        const envLocal = loadEnvLocal()
        const apiKey = envLocal.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set in .env.local' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const answers = JSON.parse(Buffer.concat(chunks).toString()) as {
          projectName: string
          discipline: string
          deliverables: string[]
          focusAreas: string[]
          excellenceDescription: string
          failureDescription: string
          criteriaCount: number
          outcomeWeight: number
        }

        const prompt = `You are an experienced university design educator helping a new teacher create an assessment rubric.

Based on the teacher's answers below, generate a complete marking rubric with detailed level descriptors for each criterion.

PROJECT INFORMATION:
- Project name: ${answers.projectName}
- Discipline: ${answers.discipline}
- What students produce: ${answers.deliverables.join(', ')}
- Key focus areas the teacher cares about: ${answers.focusAreas.join(', ')}
- What full-marks work looks like: ${answers.excellenceDescription || 'not specified'}
- Common failure modes: ${answers.failureDescription || 'not specified'}
- Number of criteria to generate: ${answers.criteriaCount}
- Emphasis: ${answers.outcomeWeight}% on final outcome, ${100 - answers.outcomeWeight}% on process

Generate exactly ${answers.criteriaCount} criteria. Return ONLY a valid JSON array — no markdown, no commentary:
[
  {
    "name": "Criterion Name (2-4 words)",
    "description": "One sentence explaining what this criterion assesses and what earns full marks.",
    "maxMarks": <integer>,
    "weight": <decimal 0-1>,
    "descriptors": {
      "excellent":    { "text": "Specific, observable description of mastery-level work for this criterion.", "score": 1.0 },
      "good":         { "text": "Specific description of proficient but not exceptional work.", "score": 0.75 },
      "satisfactory": { "text": "Specific description of adequate work that meets minimum expectations.", "score": 0.5 },
      "poor":         { "text": "Specific description of work that does not meet expectations.", "score": 0.25 }
    }
  }
]

Rules:
- All weights must sum to exactly 1.0
- All maxMarks must sum to 100
- Distribute weight according to the outcome/process emphasis
- Each descriptor must be specific to THIS criterion and project — no generic phrases
- Write descriptors starting with "The student..." using observable, assessable language
- Reflect the teacher's own words about excellence and failure where possible
- Use vocabulary appropriate for ${answers.discipline} education`

        try {
          const upstream = await callClaudeText(apiKey, prompt)
          const result = await upstream.json()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      // ── /api/extract-competencies ──────────────────────────────────────────
      server.middlewares.use('/api/extract-competencies', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }

        const envLocal = loadEnvLocal()
        const apiKey = envLocal.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set in the environment' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const { data, mimeType } = JSON.parse(Buffer.concat(chunks).toString()) as { data: string; mimeType: string }

        const prompt = `Analyze this course outline or program document and extract all program learning outcomes, graduate attributes, or competencies that student work is assessed against.

Return ONLY a valid JSON array — no markdown fences, no commentary. Each element:
{
  "name": "short competency name (5 words max)",
  "description": "one clear sentence describing what this competency covers"
}

Rules:
- extract only genuine learning outcomes or competencies, not administrative content
- 3–12 competencies depending on the document
- use the exact language from the document where possible
- if the document lists numbered outcomes (e.g. LO1, CLO3), include the number in the name`

        try {
          const upstream = await callClaude(apiKey, data, mimeType, prompt)
          const result = await upstream.json()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

    },
  }
}

export default defineConfig({
  plugins: [react(), anthropicProxyPlugin()],
})
