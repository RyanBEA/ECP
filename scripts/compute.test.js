import { describe, it, expect } from 'vitest'
import {
  woodWallRsi, steelWallRsi, icfWallRsi, parallelPath,
  doubleStudWallRsi, doubleWallRsi,
  steelKValues, steelCavityPct,
} from './compute.js'

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

describe('steelKValues', () => {
  it('< 500mm without insulating sheathing → 0.33/0.67', () => {
    expect(steelKValues(16, false)).toEqual({ k1: 0.33, k2: 0.67 })
    expect(steelKValues(19, false)).toEqual({ k1: 0.33, k2: 0.67 })
  })

  it('< 500mm with insulating sheathing → 0.40/0.60', () => {
    expect(steelKValues(16, true)).toEqual({ k1: 0.40, k2: 0.60 })
    expect(steelKValues(19, true)).toEqual({ k1: 0.40, k2: 0.60 })
  })

  it('≥ 500mm → 0.50/0.50 regardless of insulating sheathing', () => {
    expect(steelKValues(24, false)).toEqual({ k1: 0.50, k2: 0.50 })
    expect(steelKValues(24, true)).toEqual({ k1: 0.50, k2: 0.50 })
  })
})

describe('steelCavityPct', () => {
  it('computes cavity percentage from web thickness', () => {
    // (spacing - 0.125) * 100 / spacing
    expect(steelCavityPct(16)).toBeCloseTo(99.2188, 3)
    expect(steelCavityPct(19)).toBeCloseTo(99.3421, 3)
    expect(steelCavityPct(24)).toBeCloseTo(99.4792, 3)
  })
})

describe('steelWallRsi', () => {
  // NBC 2020 A-9.36.2.4.(1): RSI_eff = K1 × RSI_T1 + K2 × RSI_T3
  // K values from Table B, cavity percentages from Table C
  //
  // The existing CSV was generated with K1=0.40/K2=0.60 at 16"/19"
  // (assuming insulating sheathing present). Without continuous insulation,
  // the correct K values are 0.33/0.67 — giving LOWER RSI values.

  const steelBoundary = {
    outside_air: 0.03,
    cladding: 0.07,
    sheathing: 0,
    drywall: 0.08,
    inside_air: 0.12,
  }

  // --- NBC Example verification (page 1448) ---
  // 41×152mm steel, 406mm (16") o.c., with 38mm XPS (RSI 1.33)
  // K1=0.40, K2=0.60 (< 500mm with insulating sheathing)
  // RSI_eff = (0.40 × 5.25) + (0.60 × 2.08) = 3.35
  it('matches NBC 2020 Example 2 (steel 16" with XPS)', () => {
    const rsi = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 3.52,
      spacingInches: 16,
      boundary: {
        outside_air: 0.03,
        cladding: 0.07,  // brick veneer
        sheathing: 0,
        drywall: 0.08,   // 12.7mm gypsum
        inside_air: 0.12,
      },
      airSpace: 0.18,
      contInsRsi: 1.33,  // 38mm XPS → triggers K1=0.40
    })
    expect(rsi).toBeCloseTo(3.35, 1)
  })

  // --- 24" OC tests (K1=0.50/K2=0.50, ≥500mm) ---
  it('steel/24"/FG Batt/2x6 R24 matches CSV (K=0.50)', () => {
    const rsi = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 4.23,
      spacingInches: 24,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    expect(rsi).toBeCloseTo(2.703, 2)
  })

  it('steel/24"/FG Batt/2x3-5/8 R12 matches CSV (K=0.50)', () => {
    const rsi = steelWallRsi({
      studDepthMm: 92.075,
      cavityRsi: 2.11,
      spacingInches: 24,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    expect(rsi).toBeCloseTo(1.631488, 3)
  })

  // --- 16" OC without continuous insulation (K1=0.33/K2=0.67) ---
  it('steel/16"/no cont ins uses K1=0.33', () => {
    const rsi = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 3.52,
      spacingInches: 16,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    // K1=0.33, K2=0.67 — lower than the CSV (which assumed 0.40/0.60)
    // This is the NBC-correct value for steel without insulating sheathing
    expect(rsi).toBeGreaterThan(1.5)
    expect(rsi).toBeLessThan(2.5)
  })

  // --- Adding continuous insulation switches K at 16" ---
  it('adding continuous insulation at 16" increases K1 from 0.33 to 0.40', () => {
    const base = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 3.52,
      spacingInches: 16,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    const withContIns = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 3.52,
      spacingInches: 16,
      boundary: steelBoundary,
      airSpace: 0.18,
      contInsRsi: 0.88,  // 1" XPS
    })
    // The continuous insulation adds RSI AND switches K1 from 0.33→0.40
    // So the increase is MORE than just 0.88
    expect(withContIns - base).toBeGreaterThan(0.88)
  })
})

