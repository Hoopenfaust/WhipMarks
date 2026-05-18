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

function anthropicProxyPlugin(): Plugin {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/generate-rubric', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.statusCode = 405; res.end('Method Not Allowed'); return
        }

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

        const isPdf = mimeType === 'application/pdf'
        const contentSource = isPdf
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
          : { type: 'image', source: { type: 'base64', media_type: mimeType, data } }

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
          const upstream = await fetch('https://api.anthropic.com/v1/messages', {
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
