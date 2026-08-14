const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

async function uploadVoiceToElevenLabs(voiceData, voiceName) {
  if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not configured')

  const formData = new FormData()
  formData.append('name', voiceName)
  formData.append('files', new Blob([voiceData], { type: 'audio/webm' }), 'voice.webm')
  formData.append('description', `Voice sample for SochGuru creator: ${voiceName}`)

  const res = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: formData
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs API ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  return { voiceId: data.voice_id, voiceName: data.name }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { voiceSamples, creatorName } = body

    if (!voiceSamples || voiceSamples.length === 0) {
      return Response.json({ error: 'No voice samples provided' }, { status: 400 })
    }

    if (!ELEVENLABS_API_KEY) {
      return Response.json(
        { error: 'Voice cloning not configured. Set ELEVENLABS_API_KEY in environment.' },
        { status: 500 }
      )
    }

    const results = []
    for (const sample of voiceSamples) {
      try {
        const voiceData = Buffer.from(sample.data, 'base64')
        const voiceName = `${creatorName}-${sample.type || 'sample'}`
        const voiceInfo = await uploadVoiceToElevenLabs(voiceData, voiceName)
        results.push({ type: sample.type, status: 'cloned', ...voiceInfo })
      } catch (err) {
        results.push({ type: sample.type, status: 'failed', error: err.message })
      }
    }

    const allSuccess = results.every(r => r.status === 'cloned')
    return Response.json(
      { results, status: allSuccess ? 'success' : 'partial' },
      { status: allSuccess ? 200 : 207 }
    )
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
