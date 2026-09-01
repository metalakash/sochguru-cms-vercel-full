import { guard, safeUpstreamError } from '../../../lib/security'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

const MAX_SAMPLES = 5
const MAX_SAMPLE_BYTES = 4 * 1024 * 1024   // 4 MB of decoded audio per sample
const MAX_BODY_BYTES = 24 * 1024 * 1024    // base64 inflates ~33%, plus JSON overhead

async function cloneVoiceFromSamples(samples, voiceName) {
  if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not configured')

  const formData = new FormData()
  formData.append('name', voiceName)
  formData.append('description', `Cloned voice for SochGuru creator: ${voiceName}`)
  samples.forEach((sample, i) => {
    formData.append('files', new Blob([sample.buffer], { type: 'audio/webm' }), `${sample.type}-${i}.webm`)
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

/** Decode and bound each sample before any of it reaches ElevenLabs. */
function decodeSamples(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('No voice samples provided')
  }
  if (raw.length > MAX_SAMPLES) {
    throw new Error(`Too many samples (max ${MAX_SAMPLES})`)
  }

  return raw.map((sample, i) => {
    if (!sample || typeof sample.data !== 'string') {
      throw new Error(`Sample ${i + 1} is missing audio data`)
    }
    const buffer = Buffer.from(sample.data, 'base64')
    if (buffer.length === 0) throw new Error(`Sample ${i + 1} decoded to empty audio`)
    if (buffer.length > MAX_SAMPLE_BYTES) {
      throw new Error(`Sample ${i + 1} is too large (max ${MAX_SAMPLE_BYTES / 1024 / 1024} MB)`)
    }
    const type = typeof sample.type === 'string' ? sample.type.replace(/[^a-z0-9_-]/gi, '').slice(0, 24) : ''
    return { buffer, type: type || 'sample' }
  })
}

export async function POST(request) {
  const { body, response } = await guard(request, {
    name: 'clone-voice',
    limit: 3,
    windowMs: 10 * 60 * 1000,
    maxBytes: MAX_BODY_BYTES
  })
  if (response) return response

  if (!ELEVENLABS_API_KEY) {
    return Response.json(
      { error: 'Voice cloning not configured. Set ELEVENLABS_API_KEY in environment.' },
      { status: 503 }
    )
  }

  let samples
  try {
    samples = decodeSamples(body.voiceSamples)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }

  const rawName = typeof body.creatorName === 'string' ? body.creatorName.trim() : ''
  const voiceName = (rawName || 'SochGuru Creator').slice(0, 60)

  try {
    // All samples (neutral/excited/nepali) go into one clone — more training audio
    // makes a better single voice, rather than three separate voices where only
    // one would ever get used downstream.
    const result = await cloneVoiceFromSamples(samples, voiceName)
    return Response.json({ ...result, sampleCount: samples.length, status: 'success' })
  } catch (err) {
    return Response.json({ error: safeUpstreamError(err, 'ElevenLabs'), status: 'error' }, { status: 502 })
  }
}
