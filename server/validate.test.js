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
