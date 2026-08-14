// Simple in-memory analytics store (for Vercel, use a database in production)
let analyticsStore = {
  events: [],
  creators: 0,
  voiceClones: 0,
  avatarsGenerated: 0,
  contentGenerated: 0,
  published: 0,
  errors: 0
}

export function trackEvent(event) {
  analyticsStore.events.push({
    ...event,
    timestamp: new Date().toISOString()
  })

  // Update counters
  if (event.type === 'creator_created') analyticsStore.creators++
  if (event.type === 'voice_cloned') analyticsStore.voiceClones++
  if (event.type === 'avatar_generated') analyticsStore.avatarsGenerated++
  if (event.type === 'content_generated') analyticsStore.contentGenerated++
  if (event.type === 'published') analyticsStore.published++
  if (event.status === 'error') analyticsStore.errors++

  return event
}

export function getAnalytics() {
  const totalEvents = analyticsStore.events.length
  const successRate = totalEvents > 0 ? ((totalEvents - analyticsStore.errors) / totalEvents * 100).toFixed(1) : 0

  const avgGenerationTime = analyticsStore.events
    .filter(e => e.generationTime)
    .reduce((sum, e) => sum + e.generationTime, 0) /
    (analyticsStore.events.filter(e => e.generationTime).length || 1)

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
    avgGenerationTime: isFinite(avgGenerationTime) ? Math.round(avgGenerationTime) : 0,
    recentEvents: analyticsStore.events.slice(-20).reverse()
  }
}

export function clearAnalytics() {
  analyticsStore = {
    events: [],
    creators: 0,
    voiceClones: 0,
    avatarsGenerated: 0,
    contentGenerated: 0,
    published: 0,
    errors: 0
  }
}
