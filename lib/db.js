import { Pool } from 'pg'

/**
 * Durable record of what people generate, so the prompts do not vanish with the
 * serverless instance the way the in-memory analytics store does.
 *
 * Deliberately plain postgres:// over the standard driver rather than a vendor
 * SDK. The same code runs against a self-hosted box, a local Docker container,
 * or a managed instance — the data stays wherever DATABASE_URL points, which is
 * the point.
 *
 * THE KEY IS NEVER STORED. recordGeneration() takes an explicit field list with
 * no parameter for it, so there is no path from a caller's API key to a row.
 * Only key_source ('user' or 'server') is kept, which says who paid without
 * saying what with.
 */

const CONNECT_TIMEOUT_MS = 5000
const STATEMENT_TIMEOUT_MS = 5000

let pool = null
let schemaReady = null

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

function getPool() {
  if (!dbConfigured()) return null
  if (pool) return pool

  const url = process.env.DATABASE_URL

  // Self-hosted Postgres usually presents a self-signed cert. Verify it only
  // when the operator says the chain is real, otherwise TLS still encrypts the
  // connection but does not reject the certificate.
  const wantsSsl = /sslmode=(require|verify-ca|verify-full)/.test(url) || process.env.DATABASE_SSL === 'true'
  const strict = process.env.DATABASE_SSL_STRICT === 'true'

  pool = new Pool({
    connectionString: url,
    ssl: wantsSsl ? { rejectUnauthorized: strict } : false,
    // One connection per serverless instance. Vercel runs many instances
    // concurrently and each gets its own pool, so anything larger exhausts
    // max_connections on a modest box. Put pgbouncer in front before raising it.
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS
  })

  // A dead database must never take the app down with it.
  pool.on('error', err => console.error('[db] idle client error:', err.message))

  return pool
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS generations (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    mode          TEXT        NOT NULL,
    prompt        TEXT        NOT NULL,
    niche         TEXT,
    intent        TEXT,
    audience      TEXT,
    context       TEXT,
    key_source    TEXT        NOT NULL,
    model         TEXT,
    prompt_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens  INTEGER,
    variations    INTEGER,
    ok            BOOLEAN     NOT NULL,
    error_code    TEXT,
    duration_ms   INTEGER,
    response      JSONB
  );
  CREATE INDEX IF NOT EXISTS generations_created_at_idx ON generations (created_at DESC);
`

/** Idempotent, and run at most once per process. */
function ensureSchema(client) {
  if (!schemaReady) {
    schemaReady = client.query(SCHEMA).catch(err => {
      schemaReady = null // let the next request retry
      throw err
    })
  }
  return schemaReady
}

const clip = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const int = v => (Number.isFinite(v) ? Math.trunc(v) : null)

/**
 * Write one row. Never throws and never blocks the caller's response — a
 * logging failure must not cost someone the content they just paid Gemini for.
 *
 * Note the parameter list: there is no apiKey field, by design.
 */
export async function recordGeneration({
  mode,
  prompt,
  personalization = {},
  keySource,
  model,
  usage = {},
  variations,
  ok,
  errorCode,
  durationMs,
  response
}) {
  const p = getPool()
  if (!p) return

  try {
    const client = await p.connect()
    try {
      await ensureSchema(client)
      await client.query(
        `INSERT INTO generations
           (mode, prompt, niche, intent, audience, context, key_source, model,
            prompt_tokens, output_tokens, total_tokens, variations, ok,
            error_code, duration_ms, response)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          clip(mode, 20) || 'basic',
          clip(prompt, 8000) || '',
          clip(personalization.niche, 200),
          clip(personalization.intent, 200),
          clip(personalization.audience, 200),
          clip(personalization.context, 600),
          clip(keySource, 20) || 'none',
          clip(model, 100),
          int(usage.promptTokenCount),
          int(usage.candidatesTokenCount),
          int(usage.totalTokenCount),
          int(variations),
          Boolean(ok),
          clip(errorCode, 60),
          int(durationMs),
          // Storing the generated text is opt-out: it is the operator's own
          // database, but it is also the largest column by far.
          process.env.STORE_RESPONSES === 'false' || !response ? null : JSON.stringify(response)
        ]
      )
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[db] recordGeneration failed:', err.message)
  }
}

/** Rows for the operator dashboard, newest first. */
export async function recentGenerations({ limit = 50, offset = 0 } = {}) {
  const p = getPool()
  if (!p) return { rows: [], total: 0 }

  const client = await p.connect()
  try {
    await ensureSchema(client)
    const rows = await client.query(
      `SELECT id, created_at, mode, prompt, niche, intent, audience, context,
              key_source, model, prompt_tokens, output_tokens, total_tokens,
              variations, ok, error_code, duration_ms
         FROM generations
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)]
    )
    const totals = await client.query(
      `SELECT count(*)::int                                AS total,
              coalesce(sum(total_tokens), 0)::int          AS tokens,
              count(*) FILTER (WHERE ok)::int              AS succeeded,
              count(*) FILTER (WHERE NOT ok)::int          AS failed,
              count(*) FILTER (WHERE key_source = 'user')::int   AS on_user_key,
              count(*) FILTER (WHERE key_source = 'server')::int AS on_server_key
         FROM generations`
    )
    return { rows: rows.rows, totals: totals.rows[0] }
  } finally {
    client.release()
  }
}