describe('icfWallRsi', () => {
  const icfBoundary = {
    outside_air: 0.03,
    cladding: 0.07,
    sheathing: 0,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('ICF 2-1/2" matches RSI-calc.xlsx', () => {
    const rsi = icfWallRsi({
      formThicknessMm: 63.5,
      epsRsiPerMm: 0.026,
      concreteCoreMm: 152.4,
      concreteRsiPerMm: 0.0004,
      boundary: icfBoundary,
    })
    // 0.03 + 0.07 + 63.5*2*0.026 + 152.4*0.0004 + 0.08 + 0.12 = 3.6630
    expect(rsi).toBeCloseTo(3.663, 2)
  })

  it('ICF 3-1/8" matches RSI-calc.xlsx', () => {
    const rsi = icfWallRsi({
      formThicknessMm: 79.375,
      epsRsiPerMm: 0.026,
      concreteCoreMm: 152.4,
      concreteRsiPerMm: 0.0004,
      boundary: icfBoundary,
    })
    // 0.03 + 0.07 + 79.375*2*0.026 + 152.4*0.0004 + 0.08 + 0.12 = 4.48846
    expect(rsi).toBeCloseTo(4.4885, 3)
  })

  it('ICF 4-1/4" matches RSI-calc.xlsx', () => {
    const rsi = icfWallRsi({
      formThicknessMm: 107.95,
      epsRsiPerMm: 0.026,
      concreteCoreMm: 152.4,
      concreteRsiPerMm: 0.0004,
      boundary: icfBoundary,
    })
    expect(rsi).toBeCloseTo(5.974, 2)
  })
})

describe('doubleStudWallRsi', () => {
  const boundary = {
    outside_air: 0.03,
    cladding: 0.11,
    sheathing: 0.108,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('two 2x4 rows on 2x10 plate, dense pack cellulose, 16" OC', () => {
    const rsi = doubleStudWallRsi({
      outerStudDepthMm: 89,
      innerStudDepthMm: 89,
      plateDepthMm: 235,
      cavityRsiPerMm: 0.024,
      cavityPct: 77,
      boundary,
    })
    // Each stud-cavity pp ≈ 1.504
    // Gap RSI = (235-89-89) * 0.024 = 57 * 0.024 = 1.368
    // Total ≈ 0.448 + 1.504 + 1.368 + 1.504 = 4.824
    expect(rsi).toBeGreaterThan(4.5)
    expect(rsi).toBeLessThan(5.5)
  })

  it('gap RSI increases with wider plate', () => {
    const narrow = doubleStudWallRsi({
      outerStudDepthMm: 89,
      innerStudDepthMm: 89,
      plateDepthMm: 184, // 2x8
      cavityRsiPerMm: 0.024,
      cavityPct: 77,
      boundary,
    })
    const wide = doubleStudWallRsi({
      outerStudDepthMm: 89,
      innerStudDepthMm: 89,
      plateDepthMm: 286, // 2x12
      cavityRsiPerMm: 0.024,
      cavityPct: 77,
      boundary,
    })
    expect(wide).toBeGreaterThan(narrow)
    // Difference should be approximately (286-184)*0.024 = 2.448
    expect(wide - narrow).toBeCloseTo((286 - 184) * 0.024, 1)
  })
})

describe('doubleWallRsi', () => {
  const boundary = {
    outside_air: 0.03,
    cladding: 0.11,
    sheathing: 0.108,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('2x6 exterior + 3" gap + 2x4 interior, DPC', () => {
    const rsi = doubleWallRsi({
      outerStudDepthMm: 140,
      outerCavityRsi: 140 * 0.024,   // DPC in outer wall
      outerCavityPct: 77,
      innerStudDepthMm: 89,
      innerCavityRsi: 89 * 0.024,    // DPC in inner wall
      innerCavityPct: 77,
      gapMm: 76.2,                    // 3"
      gapRsiPerMm: 0.024,            // DPC blown in
      boundary,
    })
    // Outer pp ≈ 2.364, inner pp ≈ 1.504, gap = 76.2*0.024 = 1.829
    // Total ≈ 0.448 + 2.364 + 1.829 + 1.504 = 6.145
    expect(rsi).toBeGreaterThan(5.5)
    expect(rsi).toBeLessThan(7.0)
  })
})
