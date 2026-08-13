async function publishToMeta(pageId, accessToken, post) {
  const endpoint = `https://graph.instagram.com/v18.0/${pageId}/media`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      caption: post.caption,
      access_token: accessToken,
      ...(post.videoUrl && { media_type: 'VIDEO', video_url: post.videoUrl }),
      ...(!post.videoUrl && { media_type: 'IMAGE', image_url: post.imageUrl })
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API ${res.status}: ${err.slice(0, 200)}`)
  }
  return res.json()
}

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const { pageId, content } = body

  if (!pageId || !content) {
    return Response.json({ error: 'pageId and content are required' }, { status: 400 })
  }

  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return Response.json({ error: 'META_ACCESS_TOKEN not configured' }, { status: 500 })
  }

  try {
    const posts = [
      { caption: content.englishStatus, imageUrl: null, type: 'english-status' },
      { caption: content.nepaliStatus, imageUrl: null, type: 'nepali-status' }
    ]

    const results = []
    for (const post of posts) {
      try {
        const res = await publishToMeta(pageId, token, post)
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
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
