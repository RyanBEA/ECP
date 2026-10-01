import { ftToM, mToFt, m2ToSqFt, perM2ToPerSqFt, roundDisplay, formatDelta, ROUNDING_UNIT } from './units'

describe('units', () => {
  it('converts feet and metres both ways', () => {
    expect(ftToM(10)).toBeCloseTo(3.048, 4)
    expect(mToFt(3.048)).toBeCloseTo(10, 4)
  })
  it('converts areas and unit prices', () => {
    expect(m2ToSqFt(1)).toBeCloseTo(10.7639, 3)
    expect(perM2ToPerSqFt(107.639)).toBeCloseTo(10, 3)
  })
  it('rounds display to the rounding unit', () => {
    expect(ROUNDING_UNIT).toBe(500)
    expect(roundDisplay(8300)).toBe(8500)
    expect(roundDisplay(-740)).toBe(-500)
    expect(roundDisplay(0)).toBe(0)
  })
  it('rounds half-units away from zero symmetrically and never returns -0', () => {
    expect(roundDisplay(250)).toBe(500)
    expect(roundDisplay(-250)).toBe(-500)
    expect(Object.is(roundDisplay(-100), 0)).toBe(true)
  })
  it('formats deltas with sign, under-unit marker and zero', () => {
    expect(formatDelta(8300)).toBe('+$8,500')
    expect(formatDelta(-740)).toBe('-$500')
    expect(formatDelta(120)).toBe('< $500')
    expect(formatDelta(-120)).toBe('< $500')
    expect(formatDelta(0)).toBe('$0')
  })
})
