import express from 'express'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateEvent } from './validate.js'
import { initDb, isConfigured, insertEvent, streamEvents, ping } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.join(__dirname, '..', 'dist')

const PORT = process.env.PORT || 3000
const EVENTS_EXPORT_KEY = process.env.EVENTS_EXPORT_KEY || ''

const app = express()
// Railway terminates TLS and proxies to us; trust one hop so req.ip is the
// client address (used only for in-memory rate limiting, never stored).
app.set('trust proxy', 1)
app.use(express.json({ limit: '16kb' }))

// --- Simple in-memory rate limit: max 60 POSTs per IP per minute. ---
// IPs are never persisted; the map only lives in process memory and is
// pruned continuously.
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 60
const rateLimitMap = new Map() // ip -> { count, windowStart }

function pruneRateLimitMap(now) {
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip)
    }
  }
}

function isRateLimited(ip) {
  const now = Date.now()
  pruneRateLimitMap(now)
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

function timingSafeEqualStrings(a, b) {
  const digestA = crypto.createHash('sha256').update(String(a)).digest()
  const digestB = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(digestA, digestB)
}

function csvField(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

app.post('/api/events', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'rate limited' })
    return
  }

  if (!isConfigured()) {
    res.status(503).json({ error: 'database not configured' })
    return
  }

  const result = validateEvent(req.body)
  if (!result.ok) {
    res.status(400).json({ error: result.error })
    return
  }

  try {
    await insertEvent(result.event)
    res.status(204).end()
  } catch {
    // Never log request bodies or IPs.
    res.status(503).json({ error: 'database unavailable' })
  }
})

app.get('/api/events.csv', async (req, res) => {
  if (!EVENTS_EXPORT_KEY) {
    res.status(503).json({ error: 'export not configured' })
    return
  }

  const authHeader = req.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  const providedKey = match ? match[1] : ''

  if (!providedKey || !timingSafeEqualStrings(providedKey, EVENTS_EXPORT_KEY)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  if (!isConfigured()) {
    res.status(503).json({ error: 'database not configured' })
    return
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="ecp-events.csv"')
  res.write('id,created_at,app_version,session_id,tier,target_points,total_points,met,selections_json,wall_json,below_grade_json\n')

  try {
    await streamEvents(row => {
      const line = [
        csvField(row.id),
        csvField(row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at),
        csvField(row.app_version),
        csvField(row.session_id),
        csvField(row.tier),
        csvField(row.target_points),
        csvField(row.total_points),
        csvField(row.met),
        csvField(JSON.stringify(row.selections)),
        csvField(row.wall === null ? '' : JSON.stringify(row.wall)),
        csvField(row.below_grade == null ? '' : JSON.stringify(row.below_grade)),
      ].join(',')
      res.write(line + '\n')
    })
    res.end()
  } catch {
    // Headers already sent by this point in most cases; just end the stream.
    res.end()
  }
})

app.get('/api/health', async (req, res) => {
  const db = await ping()
  res.json({ ok: true, db })
})

app.use(express.static(distDir))

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

async function start() {
  if (isConfigured()) {
    // Never let a slow or unreachable database stop the app from serving.
    // Retry in the background; /api/events returns 503 until it succeeds.
    const tryInit = async (attempt = 1) => {
      try {
        await initDb()
        console.log('print telemetry: database configured')
      } catch (err) {
        console.error(`print telemetry: database init failed (attempt ${attempt}): ${err.code || err.message}`)
        setTimeout(() => tryInit(attempt + 1), Math.min(30000, 2000 * attempt))
      }
    }
    tryInit()
  } else {
    console.log('print telemetry: database not configured — /api/events will return 503')
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ECP Calculator server listening on port ${PORT}`)
  })
}

start()
