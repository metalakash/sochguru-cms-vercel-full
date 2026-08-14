import { trackEvent, getAnalytics, clearAnalytics } from '../../../lib/analytics-store'

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const { action, event } = body

  if (action === 'track') {
    if (!event || !event.type) {
      return Response.json({ error: 'event with type is required' }, { status: 400 })
    }
    const tracked = trackEvent(event)
    return Response.json({ success: true, event: tracked })
  }

  if (action === 'report') {
    const analytics = getAnalytics()
    return Response.json(analytics)
  }

  if (action === 'clear') {
    clearAnalytics()
    return Response.json({ success: true, message: 'Analytics cleared' })
  }

  return Response.json({ error: 'action must be "track", "report", or "clear"' }, { status: 400 })
}

export async function GET(request) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action') || 'report'

  if (action === 'report') {
    const analytics = getAnalytics()
    return Response.json(analytics)
  }

  if (action === 'clear') {
    clearAnalytics()
    return Response.json({ success: true, message: 'Analytics cleared' })
  }

  return Response.json({ error: 'action must be "report" or "clear"' }, { status: 400 })
}
