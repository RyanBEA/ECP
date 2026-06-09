import { describe, it, expect } from 'vitest'
import { deriveAreas, costDesign } from './costing'

describe('deriveAreas', () => {
  // L=10, W=8, fdwr=0.17:
  //   perimeter      = 2*(10+8)            = 36
  //   grossAboveWall = 36 * 5.05           = 181.8
  //   fda            = 0.17 * 181.8        = 30.906
  //   windowArea     = 30.906 - 3.528      = 27.378
  //   netAboveWall   = 181.8 - 30.906      = 150.894
  //   belowGradeWall = 36 * 2.3            = 82.8
  it('computes areas from footprint + FDWR', () => {
    const a = deriveAreas({ length_m: 10, width_m: 8, fdwr: 0.17 })
    expect(a.perimeter).toBeCloseTo(36, 6)
    expect(a.grossAboveWall).toBeCloseTo(181.8, 6)
    expect(a.windowArea).toBeCloseTo(27.378, 6)
    expect(a.netAboveWall).toBeCloseTo(150.894, 6)
    expect(a.belowGradeWall).toBeCloseTo(82.8, 6)
  })

  it('returns a negative window area when FDWR is too low to fit the door', () => {
    // tiny footprint + min FDWR → fda (3×3: 0.05·12·5.05 = 3.03) below door area 3.528
    const a = deriveAreas({ length_m: 3, width_m: 3, fdwr: 0.05 })
    expect(a.windowArea).toBeLessThan(0)
  })
})

const geom = { length_m: 10, width_m: 8, fdwr: 0.17 } // windowArea 27.378, netAboveWall 150.894

describe('costDesign', () => {
  it('returns zero total and no line items when nothing is selected', () => {
    const r = costDesign({ selections: {}, wallSelection: {}, wallRsi: 0, geometry: geom })
    expect(r.lineItems).toHaveLength(0)
    expect(r.total).toBe(0)
  })

  it('costs a flat mechanical upgrade (HRV SRE 75 = $2000)', () => {
    const r = costDesign({ selections: { hrv: 2 }, wallSelection: {}, wallRsi: 0, geometry: geom })
    expect(r.lineItems).toHaveLength(1)
    expect(r.lineItems[0].categoryId).toBe('hrv')
    expect(r.lineItems[0].area).toBeNull()
    expect(r.lineItems[0].cost).toBe(2000)
    expect(r.total).toBe(2000)
  })

  it('costs an envelope upgrade by area × rate (windows U1.22 @ $340/m²)', () => {
    const r = costDesign({ selections: { windowsDoors: 1 }, wallSelection: {}, wallRsi: 0, geometry: geom })
    expect(r.lineItems).toHaveLength(1)
    expect(r.lineItems[0].categoryId).toBe('windowsDoors')
    expect(r.lineItems[0].area).toBeCloseTo(27.378, 3)
    expect(r.lineItems[0].cost).toBeCloseTo(27.378 * 340, 2)
  })

  it('costs a wall upgrade from the resolved wallRsi tier', () => {
    // wallRsi 4.29 → tier min_rsi 4.29 @ $24/m² × netAboveWall 150.894
    const r = costDesign({ selections: {}, wallSelection: {}, wallRsi: 4.29, geometry: geom })
    const wall = r.lineItems.find(li => li.categoryId === 'aboveGroundWalls')
    expect(wall).toBeTruthy()
    expect(wall.cost).toBeCloseTo(150.894 * 24, 2)
  })

  it('sums a full design and scales envelope cost with house size', () => {
    const small = costDesign({ selections: { windowsDoors: 1, hrv: 2 }, wallSelection: {}, wallRsi: 0, geometry: geom })
    const big = costDesign({ selections: { windowsDoors: 1, hrv: 2 }, wallSelection: {}, wallRsi: 0,
      geometry: { length_m: 14, width_m: 11, fdwr: 0.17 } })
    const winSmall = small.lineItems.find(li => li.categoryId === 'windowsDoors').cost
    const winBig = big.lineItems.find(li => li.categoryId === 'windowsDoors').cost
    const hrvSmall = small.lineItems.find(li => li.categoryId === 'hrv').cost
    const hrvBig = big.lineItems.find(li => li.categoryId === 'hrv').cost
    expect(winBig).toBeGreaterThan(winSmall)   // envelope scales with area
    expect(hrvBig).toBe(hrvSmall)              // flat cost does not
  })
})
