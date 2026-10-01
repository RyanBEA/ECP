import { priceHouse, designPicks, COSTED_CATEGORIES, overrideKey, lineOverrideKey, appliedOverrideCount } from './priceHouse'
import { computeQuantities } from './quantities'
import { getArchetype } from './archetypes'
import { getPresetPicks } from './baselines'
import { lookupCost } from '../costSystem/client'

const q = computeQuantities(getArchetype('singleDetached').fields)
const typical = getPresetPicks('typicalTier2', 'singleDetached')
const builtWall = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsType: 'Polyiso', contInsThickness: '2"' }

describe('priceHouse', () => {
  it('prices every costed category of the typical house', () => {
    const r = priceHouse(typical, q, {}, 'baseline')
    for (const id of COSTED_CATEGORIES) expect(r[id].state, id).toBe('priced')
    expect(r.volume.state).toBe('notCosted')
    expect(r.aboveGroundWalls.assumed).toBe(false)   // typical wall is an assembly
    expect(r.aboveGroundWalls.unit).toBe('m2')
    expect(r.aboveGroundWalls.quantity).toBeCloseTo(q.opaqueWallM2, 6)
    expect(r.aboveGroundWalls.cost).toBeCloseTo(r.aboveGroundWalls.perUnit * q.opaqueWallM2, 2)
    expect(r.belowGradeWalls.assumed).toBe(true)
    expect(r.hrv.components[0].option).toBe('sre_65_75')
    expect(r.hrv.components[0].quantity).toBe(1)
    expect(r.dhw.components.map(c => c.component)).toEqual(['water_heater', 'circuit_240v'])
  })
  it('prices a Select RSI wall as an assumed assembly and says so', () => {
    const r = priceHouse({ cards: {}, wall: { kind: 'level', rsi: 3.96 } }, q, {}, 'design')
    expect(r.aboveGroundWalls.state).toBe('priced')
    expect(r.aboveGroundWalls.assumed).toBe(true)
    expect(r.aboveGroundWalls.description).toMatch(/RSI 3.96, assumed assembly: 2x6 R24 batt \+ 1 in XPS/)
  })
  it('marks unsupported walls not priced with the reason', () => {
    const r = priceHouse({ cards: {}, wall: { kind: 'assembly', selection: { ...builtWall, assemblyType: 'doubleStud' } } }, q, {}, 'design')
    expect(r.aboveGroundWalls.state).toBe('notPriced')
    expect(r.aboveGroundWalls.reason).toMatch(/double stud/)
  })
  it('marks missing design cards unselected and mini-home below grade not applicable', () => {
    const r = priceHouse({ cards: {}, wall: null }, q, {}, 'design')
    expect(r.windowsDoors.state).toBe('unselected')
    expect(r.aboveGroundWalls.state).toBe('unselected')
    const mini = computeQuantities(getArchetype('miniHome').fields)
    expect(priceHouse(typical, mini, {}, 'baseline').belowGradeWalls.state).toBe('notApplicable')
  })
  it('converts Points selections (indices) to picks', () => {
    const p = designPicks({ windowsDoors: 1, hrv: 2, dhwGas: 3, airTightness: 1 }, builtWall)
    expect(p.cards).toEqual({ windowsDoors: 1.22, hrv: 75, dhwGas: 0.92, airTightness: 2.0 })
    expect(p.wall).toEqual({ kind: 'assembly', selection: builtWall })
    expect(designPicks({}, { simpleIndex: 3 }).wall).toEqual({ kind: 'level', rsi: 3.96 })
    expect(designPicks({}, {}).wall).toBeNull()
  })
  it('applies an override only while its option is priced on that side (Review Focus 2)', () => {
    const key = overrideKey('design', 'aboveGroundWalls', 'continuous_insulation', 'xps_iv_1in')
    const ov = { [key]: { material: 99 } }
    const withXps = priceHouse({ cards: {}, wall: { kind: 'assembly', selection: { ...builtWall, contInsType: 'XPS', contInsThickness: '1"' } } }, q, ov, 'design')
    const ci = withXps.aboveGroundWalls.components.find(c => c.component === 'continuous_insulation')
    expect(ci.material).toBe(99); expect(ci.overridden.material).toBe(true)
    expect(appliedOverrideCount(withXps)).toBe(1)
    const withPolyiso = priceHouse({ cards: {}, wall: { kind: 'assembly', selection: builtWall } }, q, ov, 'design')
    const ci2 = withPolyiso.aboveGroundWalls.components.find(c => c.component === 'continuous_insulation')
    expect(ci2.overridden.material).toBe(false)
    expect(ci2.material).toBe(lookupCost({ category: 'aboveGroundWalls', component: 'continuous_insulation', option: 'isocyanurate_2in' }).material)
    expect(appliedOverrideCount(withPolyiso)).toBe(0)
  })
  it('a "both" override applies to either side; a side override wins over it', () => {
    const both = overrideKey('both', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const mine = overrideKey('baseline', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const ov = { [both]: { labour: 30 }, [mine]: { labour: 35 } }
    const d = priceHouse(typical, q, ov, 'design').aboveGroundWalls.components[0]
    const b = priceHouse(typical, q, ov, 'baseline').aboveGroundWalls.components[0]
    expect(d.labour).toBe(30); expect(b.labour).toBe(35)
  })
  it('a line override replaces the per-unit figure for that side', () => {
    const ov = { [lineOverrideKey('design', 'aboveGroundWalls')]: { line: 100 } }
    const r = priceHouse(typical, q, ov, 'design').aboveGroundWalls
    expect(r.lineOverride).toBe(100)
    expect(r.perUnit).toBe(100)
    expect(r.cost).toBeCloseTo(100 * q.opaqueWallM2, 2)
  })
  it('an airflow above the largest HRV size is not priced, with the reason (ruling R22)', () => {
    const big = computeQuantities({ ...getArchetype('singleDetached').fields, bedrooms: 'moreThan5', designedAirflowLs: 100 })
    const r = priceHouse(typical, big, {}, 'baseline').hrv
    expect(r.state).toBe('notPriced')
    expect(r.reason).toBe('airflow above the largest HRV size priced in this version')
    expect(r.components).toEqual([])
    expect(r.cost).toBe(0)
  })
})
