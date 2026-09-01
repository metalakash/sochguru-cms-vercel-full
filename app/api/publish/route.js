import { guard, safeUpstreamError } from '../../../lib/security'

const GRAPH_VERSION = 'v26.0'
const MAX_MESSAGE_CHARS = 5000

async function publishToFacebookPage(pageId, accessToken, message) {
  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, access_token: accessToken })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API ${res.status}: ${err.slice(0, 200)}`)
  }
  return res.json()
}

/**
 * Which page gets posted to is a server decision. META_PAGE_ID wins whenever it
 * is set, so a caller cannot aim the server's token at any other page the token
 * happens to control. The request value is only a fallback for local setups.
 */
function resolvePageId(requested) {
  const pinned = (process.env.META_PAGE_ID || '').trim()
  if (pinned) return { pageId: pinned, pinned: true }

  const candidate = typeof requested === 'string' ? requested.trim() : ''
  if (!/^\d{5,25}$/.test(candidate)) return { error: 'A numeric Facebook Page ID is required' }
  return { pageId: candidate, pinned: false }
}

function validMessage(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_MESSAGE_CHARS
}

export async function POST(request) {
  const { body, response } = await guard(request, {
    name: 'publish',
    limit: 5,
    windowMs: 10 * 60 * 1000,
    maxBytes: 64 * 1024
  })
  if (response) return response

  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return Response.json({ error: 'META_ACCESS_TOKEN not configured' }, { status: 503 })
  }

  const { pageId, error: pageError } = resolvePageId(body.pageId)
  if (pageError) return Response.json({ error: pageError }, { status: 400 })

  const content = body.content
  if (!content || typeof content !== 'object') {
    return Response.json({ error: 'content is required' }, { status: 400 })
  }

  const posts = [
    { message: content.englishStatus, type: 'english-status' },
    { message: content.nepaliStatus, type: 'nepali-status' }
  ].filter(p => validMessage(p.message))

  if (posts.length === 0) {
    return Response.json({ error: 'content must include a non-empty englishStatus or nepaliStatus' }, { status: 400 })
  }

  const results = []
  for (const post of posts) {
    try {
      const res = await publishToFacebookPage(pageId, token, post.message.trim())
      results.push({ type: post.type, id: res.id, status: 'published' })
    } catch (err) {
      results.push({ type: post.type, status: 'failed', error: safeUpstreamError(err, 'Meta') })
    }
  }

  const allSuccess = results.every(r => r.status === 'published')
  return Response.json(
    { results, pageId, status: allSuccess ? 'success' : 'partial' },
    { status: allSuccess ? 200 : 207 }
  )
}
