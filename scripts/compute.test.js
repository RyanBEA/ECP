import { describe, it, expect } from 'vitest'
import { woodWallRsi, parallelPath } from './compute.js'

describe('parallelPath', () => {
  it('computes parallel-path RSI for wood 2x4 R12 at 16" OC', () => {
    // stud_rsi = 89 * 0.0085 = 0.7565
    // cavity_rsi = 2.11
    // cavity_pct = 77
    // W = 100 / ((100-77)/0.7565 + 77/2.11) = 100/66.897 = 1.4948
    const result = parallelPath(0.7565, 2.11, 77)
    expect(result).toBeCloseTo(1.4948, 3)
  })
})

describe('woodWallRsi', () => {
  // Reference values from lookup-framed-wall-rsi.csv
  // These are total RSI with DEFAULT boundary layers:
  //   outside_air=0.03, cladding=0.11, sheathing=0.108, drywall=0.08, inside_air=0.12

  const defaultBoundary = {
    outside_air: 0.03,
    cladding: 0.11,
    sheathing: 0.108,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('wood/16"/Fiberglass Batt/2x4 R12 matches CSV', () => {
    const rsi = woodWallRsi({
      studDepthMm: 89,
      cavityRsi: 2.11,
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    expect(rsi).toBeCloseTo(1.942856, 4)
  })

  it('wood/16"/Fiberglass Batt/2x6 R20 matches CSV', () => {
    const rsi = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    expect(rsi).toBeCloseTo(2.807513, 4)
  })

  it('wood/24"/Fiberglass Batt/2x6 R24 matches CSV', () => {
    const rsi = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 4.23,
      cavityPct: 80,
      boundary: defaultBoundary,
    })
    expect(rsi).toBeCloseTo(3.247611, 4)
  })

  it('wood/16"/Dense Pack Cellulose/2x6 matches CSV', () => {
    // blown-in: cavity_rsi = 140mm * 0.024 = 3.36
    const rsi = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 140 * 0.024,  // 3.36
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    // Will be close to 2.812 but may differ slightly due to depth rounding
    expect(rsi).toBeCloseTo(2.812, 2)
  })

  it('adds continuous insulation in series', () => {
    const base = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    const withContIns = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: defaultBoundary,
      contInsRsi: 1.68,  // 2" XPS
    })
    expect(withContIns - base).toBeCloseTo(1.68, 4)
  })

  it('uses different sheathing RSI', () => {
    const withOsb = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: { ...defaultBoundary, sheathing: 0.108 },
    })
    const withPlywood = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: { ...defaultBoundary, sheathing: 0.110 },
    })
    expect(withPlywood - withOsb).toBeCloseTo(0.002, 4)
  })
})
