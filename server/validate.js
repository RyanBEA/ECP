// Pure validation for incoming print telemetry events. No I/O.

const ID_RE = /^[A-Za-z0-9_-]+$/
const MAX_SELECTIONS = 40
const MAX_SELECTION_KEY_LEN = 40
const MAX_WALL_KEYS = 25
const MAX_WALL_STRING_LEN = 60
const MAX_APP_VERSION_LEN = 20
const MAX_SESSION_ID_LEN = 64
const ALLOWED_TIERS = [2, 3, 4, 5]

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateSelections(selections) {
  if (!isPlainObject(selections)) return 'selections must be an object'
  const keys = Object.keys(selections)
  if (keys.length > MAX_SELECTIONS) return 'too many selections'
  for (const key of keys) {
    if (typeof key !== 'string' || key.length > MAX_SELECTION_KEY_LEN || !ID_RE.test(key)) {
      return `invalid selections key: ${key}`
    }
    const value = selections[key]
    if (!Number.isInteger(value) || value < 0 || value > 50) {
      return `invalid selections value for ${key}`
    }
  }
  return null
}

function validateWall(wall) {
  if (wall === null) return null
  if (!isPlainObject(wall)) return 'wall must be null or an object'
  const keys = Object.keys(wall)
  if (keys.length > MAX_WALL_KEYS) return 'too many wall keys'
  for (const key of keys) {
    const value = wall[key]
    const validScalar =
      value === null ||
      typeof value === 'boolean' ||
      isFiniteNumber(value) ||
      (typeof value === 'string' && value.length <= MAX_WALL_STRING_LEN)
    if (!validScalar) return `invalid wall value for ${key}`
  }
  return null
}

/**
 * Validate an incoming print event body.
 * @returns {{ ok: true, event: object } | { ok: false, error: string }}
 */
export function validateEvent(body) {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'body must be an object' }
  }

  if (body.v !== 1) {
    return { ok: false, error: 'unsupported v' }
  }

  if (typeof body.appVersion !== 'string' || body.appVersion.length === 0 || body.appVersion.length > MAX_APP_VERSION_LEN) {
    return { ok: false, error: 'invalid appVersion' }
  }

  if (typeof body.sessionId !== 'string' || body.sessionId.length === 0 || body.sessionId.length > MAX_SESSION_ID_LEN) {
    return { ok: false, error: 'invalid sessionId' }
  }

  if (!Number.isInteger(body.tier) || !ALLOWED_TIERS.includes(body.tier)) {
    return { ok: false, error: 'invalid tier' }
  }

  if (!isFiniteNumber(body.targetPoints) || body.targetPoints < 0 || body.targetPoints > 100) {
    return { ok: false, error: 'invalid targetPoints' }
  }

  if (!isFiniteNumber(body.totalPoints) || body.totalPoints < 0 || body.totalPoints > 100) {
    return { ok: false, error: 'invalid totalPoints' }
  }

  if (typeof body.met !== 'boolean') {
    return { ok: false, error: 'invalid met' }
  }

  const selectionsError = validateSelections(body.selections)
  if (selectionsError) {
    return { ok: false, error: selectionsError }
  }

  const wall = body.wall === undefined ? null : body.wall
  const wallError = validateWall(wall)
  if (wallError) {
    return { ok: false, error: wallError }
  }

  // Strip unknown top-level keys — only the validated shape is kept.
  const event = {
    v: 1,
    appVersion: body.appVersion,
    sessionId: body.sessionId,
    tier: body.tier,
    targetPoints: body.targetPoints,
    totalPoints: body.totalPoints,
    met: body.met,
    selections: { ...body.selections },
    wall: wall === null ? null : { ...wall },
  }

  return { ok: true, event }
}
