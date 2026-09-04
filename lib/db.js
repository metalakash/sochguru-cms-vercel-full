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
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)
}

function getPool() {
  if (!dbConfigured()) return null
  if (pool) return pool

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL

  // Self-hosted Postgres usually presents a self-signed cert. Verify it only
  // when the operator says the chain is real, otherwise TLS still encrypts the
  // connection but does not reject the certificate.
  const isSupabase = /supabase/.test(url)
  const wantsSsl = /sslmode=(require|verify-ca|verify-full)/.test(url) || process.env.DATABASE_SSL === 'true' || isSupabase
  const strict = process.env.DATABASE_SSL_STRICT === 'true'

  pool = new Pool({
    connectionString: url,
    ssl: wantsSsl ? { rejectUnauthorized: isSupabase ? false : strict } : false,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS
  })

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

function ensureSchema(client) {
  if (!schemaReady) {
    schemaReady = client.query(SCHEMA).catch(err => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

const clip = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const int = v => (Number.isFinite(v) ? Math.trunc(v) : null)

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

export async function recentGenerations({ limit = 50, offset = 0 } = {}) {
  const p = getPool()
  if (!p) return { rows: [], total: 0 }

  try {
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
  } catch (err) {
    console.error('[db] recentGenerations failed:', err.message, err.code)
    throw err
  }
}
