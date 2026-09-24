// Anonymous print telemetry. Sends a small, non-identifying event to the
// server when the user clicks "Save / Print". Never includes project,
// address, permit, or applicant details, or any other free-text input.

import { calculateWallRsi, calculateBelowGradeRsi, categories } from '../data/ecpData'

const WALL_FIELDS = [
  'wallType',
  'assemblyType',
  'studSpacing',
  'cavityMaterial',
  'cavityType',
  'outerStud',
  'innerStud',
  'plate',
  'doubleStudMaterial',
  'hasServiceWall',
  'serviceSpacing',
  'serviceCavityMaterial',
  'serviceCavityType',
  'contInsType',
  'contInsThickness',
]

// Below-grade (foundation) builder fields. Every key is always present in a
// builder-mode event (null when not set) so the stored shape is fixed. Values
// are option ids/labels from fixed lists, booleans, or null — never free text.
const BELOW_GRADE_FIELDS = [
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
]

function round2(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

// Only booleans, finite numbers, and short strings pass; anything else becomes null.
function scalarOrNull(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length <= 60) return value
  return null
}

function buildBelowGrade(selection, points) {
  if (!selection || typeof selection !== 'object') return null
  const isSimpleMode = selection.simpleIndex !== undefined
  const isBuilderMode = !isSimpleMode && !!selection.foundationType
  if (!isSimpleMode && !isBuilderMode) return null

  if (isSimpleMode) {
    // Select RSI mode: rsi is the chosen option's RSI level from the category list.
    const category = categories.find(c => c.id === 'belowGradeWalls')
    const option = category?.options?.[selection.simpleIndex]
    return {
      mode: 'simple',
      simpleIndex: scalarOrNull(selection.simpleIndex),
      rsi: round2(option?.value),
      points: scalarOrNull(points),
    }
  }

  let rsi = null
  try {
    rsi = round2(calculateBelowGradeRsi(selection))
  } catch {
    rsi = null
  }

  const belowGrade = { mode: 'builder' }
  BELOW_GRADE_FIELDS.forEach(key => {
    belowGrade[key] = scalarOrNull(selection[key])
  })
  belowGrade.rsi = rsi
  belowGrade.points = scalarOrNull(points)
  return belowGrade
}

// From v1.3.0 the Below Grade Walls category is recorded in `belowGrade`, never
// as an option index in `selections`. The option list now starts with a 2.98 /
// 0-point floor at index 0, so an index would mean a different level than in older rows.
function stripBelowGradeIndex(selections) {
  const copy = { ...selections }
  delete copy.belowGradeWalls
  return copy
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

// Generated once per page load, held in memory only — never persisted.
export const sessionId = makeSessionId()

/**
 * Build an anonymous print telemetry event from calculator state.
 * Pure function — does not send anything.
 */
export function buildPrintEvent({
  selections,
  wallSelection,
  wallPoints,
  belowGradeSelection,
  belowGradePoints,
  totalPoints,
  selectedTier,
  appVersion,
}) {
  const isBuilderMode = !!(wallSelection && wallSelection.wallType && wallSelection.simpleIndex === undefined)
  const isSimpleMode = !!(wallSelection && wallSelection.simpleIndex !== undefined)
  const hasWall = isBuilderMode || isSimpleMode

  let wall = null
  if (hasWall) {
    if (isSimpleMode) {
      wall = {
        mode: 'simple',
        simpleIndex: wallSelection.simpleIndex,
        points: wallPoints,
      }
    } else {
      // Mirrors PrintSummary.jsx's builder-mode RSI computation.
      let rsi = null
      try {
        const computed = calculateWallRsi(wallSelection)
        rsi = computed ? Math.round(computed * 100) / 100 : null
      } catch {
        rsi = null
      }

      wall = { mode: 'builder' }
      WALL_FIELDS.forEach(key => {
        const value = wallSelection[key]
        if (value !== undefined) {
          wall[key] = value
        }
      })
      wall.rsi = rsi
      wall.points = wallPoints
    }
  }

  return {
    v: 1,
    appVersion,
    sessionId,
    tier: selectedTier.id,
    targetPoints: selectedTier.points,
    totalPoints: Math.round(totalPoints * 10) / 10,
    met: totalPoints >= selectedTier.points,
    selections: stripBelowGradeIndex(selections),
    wall,
    belowGrade: buildBelowGrade(belowGradeSelection, belowGradePoints ?? 0),
  }
}

/**
 * Fire-and-forget POST of a print event to the server. Never throws, never
 * blocks or delays the caller (must not be awaited before window.print()).
 */
export function sendPrintEvent(event) {
  try {
    const url = new URL('api/events', document.baseURI).toString()
    const body = JSON.stringify(event)

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon(url, blob)
      if (ok) return
    }

    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {})
  } catch {
    // Swallow all errors — telemetry must never affect printing.
  }
}
