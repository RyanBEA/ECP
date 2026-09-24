import { describe, it, expect } from 'vitest'
import { buildPrintEvent, sessionId } from './printEvent'

const baseTier = { id: 2, label: 'Tier 2', points: 10 }

const FORBIDDEN_KEYS = ['project', 'permit', 'applicant', 'projectInfo']

function assertNoForbiddenKeys(value) {
  if (value === null || typeof value !== 'object') return
  for (const key of Object.keys(value)) {
    expect(FORBIDDEN_KEYS).not.toContain(key)
    assertNoForbiddenKeys(value[key])
  }
}

describe('buildPrintEvent', () => {
  it('builds an event with wall: null when there is no wall selection', () => {
    const event = buildPrintEvent({
      selections: { airTightness: 1 },
      wallSelection: {},
      wallPoints: 0,
      totalPoints: 3.5,
      selectedTier: baseTier,
      appVersion: '1.1.0',
    })

    expect(event.v).toBe(1)
    expect(event.appVersion).toBe('1.1.0')
    expect(event.tier).toBe(2)
    expect(event.targetPoints).toBe(10)
    expect(event.totalPoints).toBe(3.5)
    expect(event.met).toBe(false)
    expect(event.selections).toEqual({ airTightness: 1 })
    expect(event.wall).toBeNull()
  })

  it('builds a simple-mode wall event', () => {
    const event = buildPrintEvent({
      selections: {},
      wallSelection: { simpleIndex: 2 },
      wallPoints: 4.5,
      totalPoints: 4.5,
      selectedTier: baseTier,
      appVersion: '1.1.0',
    })

    expect(event.wall).toEqual({
      mode: 'simple',
      simpleIndex: 2,
      points: 4.5,
    })
  })

  it('builds a builder-mode wall event with RSI', () => {
    const wallSelection = {
      wallType: 'wood',
      assemblyType: 'single',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'EPS',
      contInsThickness: '2"',
    }

    const event = buildPrintEvent({
      selections: {},
      wallSelection,
      wallPoints: 5,
      totalPoints: 5,
      selectedTier: baseTier,
      appVersion: '1.1.0',
    })

    expect(event.wall.mode).toBe('builder')
    expect(event.wall.wallType).toBe('wood')
    expect(event.wall.studSpacing).toBe('16"')
    expect(event.wall.points).toBe(5)
    expect(typeof event.wall.rsi === 'number' || event.wall.rsi === null).toBe(true)
  })

  it('rounds totalPoints to 1 decimal', () => {
    const event = buildPrintEvent({
      selections: {},
      wallSelection: {},
      wallPoints: 0,
      totalPoints: 4.567,
      selectedTier: baseTier,
      appVersion: '1.1.0',
    })
    expect(event.totalPoints).toBe(4.6)
  })

  it('never includes project/permit/applicant keys even if smuggled in', () => {
    const event = buildPrintEvent({
      selections: { airTightness: 1 },
      wallSelection: {
        wallType: 'wood',
        studSpacing: '16"',
        projectInfo: { project: 'Secret St', permit: '12345', applicant: 'Jane Doe' },
      },
      wallPoints: 3,
      totalPoints: 3,
      selectedTier: baseTier,
      appVersion: '1.1.0',
      projectInfo: { project: 'Secret St', permit: '12345', applicant: 'Jane Doe' },
    })

    assertNoForbiddenKeys(event)
  })

  it('does not accept a projectInfo argument that leaks into the event', () => {
    const event = buildPrintEvent({
      selections: {},
      wallSelection: {},
      wallPoints: 0,
      totalPoints: 0,
      selectedTier: baseTier,
      appVersion: '1.1.0',
      projectInfo: { project: 'X', permit: 'Y', applicant: 'Z' },
    })
    expect(JSON.stringify(event)).not.toMatch(/Secret|project|permit|applicant/i)
  })

  it('exposes a stable sessionId across calls', () => {
    const event1 = buildPrintEvent({
      selections: {},
      wallSelection: {},
      wallPoints: 0,
      totalPoints: 0,
      selectedTier: baseTier,
      appVersion: '1.1.0',
    })
    const event2 = buildPrintEvent({
      selections: {},
      wallSelection: {},
      wallPoints: 0,
      totalPoints: 0,
      selectedTier: baseTier,
      appVersion: '1.1.0',
    })
    expect(event1.sessionId).toBe(event2.sessionId)
    expect(event1.sessionId).toBe(sessionId)
  })
})

