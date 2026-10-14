export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!apiKey || !voiceId) {
    res.status(500).json({ error: 'ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are not configured' })
    return
  }

  const { text } = req.body
  if (!text) {
    res.status(400).json({ error: 'Missing text' })
    return
  }

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }),
    })
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `ElevenLabs error ${upstream.status}: ${await upstream.text()}` })
      return
    }
    res.setHeader('Content-Type', 'audio/mpeg')
    res.status(200).send(Buffer.from(await upstream.arrayBuffer()))
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
}
