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
  if (!data || !mimeType) {
    res.status(400).json({ error: 'Missing data or mimeType' })
    return
  }

  const isPdf = mimeType === 'application/pdf'
  const contentSource = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data } }

  const prompt = `You are helping a design educator extract a marking scheme from a project brief.

The marking/assessment scheme is typically at the bottom of the document. Extract every criterion from it.

Return ONLY a valid JSON array — no markdown, no commentary:
[
  {
    "name": "Criterion name (2–5 words)",
    "description": "One sentence describing what this criterion assesses.",
    "maxMarks": <integer>,
    "weight": <decimal 0–1, proportional to maxMarks>,
    "descriptors": {
      "excellent":    { "text": "Observable description of mastery-level work for this criterion.", "score": 1.0 },
      "good":         { "text": "Observable description of proficient but not exceptional work.", "score": 0.75 },
      "satisfactory": { "text": "Observable description of work that meets minimum expectations.", "score": 0.5 },
      "poor":         { "text": "Observable description of work that does not meet expectations.", "score": 0.25 }
    }
  }
]

Rules:
- Extract criteria exactly as written — do not invent or omit any
- maxMarks must match what is written in the document exactly
- weights must be proportional to maxMarks and sum to exactly 1.0
- If the document already has descriptors or grade descriptions, use them for the descriptor text
- If the document has no descriptors, write plausible ones based on the criterion name, description, and discipline context
- Write descriptors starting with "The student..." using assessable, observable language`

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: [contentSource, { type: 'text', text: prompt }] }],
    }),
  })

  const result = await upstream.json()
  res.status(upstream.status).json(result)
}
