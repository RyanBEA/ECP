// Postgres access for print telemetry. All DB code lives here so
// server/index.js stays thin. Designed to degrade gracefully when
// DATABASE_URL is not configured (dev / smoke tests without a DB).

import pg from 'pg'

const { Pool } = pg

let pool = null

function isLocalConnectionString(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export function isConfigured() {
  return !!process.env.DATABASE_URL
}

export async function initDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    return null
  }

  const useSsl = process.env.PGSSLMODE !== 'disable' && !isLocalConnectionString(connectionString)

  const candidate = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  })
  candidate.on('error', () => {}) // idle-client errors must not crash the process

  try {
    await candidate.query(`
    CREATE TABLE IF NOT EXISTS print_events (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      app_version TEXT NOT NULL,
      session_id TEXT NOT NULL,
      tier SMALLINT NOT NULL,
      target_points NUMERIC(5,1) NOT NULL,
      total_points NUMERIC(5,1) NOT NULL,
      met BOOLEAN NOT NULL,
      selections JSONB NOT NULL,
      wall JSONB
    );
  `)
    // Added for the below-grade (foundation) wall builder; safe on existing tables.
    await candidate.query(`
      ALTER TABLE print_events ADD COLUMN IF NOT EXISTS below_grade JSONB;
    `)
    await candidate.query(`
      CREATE INDEX IF NOT EXISTS print_events_created_at_idx ON print_events (created_at);
    `)
  } catch (err) {
    await candidate.end().catch(() => {})
    throw err
  }

  pool = candidate
  return pool
}

export async function insertEvent(event) {
  if (!pool) throw new Error('database not configured')
  await pool.query(
    `INSERT INTO print_events
      (app_version, session_id, tier, target_points, total_points, met, selections, wall, below_grade)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      event.appVersion,
      event.sessionId,
      event.tier,
      event.targetPoints,
      event.totalPoints,
      event.met,
      JSON.stringify(event.selections),
      event.wall === null ? null : JSON.stringify(event.wall),
      event.belowGrade == null ? null : JSON.stringify(event.belowGrade),
    ]
  )
}

// Streams rows ordered oldest-first via a callback per row, to avoid
// buffering the whole table in memory for large exports.
export async function streamEvents(onRow) {
  if (!pool) throw new Error('database not configured')
  const client = await pool.connect()
  try {
    const cursorName = 'print_events_export'
    await client.query('BEGIN')
    await client.query(
      `DECLARE ${cursorName} CURSOR FOR
        SELECT id, created_at, app_version, session_id, tier, target_points, total_points, met, selections, wall, below_grade
        FROM print_events ORDER BY created_at ASC`
    )
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await client.query(`FETCH 500 FROM ${cursorName}`)
      if (result.rows.length === 0) break
      for (const row of result.rows) {
        onRow(row)
      }
      if (result.rows.length < 500) break
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function ping() {
  if (!pool) return false
  try {
    await pool.query('SELECT 1')
    return true
  } catch {
    return false
  }
}
