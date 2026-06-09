import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import HouseElevation from './HouseElevation'

// helper: width attr of the first element matching a test id, within one render's container
const widthOf = (container, testid) =>
  parseFloat(container.querySelector(`[data-testid="${testid}"]`).getAttribute('width'))

describe('HouseElevation', () => {
  it('grows window glazing as FDWR increases', () => {
    const lo = render(<HouseElevation lengthM={10} widthM={8} fdwr={0.10} />)
    const hi = render(<HouseElevation lengthM={10} widthM={8} fdwr={0.30} />)
    expect(widthOf(hi.container, 'he-window-glass'))
      .toBeGreaterThan(widthOf(lo.container, 'he-window-glass'))
  })

  it('widens the facade as footprint area increases', () => {
    const small = render(<HouseElevation lengthM={6} widthM={5} fdwr={0.17} />)
    const big = render(<HouseElevation lengthM={14} widthM={12} fdwr={0.17} />)
    expect(widthOf(big.container, 'he-facade'))
      .toBeGreaterThan(widthOf(small.container, 'he-facade'))
  })

  it('clamps facade width at the small and large extremes', () => {
    const tiny = render(<HouseElevation lengthM={3} widthM={3} fdwr={0.17} />)
    const tiny2 = render(<HouseElevation lengthM={4} widthM={3} fdwr={0.17} />)
    const huge = render(<HouseElevation lengthM={20} widthM={18} fdwr={0.17} />)
    const huge2 = render(<HouseElevation lengthM={22} widthM={20} fdwr={0.17} />)
    expect(widthOf(tiny.container, 'he-facade'))
      .toBeCloseTo(widthOf(tiny2.container, 'he-facade'), 5)
    expect(widthOf(huge.container, 'he-facade'))
      .toBeCloseTo(widthOf(huge2.container, 'he-facade'), 5)
  })
})
