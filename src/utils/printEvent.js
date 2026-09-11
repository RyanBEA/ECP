// Anonymous print telemetry. Sends a small, non-identifying event to the
// server when the user clicks "Save / Print". Never includes project,
// address, permit, or applicant details, or any other free-text input.

import { calculateWallRsi } from '../data/ecpData'

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
    selections: { ...selections },
    wall,
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
