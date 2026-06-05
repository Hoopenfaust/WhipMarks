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
