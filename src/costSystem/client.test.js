import { lookupCost, PRICE_SOURCE_LABEL } from './client'
import { WALL_LAYER_OPTIONS, CARD_OPTIONS, HRV_SIZE_CLASSES } from '../costing/optionMap'

describe('lookupCost', () => {
  it('returns a priced row synchronously', () => {
    const r = lookupCost({ category: 'aboveGroundWalls', component: 'framing', option: 'stud_2x6_16oc' })
    expect(r).not.toBeNull()
    expect(typeof r.material).toBe('number')
    expect(typeof r.labour).toBe('number')
    expect(['LEEP ON 2016', 'placeholder']).toContain(r.source)
  })
  it('returns null for an unknown item', () => {
    expect(lookupCost({ category: 'aboveGroundWalls', component: 'framing', option: 'nope' })).toBeNull()
  })
  it('matches on fuel and size when given', () => {
    const a = lookupCost({ category: 'dhw', component: 'water_heater', option: 'elec_storage', fuel: 'electric', size: 50 })
    const b = lookupCost({ category: 'dhw', component: 'water_heater', option: 'elec_storage', fuel: 'electric', size: 80 })
    expect(a).not.toBeNull(); expect(b).not.toBeNull()
    expect(b.material).toBeGreaterThan(a.material)
  })
  it('has a row for every option the tool can request', () => {
    for (const o of WALL_LAYER_OPTIONS) {
      expect(lookupCost({ category: 'aboveGroundWalls', component: o.component, option: o.option }), `${o.component}/${o.option}`).not.toBeNull()
    }
    for (const o of CARD_OPTIONS) {
      if (o.component === 'hrv') {
        for (const size of HRV_SIZE_CLASSES) expect(lookupCost({ ...o, size }), `${o.option}@${size}`).not.toBeNull()
      } else {
        expect(lookupCost(o), `${o.category}/${o.component}/${o.option}`).not.toBeNull()
      }
    }
  })
  it('names the source for the headline', () => {
    expect(PRICE_SOURCE_LABEL).toBe('placeholder and Ontario 2016 (LEEP) data')
  })
})
