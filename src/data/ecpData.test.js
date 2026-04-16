import { describe, it, expect } from 'vitest'
import {
  calculateWallRsi, getWallPoints, MIN_WALL_RSI,
  getBoundaryOptions, getDefaultBoundary, getContinuousInsRsi,
  getInteriorLayerRsi,
  wallTypes, studSpacingOptions, cavityMaterials, continuousInsTypes,
  categories, tiers, framedWallRsi, icfRsi,
} from './ecpData'

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
    // wood RSI (2.81) + contIns (1.68) = 4.49
    expect(rsi).toBeCloseTo(4.49, 1)
  })

  it('returns correct RSI for steel / 16" / FG Batt / 2x6 R20 / 2" XPS', () => {
    const rsi = calculateWallRsi({
      wallType: 'steel',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'XPS',
      contInsThickness: '2"'
    })
    // Steel with cont ins → K1=0.40 (insulating sheathing present)
    // Exact value depends on NBC formula; should be in the 3.5-3.8 range
    expect(rsi).toBeGreaterThan(3.4)
    expect(rsi).toBeLessThan(3.9)
  })

  it('returns correct RSI for ICF 3-1/8"', () => {
    const rsi = calculateWallRsi({
      wallType: 'icf',
      icfFormThickness: '3-1/8"'
    })
    // 0.03 + 0.11(vinyl default) + 79.375*2*0.026 + 152.4*0.0004 + 0.08 + 0.12 = 4.5285
    expect(rsi).toBeCloseTo(4.53, 1)
  })

  it('returns null when required fields are missing', () => {
    expect(calculateWallRsi({})).toBeNull()
    expect(calculateWallRsi({ wallType: 'wood' })).toBeNull()
  })

  it('returns correct RSI for wood / 24" / Fiberglass Batt / 2x6 R24 / 3" Polyiso', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '24"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R24',
      contInsType: 'Polyiso',
      contInsThickness: '3"'
    })
    // framedWallRsi (~3.25) + contIns (2.7432) = ~5.99
    expect(rsi).toBeCloseTo(5.99, 1)
  })

  it('handles PIC as alias for Polyiso', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '24"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R24',
      contInsType: 'PIC',
      contInsThickness: '3"'
    })
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
    expect(rsi).toBeCloseTo(2.81, 1)
  })

  it('returns correct RSI for wood with Mineral Wool continuous insulation', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'Mineral Wool (Rock Wool)',
      contInsThickness: '2"'
    })
    // framedWallRsi (~2.81) + contIns (1.40716) = ~4.22
    expect(rsi).toBeCloseTo(4.22, 1)
  })

  // New: deep cavity support
  it('supports deep cavity walls (2x10 Dense Pack Cellulose)', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Dense Pack Cellulose',
      cavityType: '2x10',
    })
    expect(rsi).toBeGreaterThan(4.0)
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

  it('rounds 3.6875 up to 3.69 -> 6.2 pts', () => {
    expect(getWallPoints(3.6875)).toBe(6.2)
  })

  it('rounds 3.685 up to 3.69 -> 6.2 pts (half-up at threshold)', () => {
    expect(getWallPoints(3.685)).toBe(6.2)
  })

  it('rounds 3.684 down to 3.68 -> 1.6 pts (just below threshold)', () => {
    expect(getWallPoints(3.684)).toBe(1.6)
  })

  it('rounds 3.08499 down to 3.08 -> 1.6 pts (stays at bracket floor)', () => {
    expect(getWallPoints(3.08499)).toBe(1.6)
  })

  it('rounds 5.445 up to 5.45 -> 13.6 pts (top bracket)', () => {
    expect(getWallPoints(5.445)).toBe(13.6)
  })
})

describe('MIN_WALL_RSI', () => {
  it('is 2.97', () => {
    expect(MIN_WALL_RSI).toBe(2.97)
  })
})

