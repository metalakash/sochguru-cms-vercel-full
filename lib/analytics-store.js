// Simple in-memory analytics store (for Vercel, use a database in production).
// Serverless instances are ephemeral, so these numbers reflect one instance's
// lifetime rather than an all-time total.

const MAX_EVENTS = 500
const MAX_STRING = 300

const emptyStore = () => ({
  events: [],
  creators: 0,
  voiceClones: 0,
  avatarsGenerated: 0,
  contentGenerated: 0,
  published: 0,
  errors: 0
})

let analyticsStore = emptyStore()

const ALLOWED_TYPES = new Set([
  'creator_created',
  'voice_cloned',
  'avatar_generated',
  'content_generated',
  'published',
  'basic_pack_generated',
  'basic_pack_exported',
  'variation_switched'
])

const clip = value => {
  if (typeof value === 'string') return value.slice(0, MAX_STRING)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value
  return undefined
}

/**
 * Only known keys are kept. The previous version spread the caller's object
 * wholesale, which let any client write arbitrary payloads into the store and
 * read them straight back out of /report.
 */
function sanitize(event) {
  const out = { type: event.type }
  for (const key of ['status', 'source', 'error', 'name', 'niche', 'sampleCount', 'postsCount', 'generationTime', 'format', 'angle', 'index', 'variations', 'personalized']) {
    const value = clip(event[key])
    if (value !== undefined) out[key] = value
  }
  return out
}

export function isKnownEventType(type) {
  return typeof type === 'string' && ALLOWED_TYPES.has(type)
}

export function trackEvent(event) {
  const clean = sanitize(event)
  clean.timestamp = new Date().toISOString()

  analyticsStore.events.push(clean)
  // Ring-buffer the history so a long-lived instance cannot grow without bound.
  if (analyticsStore.events.length > MAX_EVENTS) {
    analyticsStore.events.splice(0, analyticsStore.events.length - MAX_EVENTS)
  }

  if (clean.type === 'creator_created') analyticsStore.creators++
  if (clean.type === 'voice_cloned') analyticsStore.voiceClones++
  if (clean.type === 'avatar_generated') analyticsStore.avatarsGenerated++
  // Basic mode is the primary flow, so its packs count toward the content total
  // too — otherwise the Activity panel reads zero for a busy instance.
  if (clean.type === 'content_generated' || clean.type === 'basic_pack_generated') analyticsStore.contentGenerated++
  if (clean.type === 'published') analyticsStore.published++
  if (clean.status === 'error') analyticsStore.errors++

  return clean
}

export function getAnalytics() {
  const totalEvents = analyticsStore.events.length
  const successRate = totalEvents > 0
    ? ((totalEvents - analyticsStore.errors) / totalEvents * 100).toFixed(1)
    : 0

  const timed = analyticsStore.events.filter(e => typeof e.generationTime === 'number')
  const avgGenerationTime = timed.length
    ? timed.reduce((sum, e) => sum + e.generationTime, 0) / timed.length
    : 0

  return {
    summary: {
      totalEvents,
      creators: analyticsStore.creators,
      voiceClones: analyticsStore.voiceClones,
      avatarsGenerated: analyticsStore.avatarsGenerated,
      contentGenerated: analyticsStore.contentGenerated,
      published: analyticsStore.published,
      errors: analyticsStore.errors,
      successRate: parseFloat(successRate)
    },
    avgGenerationTime: Math.round(avgGenerationTime),
    recentEvents: analyticsStore.events.slice(-20).reverse()
  }
}

export function clearAnalytics() {
  analyticsStore = emptyStore()
}
