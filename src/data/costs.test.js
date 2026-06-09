import { describe, it, expect } from 'vitest'
import { categories } from './ecpData'
import costs from './generated/costs.json'

// Which categories are costable, and how their cost rows are keyed.
// Every option VALUE in ecpData must have a matching cost row, or the
// costing tab would silently cost an upgrade at $0.
const COSTABLE = {
  aboveGroundWalls: { container: 'rates', key: 'min_rsi' }, // option value === threshold minRsi
  belowGradeWalls:  { container: 'rates', key: 'rsi' },
  windowsDoors:     { container: 'rates', key: 'u' },
  airTightness:     { container: 'flat',  key: 'ach50' },
  hrv:              { container: 'flat',  key: 'sre' },
  dhwElectric:      { container: 'flat',  key: 'ef' },
  dhwGas:           { container: 'flat',  key: 'uef' },
}

describe('costs.json covers every costable ECP option', () => {
  for (const [catId, { container, key }] of Object.entries(COSTABLE)) {
    it(`${catId}: every option value has a matching cost row`, () => {
      const optionValues = categories.find(c => c.id === catId).options.map(o => o.value)
      const rowValues = costs[catId][container].map(r => r[key])
      for (const v of optionValues) {
        expect(rowValues).toContain(v)
      }
    })
  }

  it('has currency metadata', () => {
    expect(costs.meta.currency).toBe('CAD')
  })
})
