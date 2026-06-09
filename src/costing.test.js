import { describe, it, expect } from 'vitest'
import { deriveAreas } from './costing'

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
