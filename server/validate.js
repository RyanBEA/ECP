// Pure validation for incoming print telemetry events. No I/O.

const ID_RE = /^[A-Za-z0-9_-]+$/
const MAX_SELECTIONS = 40
const MAX_SELECTION_KEY_LEN = 40
const MAX_WALL_KEYS = 25
const MAX_BELOW_GRADE_KEYS = 30   // 23 whitelisted keys plus slack
const MAX_WALL_STRING_LEN = 60
const MAX_APP_VERSION_LEN = 20
const MAX_SESSION_ID_LEN = 64
const ALLOWED_TIERS = [2, 3, 4, 5]

// Below-grade (foundation) wall object: fixed key list. Unknown keys are
// stripped; values must be null, boolean, finite number, or a short string.
const BELOW_GRADE_KEYS = [
  'mode',
  'simpleIndex',
  'foundationType',
  'concreteThickness',
  'blockType',
  'icfFormThickness',
  'pwfStud',
  'pwfSpacing',
  'pwfCavityMaterial',
  'pwfCavityType',
  'extInsType',
  'extInsThickness',
  'intInsType',
  'intInsThickness',
  'hasStudWall',
  'studSpacing',
  'cavityMaterial',
  'cavityType',
  'studDepth',
  'studOffset',
  'finish',
  'rsi',
  'points',
]

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

function isValidScalar(value) {
  return (
    value === null ||
    typeof value === 'boolean' ||
    isFiniteNumber(value) ||
    (typeof value === 'string' && value.length <= MAX_WALL_STRING_LEN)
  )
}

function validateWall(wall) {
  if (wall === null) return null
  if (!isPlainObject(wall)) return 'wall must be null or an object'
  const keys = Object.keys(wall)
  if (keys.length > MAX_WALL_KEYS) return 'too many wall keys'
  for (const key of keys) {
    if (!isValidScalar(wall[key])) return `invalid wall value for ${key}`
  }
  return null
}

// Every value (known key or not) must be a scalar, so a nested object under an
// unknown key is rejected rather than silently dropped.
function validateBelowGrade(belowGrade) {
  if (belowGrade === null) return null
  if (!isPlainObject(belowGrade)) return 'belowGrade must be null or an object'
  const keys = Object.keys(belowGrade)
  if (keys.length > MAX_BELOW_GRADE_KEYS) return 'too many belowGrade keys'
  for (const key of keys) {
    if (!isValidScalar(belowGrade[key])) return `invalid belowGrade value for ${key}`
  }
  return null
}

function pickBelowGrade(belowGrade) {
  if (belowGrade === null) return null
  const picked = {}
  for (const key of BELOW_GRADE_KEYS) {
    if (Object.hasOwn(belowGrade, key)) picked[key] = belowGrade[key]
  }
  return picked
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

  const belowGrade = body.belowGrade === undefined ? null : body.belowGrade
  const belowGradeError = validateBelowGrade(belowGrade)
  if (belowGradeError) {
    return { ok: false, error: belowGradeError }
  }

  // From v1.3.0 the Below Grade Walls category lives in `belowGrade`, never as an option
  // index in `selections` (the index list gained a floor at 0, so an index would be read
  // against the wrong list). The client strips it; strip it here too.
  const selections = { ...body.selections }
  delete selections.belowGradeWalls

  // Strip unknown top-level keys — only the validated shape is kept.
  const event = {
    v: 1,
    appVersion: body.appVersion,
    sessionId: body.sessionId,
    tier: body.tier,
    targetPoints: body.targetPoints,
    totalPoints: body.totalPoints,
    met: body.met,
    selections,
    wall: wall === null ? null : { ...wall },
    belowGrade: pickBelowGrade(belowGrade),
  }

  return { ok: true, event }
}
