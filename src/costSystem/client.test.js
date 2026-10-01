import { lookupCost, requestCosts, PRICE_SOURCE_LABEL, STAND_IN_ROW_COUNT, STAND_IN_KEY_COUNT } from './client'
import { WALL_LAYER_OPTIONS, CARD_OPTIONS, HRV_SIZE_CLASSES, WATER_HEATER_FUEL, WATER_HEATER_SIZES, FRAMING_STUDS, FRAMING_SPACINGS, CI_MATERIALS, CI_THICKNESSES } from '../costing/optionMap'
import rows from '../costing/data/stand-in-costs.json'

const SOURCES = ['LEEP ON', 'LEEP MB', 'LEEP BC', 'LEEP MB/BC', 'placeholder']
const wallTotal = (component, option) => {
  const r = lookupCost({ category: 'aboveGroundWalls', component, option })
  expect(r, `${component}/${option}`).not.toBeNull()
  return r.material + r.labour
}

describe('lookupCost', () => {
  it('returns a priced row synchronously', () => {
    const r = lookupCost({ category: 'aboveGroundWalls', component: 'framing', option: 'stud_2x6_16oc' })
    expect(r).not.toBeNull()
    expect(typeof r.material).toBe('number')
    expect(typeof r.labour).toBe('number')
    expect(SOURCES).toContain(r.source)
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
    expect(PRICE_SOURCE_LABEL).toBe('placeholder and LEEP 2013-2016 (Ontario, Manitoba, BC) data')
  })
  it('every row names a LEEP region or placeholder', () => {
    for (const r of rows) expect(SOURCES, `${r.component}/${r.option}`).toContain(r.source)
  })
  it('has no duplicate match keys', () => {
    expect(STAND_IN_KEY_COUNT).toBe(STAND_IN_ROW_COUNT)
  })
  it('prices every tank water heater at every size', () => {
    for (const [option, fuel] of Object.entries(WATER_HEATER_FUEL)) {
      if (option === 'tankless_092') continue
      for (const size of WATER_HEATER_SIZES) {
        expect(lookupCost({ category: 'dhw', component: 'water_heater', option, fuel, size }), `${option}@${size}`).not.toBeNull()
      }
    }
  })
  it('wraps the lookup in a promise', async () => {
    const req = { category: 'aboveGroundWalls', component: 'framing', option: 'stud_2x6_16oc' }
    await expect(requestCosts(req)).resolves.toEqual(lookupCost(req))
  })
  it('continuous insulation cost does not fall as thickness rises within a material', () => {
    for (const m of CI_MATERIALS) {
      const totals = CI_THICKNESSES.map(t => wallTotal('continuous_insulation', `${m}_${t}`))
      for (let i = 1; i < totals.length; i++) expect(totals[i], `${m} ${CI_THICKNESSES[i]}`).toBeGreaterThanOrEqual(totals[i - 1])
    }
  })
  it('framing cost does not rise as spacing widens within a stud size', () => {
    for (const s of FRAMING_STUDS) {
      const totals = FRAMING_SPACINGS.map(sp => wallTotal('framing', `stud_${s}_${sp}oc`))
      for (let i = 1; i < totals.length; i++) expect(totals[i], `${s} @ ${FRAMING_SPACINGS[i]}`).toBeLessThanOrEqual(totals[i - 1])
    }
  })
  it('batt cost does not fall as R-value rises at the same stud size', () => {
    const batts = WALL_LAYER_OPTIONS.filter(o => o.component === 'cavity_insulation')
      .map(o => o.option.match(/^r(\d+)_batt_(2x\d+)$/)).filter(Boolean)
      .map(m => ({ id: m[0], r: Number(m[1]), stud: m[2] }))
    expect(batts.length).toBeGreaterThan(5)
    for (const stud of new Set(batts.map(b => b.stud))) {
      const ladder = batts.filter(b => b.stud === stud).sort((a, b) => a.r - b.r)
      for (let i = 1; i < ladder.length; i++) {
        expect(wallTotal('cavity_insulation', ladder[i].id), ladder[i].id).toBeGreaterThanOrEqual(wallTotal('cavity_insulation', ladder[i - 1].id))
      }
    }
  })
})
