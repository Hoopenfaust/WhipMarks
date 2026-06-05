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

  const answers = req.body

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const result = await upstream.json()
  res.status(upstream.status).json(result)
}
