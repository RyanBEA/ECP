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
