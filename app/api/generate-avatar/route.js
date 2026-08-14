const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY
const HEYGEN_BASE = 'https://api.heygen.com/v1'

async function createHeyGenVideo(script, imageUrl, voiceId) {
  if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured')

  const payload = {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: 'Wayne_20240711', // Default HeyGen avatar
          ...(imageUrl && { image_url: imageUrl })
        },
        voice: {
          type: 'elevenlabs',
          ...(voiceId ? { voice_id: voiceId } : { voice_id: 'default' }),
          input_text: script
        }
      }
    ],
    aspect_ratio: '9:16', // Vertical for social media
    output_format: 'mp4'
  }

  const res = await fetch(`${HEYGEN_BASE}/video_sessions`, {
    method: 'POST',
    headers: {
      'X-CUSTOM-HEADER': HEYGEN_API_KEY,
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
    jobId: data.data?.video_session_id,
    status: 'pending',
    videoUrl: null
  }
}

async function checkHeyGenStatus(jobId) {
  if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured')

  const res = await fetch(`${HEYGEN_BASE}/video_sessions/${jobId}`, {
    headers: {
      'X-CUSTOM-HEADER': HEYGEN_API_KEY
    }
  })

  if (!res.ok) {
    throw new Error(`HeyGen status check failed: ${res.status}`)
  }

  const data = await res.json()
  const status = data.data?.status
  const videoUrl = data.data?.video_url

  return {
    jobId,
    status,
    videoUrl: status === 'completed' ? videoUrl : null
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const { action, script, imageUrl, voiceId, jobId } = body

  if (action === 'generate') {
    if (!script) {
      return Response.json({ error: 'script is required' }, { status: 400 })
    }

    if (!HEYGEN_API_KEY) {
      return Response.json(
        { error: 'Avatar generation not configured. Set HEYGEN_API_KEY in environment.' },
        { status: 500 }
      )
    }

    try {
      const result = await createHeyGenVideo(script, imageUrl, voiceId)
      return Response.json({
        ...result,
        message: 'Video generation started. Check status with jobId.'
      })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }

  if (action === 'status') {
    if (!jobId) {
      return Response.json({ error: 'jobId is required' }, { status: 400 })
    }

    try {
      const result = await checkHeyGenStatus(jobId)
      return Response.json(result)
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }

  return Response.json({ error: 'action must be "generate" or "status"' }, { status: 400 })
}
