import { templateContent } from '../../../lib/content-template'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nepaliStatus: { type: 'STRING' },
    englishVideo: { type: 'STRING' },
    englishStatus: { type: 'STRING' },
    nepaliVideo: { type: 'STRING' },
    imagePrompt: { type: 'STRING' },
    veoPrompt: { type: 'STRING' }
  },
  required: ['nepaliStatus', 'englishVideo', 'englishStatus', 'nepaliVideo', 'imagePrompt', 'veoPrompt']
}

function buildPrompt(persona) {
  return `You are the ghostwriter for SochGuru, a content creator based in Hadigaun, Kathmandu, who writes bilingual (Nepali + English) posts about their journey from a decade in banking into Agentic AI. Voice: honest, "building in public", no false expertise, short punchy lines, "Discipline > Motivation" energy.

Creator persona:
- Name: ${persona.name || 'SochGuru'}
- Niche: ${persona.niche}
- Audience: ${persona.audience}
- Story: ${persona.story}

Generate one day's bilingual content pack as JSON with exactly these fields:
- nepaliStatus: a short Facebook status in Romanized Nepali (max ~280 chars), ends with #SochGuru #NepaliSoch
- englishVideo: an English 30s video script with [HOOK 0-3s], [MAIN 3-20s], [CTA] sections, grounded in the story above
- englishStatus: an English "Building in Public" Facebook status, ends with #SochGuru #BuildingInPublic
- nepaliVideo: a Romanized Nepali video script with [HOOK], [MAIN], [CTA] sections
- imagePrompt: an image-generation prompt for a consistent 3D "circuit-brain" avatar (curly hair, navy hoodie with a glowing circuit-brain logo, Pixar style, Hadigaun Kathmandu vibe) reflecting today's niche
- veoPrompt: an 8s cinematic video-generation prompt for the same avatar speaking, 9:16 vertical

Return only the JSON object.`
}

async function callGemini(persona) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_CMS
  if (!apiKey) return null

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(persona) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.9
        }
      })
    }
  )

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
  const persona = body?.persona
  if (!persona) {
    return Response.json({ error: 'persona is required' }, { status: 400 })
  }

  try {
    const generated = await callGemini(persona)
    if (generated) {
      return Response.json({ ...generated, source: 'gemini' })
    }
  } catch (err) {
    console.error('Gemini generation failed, falling back to template:', err.message)
    return Response.json({ ...templateContent(persona), source: 'template', error: err.message })
  }

  return Response.json({ ...templateContent(persona), source: 'template' })
}
