import { ACCESS_COOKIE, accessToken, gateEnabled, isAuthorized, safeEqual, rateLimit, readJson, HttpError, sameOrigin, serverKeyAvailable } from '../../../lib/security'
import { dbConfigured } from '../../../lib/db'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function cookieHeader(value, maxAge) {
  const parts = [
    `${ACCESS_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

/** Lets the client decide between the lock screen and the app, without leaking the code. */
export async function GET(request) {
  return Response.json({
    gateEnabled: gateEnabled(),
    authorized: isAuthorized(request),
    // Tells a gate member they can skip the key form because the operator's
    // key will cover them. False for everyone else, so anonymous visitors are
    // still asked for their own.
    serverKeyAvailable: serverKeyAvailable(request),
    // Whether this instance actually keeps records. The page promises people
    // their prompts are stored, and that promise has to track reality — an
    // instance with no DATABASE_URL keeps nothing and must not claim otherwise.
    recordsKept: dbConfigured()
  })
}

export async function POST(request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 })
  }

  if (!gateEnabled()) {
    return Response.json({ authorized: true, gateEnabled: false })
  }

  // Deliberately tight: this is the one endpoint worth brute-forcing.
  const rl = rateLimit(request, 'access', { limit: 8, windowMs: 10 * 60 * 1000 })
  if (!rl.ok) {
    return Response.json(
      { error: `Too many attempts. Try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  let body
  try {
    body = await readJson(request, 2 * 1024)
  } catch (err) {
    return Response.json({ error: err.message }, { status: err instanceof HttpError ? err.status : 400 })
  }

  const supplied = typeof body.code === 'string' ? body.code : ''
  const expected = process.env.CMS_ACCESS_CODE || ''

  if (!safeEqual(supplied, expected)) {
    return Response.json({ error: 'That code did not match.' }, { status: 401 })
  }

  return Response.json(
    { authorized: true, gateEnabled: true },
    { headers: { 'Set-Cookie': cookieHeader(accessToken(), COOKIE_MAX_AGE) } }
  )
}

/** Sign out — clears the cookie. */
export async function DELETE(request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 })
  }
  return Response.json({ authorized: false }, { headers: { 'Set-Cookie': cookieHeader('', 0) } })
}
