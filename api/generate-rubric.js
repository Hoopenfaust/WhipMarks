export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })
    return
  }

  const { data, mimeType } = req.body
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
  res.status(upstream.status).json(result)
}