describe('backward compatibility', () => {
  it('exports all required constants', () => {
    expect(wallTypes).toHaveLength(3)
    expect(studSpacingOptions).toHaveLength(3)
    expect(cavityMaterials.length).toBeGreaterThan(3)
    expect(continuousInsTypes.length).toBeGreaterThan(3)
    expect(categories.length).toBe(8)
    expect(tiers).toHaveLength(2)
  })

  it('framedWallRsi has wood and steel lookups', () => {
    expect(framedWallRsi.wood['16"']['Fiberglass Batt']['2x6 R20']).toBeCloseTo(2.81, 1)
    expect(framedWallRsi.steel).toBeDefined()
    expect(framedWallRsi.steel['24"']).toBeDefined()
  })

  it('icfRsi has all form thicknesses', () => {
    expect(icfRsi['2-1/2"']).toBeGreaterThan(3)
    expect(icfRsi['3-1/8"']).toBeGreaterThan(4)
    expect(icfRsi['4-1/4"']).toBeGreaterThan(5)
  })

  it('continuousInsTypes includes Polyiso (not PIC)', () => {
    expect(continuousInsTypes).toContain('Polyiso')
  })
})

describe('variable boundary layers', () => {
  it('getBoundaryOptions returns cladding and sheathing options', () => {
    const opts = getBoundaryOptions()
    expect(opts.cladding.options.length).toBeGreaterThan(3)
    expect(opts.sheathing.options.length).toBeGreaterThan(2)
  })

  it('getDefaultBoundary returns wood defaults', () => {
    const b = getDefaultBoundary('wood')
    expect(b.cladding).toBe(0.11)   // vinyl siding
    expect(b.sheathing).toBe(0.108) // 7/16" OSB
  })

  it('getDefaultBoundary returns steel defaults', () => {
    const b = getDefaultBoundary('steel')
    expect(b.cladding).toBe(0.11)   // metal siding
    expect(b.sheathing).toBe(0.08)  // gypsum sheathing (non-combustible)
    expect(b.air_space).toBe(0.18)
  })

  it('calculateWallRsi with custom sheathing', () => {
    const defaultRsi = calculateWallRsi({
      wallType: 'wood', studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
    })
    const withPlywood = calculateWallRsi({
      wallType: 'wood', studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
      sheathingId: 'plywood_sw_12_5',
    })
    // Plywood 1/2" (0.109) vs OSB 7/16" (0.108) = +0.001
    expect(withPlywood).toBeGreaterThan(defaultRsi)
  })
})

describe('calculateWallRsi with service wall', () => {
  it('returns correct RSI for single wall + service wall + OSB interior layer', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
    })
    expect(rsi).toBeGreaterThan(4.0)
    expect(rsi).toBeLessThan(5.0)
  })

  it('returns correct RSI for single wall + service wall + 2" XPS interior layer', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'XPS',
      interiorLayerThickness: '2"',
    })
    expect(rsi).toBeGreaterThan(5.5)
    expect(rsi).toBeLessThan(6.5)
  })

  it('returns correct RSI for double stud + service wall', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      assemblyType: 'doubleStud',
      studSpacing: '16"',
      outerStud: '2x4',
      innerStud: '2x4',
      plate: '2x10',
      doubleStudMaterial: 'Dense Pack Cellulose',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R14',
      interiorLayerMaterial: 'osb_11',
    })
    expect(rsi).toBeGreaterThan(5.0)
  })

  it('returns null when service wall fields incomplete', () => {
    expect(calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
    })).toBeNull()
  })

  it('ignores contInsType/contInsThickness when service wall is enabled', () => {
    const withContIns = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
      contInsType: 'XPS',
      contInsThickness: '2"',
    })
    const withoutContIns = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
    })
    expect(withContIns).toBeCloseTo(withoutContIns, 4)
  })
})

describe('getInteriorLayerRsi', () => {
  it('returns RSI for a sheathing ID', () => {
    expect(getInteriorLayerRsi('osb_11')).toBeCloseTo(0.108, 3)
  })
  it('returns RSI for a plywood sheathing ID', () => {
    expect(getInteriorLayerRsi('plywood_sw_12_5')).toBeCloseTo(0.109, 3)
  })
  it('returns RSI for rigid foam type + thickness', () => {
    expect(getInteriorLayerRsi('XPS', '2"')).toBeCloseTo(1.68, 2)
  })
  it('returns RSI for Polyiso 1-1/2"', () => {
    expect(getInteriorLayerRsi('Polyiso', '1-1/2"')).toBeCloseTo(1.385, 2)
  })
  it('returns 0 for null/undefined', () => {
    expect(getInteriorLayerRsi(null)).toBe(0)
    expect(getInteriorLayerRsi(undefined)).toBe(0)
  })
  it('returns 0 for unknown material', () => {
    expect(getInteriorLayerRsi('nonexistent')).toBe(0)
  })
})
