import { isGatedMember } from '../../../lib/security'
import { recentGenerations, dbConfigured } from '../../../lib/db'

/**
 * Operator view of what people have been generating.
 *
 * This endpoint hands back other people's prompts, so it fails CLOSED: it needs
 * isGatedMember(), which is false whenever CMS_ACCESS_CODE is unset. An
 * unconfigured instance therefore exposes nothing rather than everything —
 * the opposite of how the Gemini key behaved before today.
 */
export async function GET(request) {
  if (!isGatedMember(request)) {
    return Response.json(
      { error: 'This view is private. Enter the access code to continue.', code: 'locked' },
      { status: 401 }
    )
  }

  if (!dbConfigured()) {
    return Response.json(
      { error: 'No database configured. Set DATABASE_URL to start keeping records.', code: 'no_db' },
      { status: 503 }
    )
  }

  const url = new URL(request.url)
  const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10)
  const offset = Number.parseInt(url.searchParams.get('offset') || '0', 10)

  try {
    const { rows, totals } = await recentGenerations({
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0
    })
    return Response.json({ rows, totals })
  } catch (err) {
    console.error('[generations]', err.message)
    return Response.json({ error: 'Could not read the record store.' }, { status: 502 })
  }
}
