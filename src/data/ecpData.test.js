import { describe, it, expect } from 'vitest'
import { calculateWallRsi, getWallPoints } from './ecpData'

describe('calculateWallRsi', () => {
  it('returns correct RSI for wood / 16" / Fiberglass Batt / 2x6 R20 / no cont ins', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: null,
      contInsThickness: 'None'
    })
    // framedWallRsi already includes drywall, sheathing, air films
    expect(rsi).toBeCloseTo(2.81, 1)
  })

  it('returns correct RSI for wood / 16" / Fiberglass Batt / 2x6 R20 / 2" XPS', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'XPS',
      contInsThickness: '2"'
    })
    // framedWallRsi (2.81) + contIns (1.68) = 4.49
    expect(rsi).toBeCloseTo(4.49, 1)
  })

  it('returns correct RSI for steel / 16" / Fiberglass Batt / 2x6 R20 / 2" XPS', () => {
    const rsi = calculateWallRsi({
      wallType: 'steel',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'XPS',
      contInsThickness: '2"'
    })
    // framedWallRsi (1.97) + contIns (1.68) = 3.65
    expect(rsi).toBeCloseTo(3.65, 1)
  })

  it('returns correct RSI for ICF 3-1/8"', () => {
    const rsi = calculateWallRsi({
      wallType: 'icf',
      icfFormThickness: '3-1/8"'
    })
    expect(rsi).toBe(4.4275)
  })

  it('returns null when required fields are missing', () => {
    expect(calculateWallRsi({})).toBeNull()
    expect(calculateWallRsi({ wallType: 'wood' })).toBeNull()
  })

  it('returns correct RSI for wood / 24" / Fiberglass Batt / 2x6 R24 / 3" PIC', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '24"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R24',
      contInsType: 'PIC',
      contInsThickness: '3"'
    })
    // framedWallRsi (3.25) + contIns (2.7432) = 5.99
    expect(rsi).toBeCloseTo(5.99, 1)
  })

  it('handles cont ins type selected but thickness None', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'XPS',
      contInsThickness: 'None'
    })
    // No continuous insulation added — framed RSI is the total
    expect(rsi).toBeCloseTo(2.81, 1)
  })

  it('returns correct RSI for wood with Mineral Wool continuous insulation', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'Mineral Wool',
      contInsThickness: '2"'
    })
    // framedWallRsi (2.81) + contIns (1.40716) = 4.22
    expect(rsi).toBeCloseTo(4.22, 1)
  })
})

describe('getWallPoints', () => {
  it('returns 0 for RSI below minimum threshold', () => {
    expect(getWallPoints(2.5)).toBe(0)
  })

  it('returns 1.6 for RSI exactly at 3.08', () => {
    expect(getWallPoints(3.08)).toBe(1.6)
  })

  it('returns 9.9 for RSI of 4.48 (between 4.40 and 4.57)', () => {
    expect(getWallPoints(4.48)).toBe(9.9)
  })

  it('returns 13.6 for RSI above highest threshold', () => {
    expect(getWallPoints(6.0)).toBe(13.6)
  })

  it('returns 0 for null/undefined', () => {
    expect(getWallPoints(null)).toBe(0)
    expect(getWallPoints(undefined)).toBe(0)
  })
})
