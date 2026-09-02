import crypto from 'crypto'

export const ACCESS_COOKIE = 'soch_access'

/**
 * The whole gate is opt-in: with no CMS_ACCESS_CODE set the app stays open so
 * local dev needs no ceremony. Set it in Vercel and every route below locks.
 */
function accessCode() {
  return process.env.CMS_ACCESS_CODE || ''
}

export function gateEnabled() {
  return accessCode().length > 0
}

/** Cookie value we hand out — a hash, so the raw code never sits in the browser. */
export function accessToken() {
  const code = accessCode()
  if (!code) return ''
  return crypto.createHash('sha256').update(`sochguru:${code}`).digest('hex')
}

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''))
  const bb = Buffer.from(String(b || ''))
  if (ab.length !== bb.length || ab.length === 0) return false
  return crypto.timingSafeEqual(ab, bb)
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim()
  }
  return ''
}

export function isAuthorized(request) {
  if (!gateEnabled()) return true
  return safeEqual(readCookie(request, ACCESS_COOKIE), accessToken())
}

/**
 * Cross-origin POSTs are rejected outright. Browsers always send Origin on
 * cross-site POST, so this is a cheap CSRF backstop that costs same-origin
 * callers nothing.
 */
export function sameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true // same-origin navigations and server-to-server calls
  const host = request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || ''
  return fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local'
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

const buckets = new Map()

/**
 * Fixed-window counter. Per-instance only — serverless spreads traffic across
 * instances, so treat this as a brake on casual abuse, not a hard quota. Move
 * to Vercel KV / Upstash if this ever needs to be authoritative.
 */
export function rateLimit(request, name, { limit, windowMs }) {
  const key = `${name}:${clientIp(request)}`
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }

  entry.count++
  if (entry.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { ok: true, remaining: limit - entry.count, retryAfter: 0 }
}

// Keep the Map from growing without bound on a long-lived instance.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) if (now > entry.resetAt) buckets.delete(key)
}, 60_000).unref?.()

/* ------------------------------------------------------------------ */
/* Request parsing                                                     */
/* ------------------------------------------------------------------ */

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * Parse a JSON body with a hard byte ceiling. Without this, /api/clone-voice
 * happily buffers an arbitrarily large base64 payload straight into memory.
 */
export async function readJson(request, maxBytes = 64 * 1024) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maxBytes) {
    throw new HttpError(413, `Request body too large (limit ${Math.floor(maxBytes / 1024)} KB)`)
  }

  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new HttpError(413, `Request body too large (limit ${Math.floor(maxBytes / 1024)} KB)`)
  }
  if (!raw) throw new HttpError(400, 'Request body is required')

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'Request body must be a JSON object')
    }
    return parsed
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpError(400, 'Request body is not valid JSON')
  }
}

/**
 * One wrapper for the checks every mutating route needs, in order:
 * same-origin -> access gate -> rate limit -> size-capped JSON parse.
 * Returns { body } on success or { response } to return immediately.
 */
export async function guard(request, { name, limit, windowMs, maxBytes }) {
  if (!sameOrigin(request)) {
    return { response: Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 }) }
  }

  if (!isAuthorized(request)) {
    return { response: Response.json({ error: 'This instance is private. Enter the access code to continue.', code: 'locked' }, { status: 401 }) }
  }

  const rl = rateLimit(request, name, { limit, windowMs })
  if (!rl.ok) {
    return {
      response: Response.json(
        { error: `Too many requests. Try again in ${rl.retryAfter}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }
  }

  try {
    return { body: await readJson(request, maxBytes) }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400
    return { response: Response.json({ error: err.message }, { status }) }
  }
}

/**
 * Upstream provider errors often carry project ids, quota details and internal
 * hostnames. Log the full text, hand the caller something safe.
 */
export function safeUpstreamError(err, label) {
  console.error(`[${label}]`, err?.message || err)
  const msg = String(err?.message || '')
  if (/not configured/i.test(msg)) return msg          // our own config hints are safe
  if (/\b429\b|quota|rate limit/i.test(msg)) return `${label} quota reached. Try again shortly.`
  if (/\b401\b|\b403\b|api key|unauthor/i.test(msg)) return `${label} rejected the server credentials. Check the key in your environment.`
  if (/\b5\d\d\b|unavailable|overloaded/i.test(msg)) return `${label} is temporarily unavailable. Try again in a moment.`
  return `${label} request failed. Check the server logs for details.`
}

/**
 * The caller's own Gemini key, sent per request in a header and never stored.
 *
 * There is deliberately no process.env fallback. A server key reachable from an
 * unauthenticated route would be spent by anonymous callers the moment one is
 * added — this app already shipped that open endpoint once. Pro will supply its
 * key through an authenticated path, not through this function.
 *
 * The header keeps the key out of the request body, so it never reaches the
 * JSON logs or the analytics store.
 */
export function userApiKey(request) {
  const raw = request.headers.get('x-gemini-key')
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * Shape check only. Key formats vary by issuer (AIza… from AI Studio, AQ.… from
 * newer consoles), so anything stricter would reject valid keys.
 */
export function keyLooksValid(key) {
  return key.length >= 20 && key.length <= 200 && !/\s/.test(key)
}

/** True when Gemini rejected the caller's key rather than failing upstream. */
export function isKeyRejection(err) {
  return /\b400\b|\b401\b|\b403\b|api.?key|unauthor|permission.?denied/i.test(String(err?.message || ''))
}
