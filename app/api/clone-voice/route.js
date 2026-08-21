const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

async function cloneVoiceFromSamples(samples, voiceName) {
  if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not configured')

  const formData = new FormData()
  formData.append('name', voiceName)
  formData.append('description', `Cloned voice for SochGuru creator: ${voiceName}`)
  samples.forEach((sample, i) => {
    const buf = Buffer.from(sample.data, 'base64')
    formData.append('files', new Blob([buf], { type: 'audio/webm' }), `${sample.type || 'sample'}-${i}.webm`)
  })

  const res = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    body: formData
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs API ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  // The IVC response is only { voice_id, requires_verification } — no "name" key to echo back.
  return { voiceId: data.voice_id, voiceName, requiresVerification: data.requires_verification }
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
        { status: 503 }
      )
    }

    // All samples (neutral/excited/nepali) go into one clone — more training audio
    // makes a better single voice, rather than three separate voices where only
    // one would ever get used downstream.
    const voiceName = creatorName || 'SochGuru Creator'
    const result = await cloneVoiceFromSamples(voiceSamples, voiceName)

    return Response.json({ ...result, sampleCount: voiceSamples.length, status: 'success' })
  } catch (err) {
    return Response.json({ error: err.message, status: 'error' }, { status: 502 })
  }
}
