const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    persona: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        niche: { type: 'STRING' },
        story: { type: 'STRING' },
        audience: { type: 'STRING' }
      }
    },
    englishStatus: { type: 'STRING' },
    nepaliStatus: { type: 'STRING' },
    englishVideo: { type: 'STRING' },
    nepaliVideo: { type: 'STRING' },
    imagePrompt: { type: 'STRING' },
    veoPrompt: { type: 'STRING' }
  },
  required: ['persona', 'englishStatus', 'nepaliStatus', 'englishVideo', 'nepaliVideo', 'imagePrompt', 'veoPrompt']
}

function buildPrompt(userPrompt) {
  return `You are a bilingual content strategist for creators in Nepal and globally. Based on the creator's description below, generate a complete content pack.

Creator description: ${userPrompt}

Create a JSON response with:
1. persona: Extract/infer name, niche, story, and audience (who they serve)
2. englishStatus: Short English Facebook post (180 chars)
3. nepaliStatus: Short Nepali Facebook post (180 chars, Romanized)
4. englishVideo: 30-second English script with [HOOK], [MAIN], [CTA]
5. nepaliVideo: 30-second Nepali script (Romanized) with same structure
6. imagePrompt: Detailed image generation prompt for avatar (Pixar 3D style, Hadigaun Kathmandu vibe)
7. veoPrompt: 8-second vertical video prompt for avatar speaking both languages

Use authentic Nepali terms and cultural references. Make content "building in public" style - honest, vulnerable, educational.

Return only the JSON object.`
}

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_CMS
}

async function requestGemini(apiKey, userPrompt) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(userPrompt) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.9
        }
      })
    }
  )
}

async function callGemini(userPrompt) {
  const apiKey = getApiKey()
  if (!apiKey) return null

  let res = await requestGemini(apiKey, userPrompt)
  if (res.status === 503) {
    await new Promise(r => setTimeout(r, 1200))
    res = await requestGemini(apiKey, userPrompt)
  }

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text)
}

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const { prompt } = body

  if (!prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400 })
  }

  if (!getApiKey()) {
    return Response.json({
      error: 'No Gemini API key on the server. Add GEMINI_API_KEY in Vercel → Settings → Environment Variables, then redeploy.'
    }, { status: 503 })
  }

  try {
    const generated = await callGemini(prompt)
    return Response.json({ ...generated, source: 'gemini' })
  } catch (err) {
    console.error('Gemini generation failed:', err.message)
    return Response.json({ error: err.message }, { status: 502 })
  }
}
