import { guard, safeUpstreamError } from '../../../lib/security'

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY
const HEYGEN_BASE = 'https://api.heygen.com/v3'
const DEFAULT_AVATAR_ID = process.env.HEYGEN_AVATAR_ID || 'Wayne_20240711'
const MAX_SCRIPT_CHARS = 3000

async function createHeyGenVideo(script, voiceId) {
  if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured')
  if (!voiceId) throw new Error('A HeyGen voice_id is required — the ElevenLabs voice cloned in Step 2 is not a HeyGen voice ID, HeyGen has its own voice catalog/cloning path.')

  const payload = {
    type: 'avatar',
    avatar_id: DEFAULT_AVATAR_ID,
    script,
    voice_id: voiceId,
    aspect_ratio: '9:16',
    resolution: '1080p'
  }

  const res = await fetch(`${HEYGEN_BASE}/videos`, {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HeyGen API ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  return {
    jobId: data.data?.video_id,
    status: 'pending',
    videoUrl: null
  }
}

async function checkHeyGenStatus(jobId) {
  if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured')

  const res = await fetch(`${HEYGEN_BASE}/videos/${encodeURIComponent(jobId)}`, {
    headers: { 'X-Api-Key': HEYGEN_API_KEY }
  })

  if (!res.ok) {
    throw new Error(`HeyGen status check failed: ${res.status}`)
  }

  const data = await res.json()
  const status = data.data?.status

  return {
    jobId,
    status,
    videoUrl: status === 'completed' ? data.data?.video_url : null,
    failureMessage: status === 'failed' ? data.data?.failure_message : null
  }
}

export async function POST(request) {
  const { body, response } = await guard(request, {
    name: 'generate-avatar',
    // Status polling runs every 5s, so the window has to accommodate a full job.
    limit: 60,
    windowMs: 5 * 60 * 1000,
    maxBytes: 32 * 1024
  })
  if (response) return response

  const { action } = body

  if (action === 'generate') {
    const script = typeof body.script === 'string' ? body.script.trim() : ''
    if (!script) {
      return Response.json({ error: 'script is required' }, { status: 400 })
    }
    if (script.length > MAX_SCRIPT_CHARS) {
      return Response.json({ error: `Script is too long (max ${MAX_SCRIPT_CHARS} characters)` }, { status: 400 })
    }

    if (!HEYGEN_API_KEY) {
      return Response.json(
        { error: 'Avatar generation not configured. Set HEYGEN_API_KEY in environment.' },
        { status: 503 }
      )
    }

    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : ''

    try {
      const result = await createHeyGenVideo(script, voiceId)
      return Response.json({
        ...result,
        message: 'Video generation started. Check status with jobId.'
      })
    } catch (err) {
      // The voice_id hint is our own guidance, worth surfacing verbatim.
      const message = /voice_id is required/.test(err.message) ? err.message : safeUpstreamError(err, 'HeyGen')
      return Response.json({ error: message }, { status: 502 })
    }
  }

  if (action === 'status') {
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(jobId)) {
      return Response.json({ error: 'A valid jobId is required' }, { status: 400 })
    }

    try {
      return Response.json(await checkHeyGenStatus(jobId))
    } catch (err) {
      return Response.json({ error: safeUpstreamError(err, 'HeyGen') }, { status: 502 })
    }
  }

  return Response.json({ error: 'action must be "generate" or "status"' }, { status: 400 })
}
