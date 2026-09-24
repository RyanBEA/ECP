import { describe, it, expect } from 'vitest'
import { validateEvent } from './validate.js'

function validBody(overrides = {}) {
  return {
    v: 1,
    appVersion: '1.1.0',
    sessionId: 'abc-123',
    tier: 2,
    targetPoints: 10,
    totalPoints: 4.5,
    met: false,
    selections: { airTightness: 1, hrv: 0 },
    wall: { mode: 'builder', wallType: 'wood', rsi: 3.5 },
    ...overrides,
  }
}

describe('validateEvent', () => {
  it('accepts a valid event', () => {
    const result = validateEvent(validBody())
    expect(result.ok).toBe(true)
    expect(result.event.tier).toBe(2)
    expect(result.event.selections).toEqual({ airTightness: 1, hrv: 0 })
  })

  it('accepts a valid event with wall: null', () => {
    const result = validateEvent(validBody({ wall: null }))
    expect(result.ok).toBe(true)
    expect(result.event.wall).toBeNull()
  })

  it('rejects wrong v', () => {
    const result = validateEvent(validBody({ v: 2 }))
    expect(result.ok).toBe(false)
  })

  it('rejects missing v', () => {
    const body = validBody()
    delete body.v
    const result = validateEvent(body)
    expect(result.ok).toBe(false)
  })

  it('rejects oversized selections (too many keys)', () => {
    const selections = {}
    for (let i = 0; i < 41; i++) selections[`cat${i}`] = 1
    const result = validateEvent(validBody({ selections }))
    expect(result.ok).toBe(false)
  })

  it('rejects a non-integer selections option index', () => {
    const result = validateEvent(validBody({ selections: { airTightness: 1.5 } }))
    expect(result.ok).toBe(false)
  })

  it('rejects a selections key with invalid characters', () => {
    const result = validateEvent(validBody({ selections: { 'bad key!': 1 } }))
    expect(result.ok).toBe(false)
  })

  it('rejects a string where met should be a boolean', () => {
    const result = validateEvent(validBody({ met: 'true' }))
    expect(result.ok).toBe(false)
  })

  it('rejects an overly long appVersion string', () => {
    const result = validateEvent(validBody({ appVersion: 'x'.repeat(21) }))
    expect(result.ok).toBe(false)
  })

  it('rejects an overly long sessionId string', () => {
    const result = validateEvent(validBody({ sessionId: 'x'.repeat(65) }))
    expect(result.ok).toBe(false)
  })

  it('rejects tier values outside the allowed set', () => {
    const result = validateEvent(validBody({ tier: 6 }))
    expect(result.ok).toBe(false)
  })

  it('rejects out-of-range totalPoints', () => {
    const result = validateEvent(validBody({ totalPoints: 101 }))
    expect(result.ok).toBe(false)
  })

  it('rejects wall with a nested object value', () => {
    const result = validateEvent(validBody({ wall: { nested: { a: 1 } } }))
    expect(result.ok).toBe(false)
  })

  it('rejects wall with an overly long string value', () => {
    const result = validateEvent(validBody({ wall: { note: 'x'.repeat(61) } }))
    expect(result.ok).toBe(false)
  })

  it('rejects wall with too many keys', () => {
    const wall = {}
    for (let i = 0; i < 26; i++) wall[`k${i}`] = 1
    const result = validateEvent(validBody({ wall }))
    expect(result.ok).toBe(false)
  })

  it('strips unknown top-level keys from the returned event', () => {
    const result = validateEvent(validBody({ extra: 'should be dropped' }))
    expect(result.ok).toBe(true)
    expect(result.event.extra).toBeUndefined()
  })

  it('rejects a non-object body', () => {
    const result = validateEvent('not an object')
    expect(result.ok).toBe(false)
  })
})

describe('validateEvent belowGrade', () => {
  const builder = {
    mode: 'builder',
    foundationType: 'concrete',
    concreteThickness: '200',
    blockType: null,
    icfFormThickness: null,
    pwfStud: null,
    pwfSpacing: null,
    pwfCavityMaterial: null,
    pwfCavityType: null,
    extInsType: 'XPS',
    extInsThickness: '2"',
    intInsType: null,
    intInsThickness: null,
    hasStudWall: true,
    studSpacing: '16"',
    cavityMaterial: 'Fiberglass Batt',
    cavityType: '2x6 R22',
    studDepth: null,
    studOffset: false,
    finish: 'gypsum',
    rsi: 3.12,
    points: 0.2,
  }

  it('accepts a valid builder belowGrade and keeps every listed key', () => {
    const result = validateEvent(validBody({ belowGrade: builder }))
    expect(result.ok).toBe(true)
    expect(result.event.belowGrade).toEqual(builder)
  })

  it('accepts a valid simple belowGrade', () => {
    const simple = { mode: 'simple', simpleIndex: 2, rsi: null, points: 1.4 }
    const result = validateEvent(validBody({ belowGrade: simple }))
    expect(result.ok).toBe(true)
    expect(result.event.belowGrade).toEqual(simple)
  })

  it('accepts belowGrade: null and treats a missing belowGrade as null', () => {
    expect(validateEvent(validBody({ belowGrade: null })).event.belowGrade).toBeNull()
    const body = validBody()
    delete body.belowGrade
    expect(validateEvent(body).event.belowGrade).toBeNull()
  })

  it('rejects belowGrade with a nested object value', () => {
    const result = validateEvent(validBody({ belowGrade: { ...builder, finish: { a: 1 } } }))
    expect(result.ok).toBe(false)
  })

  it('rejects belowGrade with an array value', () => {
    const result = validateEvent(validBody({ belowGrade: { ...builder, finish: ['gypsum'] } }))
    expect(result.ok).toBe(false)
  })

  it('rejects belowGrade with a 61-character string', () => {
    const result = validateEvent(validBody({ belowGrade: { ...builder, cavityType: 'x'.repeat(61) } }))
    expect(result.ok).toBe(false)
  })

  it('accepts a 60-character string', () => {
    const result = validateEvent(validBody({ belowGrade: { ...builder, cavityType: 'x'.repeat(60) } }))
    expect(result.ok).toBe(true)
  })

  it('rejects a non-finite number', () => {
    const result = validateEvent(validBody({ belowGrade: { ...builder, rsi: Infinity } }))
    expect(result.ok).toBe(false)
  })

  it('rejects belowGrade that is not null or an object', () => {
    expect(validateEvent(validBody({ belowGrade: 'builder' })).ok).toBe(false)
    expect(validateEvent(validBody({ belowGrade: [1] })).ok).toBe(false)
  })

  it('strips an unknown key from belowGrade', () => {
    const result = validateEvent(validBody({ belowGrade: { ...builder, note: 'dropped' } }))
    expect(result.ok).toBe(true)
    expect(result.event.belowGrade.note).toBeUndefined()
    expect(result.event.belowGrade).toEqual(builder)
  })
})

describe('validateEvent belowGrade key cap', () => {
  it('rejects a belowGrade object with more than 30 keys', () => {
    const big = {}
    for (let i = 0; i < 31; i++) big[`k${i}`] = 1
    expect(validateEvent(validBody({ belowGrade: big })).error).toMatch(/too many belowGrade keys/)
  })
  it('accepts a belowGrade object at 30 keys', () => {
    const ok = {}
    for (let i = 0; i < 30; i++) ok[`k${i}`] = 1
    expect(validateEvent(validBody({ belowGrade: ok })).error).toBeUndefined()
  })
})
