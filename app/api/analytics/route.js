import { trackEvent, getAnalytics, clearAnalytics, isKnownEventType } from '../../../lib/analytics-store'
import { guard, isAuthorized } from '../../../lib/security'

export async function POST(request) {
  const { body, response } = await guard(request, {
    name: 'analytics',
    limit: 60,
    windowMs: 60 * 1000,
    maxBytes: 8 * 1024
  })
  if (response) return response

  const { action, event } = body

  if (action === 'track') {
    if (!event || typeof event !== 'object' || !isKnownEventType(event.type)) {
      return Response.json({ error: 'event.type must be a known event name' }, { status: 400 })
    }
    return Response.json({ success: true, event: trackEvent(event) })
  }

  if (action === 'report') {
    return Response.json(getAnalytics())
  }

  if (action === 'clear') {
    clearAnalytics()
    return Response.json({ success: true, message: 'Analytics cleared' })
  }

  return Response.json({ error: 'action must be "track", "report", or "clear"' }, { status: 400 })
}

/**
 * Read-only. Clearing used to be reachable here via ?action=clear, which made a
 * destructive action available to any GET — including one triggered by an
 * <img> tag on another site. Clearing is POST-only now.
 */
export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'This instance is private.', code: 'locked' }, { status: 401 })
  }
  return Response.json(getAnalytics())
}