const BELOW_GRADE_BUILDER_KEYS = [
  'mode',
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

function baseArgs(overrides = {}) {
  return {
    selections: {},
    wallSelection: {},
    wallPoints: 0,
    belowGradeSelection: {},
    belowGradePoints: 0,
    totalPoints: 0,
    selectedTier: baseTier,
    appVersion: '1.3.0',
    ...overrides,
  }
}

describe('buildPrintEvent belowGrade', () => {
  it('is null when there is no below-grade selection', () => {
    expect(buildPrintEvent(baseArgs()).belowGrade).toBeNull()
    expect(buildPrintEvent(baseArgs({ belowGradeSelection: undefined })).belowGrade).toBeNull()
  })

  it('builds a simple-mode below-grade object', () => {
    const event = buildPrintEvent(baseArgs({
      belowGradeSelection: { simpleIndex: 1 },
      belowGradePoints: 0.8,
    }))
    // simpleIndex 1 is the first points level (RSI 3.09); index 0 is the 2.98 floor.
    expect(event.belowGrade).toEqual({
      mode: 'simple',
      simpleIndex: 1,
      rsi: 3.09,
      points: 0.8,
    })
  })

  it('builds a builder-mode object with exactly the listed keys, absent fields null', () => {
    const event = buildPrintEvent(baseArgs({
      belowGradeSelection: {
        foundationType: 'concrete',
        concreteThickness: '200',
        hasStudWall: true,
        studSpacing: '16"',
        cavityMaterial: 'Fiberglass Batt',
        cavityType: '2x6 R22',
        finish: 'gypsum',
      },
      belowGradePoints: 0.2,
    }))
    const bg = event.belowGrade
    expect(Object.keys(bg).sort()).toEqual([...BELOW_GRADE_BUILDER_KEYS].sort())
    expect(bg.mode).toBe('builder')
    expect(bg.foundationType).toBe('concrete')
    expect(bg.concreteThickness).toBe('200')
    expect(bg.hasStudWall).toBe(true)
    expect(bg.blockType).toBeNull()
    expect(bg.icfFormThickness).toBeNull()
    expect(bg.pwfStud).toBeNull()
    expect(bg.studOffset).toBeNull()
    expect(bg.points).toBe(0.2)
    expect(typeof bg.rsi).toBe('number')
    expect(Number.isFinite(bg.rsi)).toBe(true)
    expect(bg.rsi).toBe(Math.round(bg.rsi * 100) / 100)
  })

  it('reports rsi null for an incomplete builder selection', () => {
    const event = buildPrintEvent(baseArgs({
      belowGradeSelection: { foundationType: 'concrete', hasStudWall: true },
    }))
    expect(event.belowGrade.mode).toBe('builder')
    expect(event.belowGrade.rsi).toBeNull()
  })

  it('drops keys that are not on the list and never emits undefined or non-scalar values', () => {
    const event = buildPrintEvent(baseArgs({
      belowGradeSelection: {
        foundationType: 'icf',
        icfFormThickness: '2-1/2"',
        finish: 'gypsum',
        note: 'free text must not pass',
        nested: { a: 1 },
      },
    }))
    const bg = event.belowGrade
    expect(bg.note).toBeUndefined()
    expect(bg.nested).toBeUndefined()
    for (const value of Object.values(bg)) {
      const ok =
        value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.length <= 60)
      expect(ok).toBe(true)
    }
  })

  it('never records belowGradeWalls as an index in selections', () => {
    const event = buildPrintEvent(baseArgs({
      selections: { airTightness: 1, belowGradeWalls: 2 },
      belowGradeSelection: { simpleIndex: 2 },
      belowGradePoints: 1.4,
    }))
    expect(event.selections).toEqual({ airTightness: 1 })
    expect(event.belowGrade.simpleIndex).toBe(2)
  })

  it('keeps v: 1', () => {
    expect(buildPrintEvent(baseArgs({ belowGradeSelection: { simpleIndex: 0 } })).v).toBe(1)
  })
})

describe('buildPrintEvent belowGrade coerces simpleIndex and points', () => {
  it('nulls a non-scalar simpleIndex and NaN points instead of sending them', () => {
    const e = buildPrintEvent(baseArgs({ belowGradeSelection: { simpleIndex: { a: 1 } }, belowGradePoints: NaN }))
    expect(e.belowGrade.mode).toBe('simple')
    expect(e.belowGrade.simpleIndex).toBeNull()
    expect(e.belowGrade.points).toBeNull()
  })
})
