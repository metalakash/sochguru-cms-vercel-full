const GRAPH_VERSION = 'v26.0'

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

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const { pageId, content } = body || {}

  if (!pageId || !content) {
    return Response.json({ error: 'pageId and content are required' }, { status: 400 })
  }

  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return Response.json({ error: 'META_ACCESS_TOKEN not configured' }, { status: 503 })
  }

  const posts = [
    { message: content.englishStatus, type: 'english-status' },
    { message: content.nepaliStatus, type: 'nepali-status' }
  ]

  const results = []
  for (const post of posts) {
    try {
      const res = await publishToFacebookPage(pageId, token, post.message)
      results.push({ type: post.type, id: res.id, status: 'published' })
    } catch (err) {
      results.push({ type: post.type, status: 'failed', error: err.message })
    }
  }

  const allSuccess = results.every(r => r.status === 'published')
  return Response.json(
    { results, status: allSuccess ? 'success' : 'partial' },
    { status: allSuccess ? 200 : 207 }
  )
}
