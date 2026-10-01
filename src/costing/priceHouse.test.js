import { priceHouse, designPicks, COSTED_CATEGORIES, overrideKey, lineOverrideKey, appliedOverrideCount } from './priceHouse'
import { appliedOverrideKeys } from './priceHouse'
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

describe('priceHouse fix round 1 (rulings R23-R26)', () => {
  const offLineCost = (r) => r.components.filter(c => c.unit !== r.unit).reduce((s, c) => s + (c.material + c.labour) * c.quantity, 0)

  it('every result in every state carries unit, quantity, perUnit, lineOverride, components and description (R23)', () => {
    const noAirflow = computeQuantities({ ...getArchetype('singleDetached').fields, bedrooms: 'moreThan5' })
    const big = computeQuantities({ ...getArchetype('singleDetached').fields, bedrooms: 'moreThan5', designedAirflowLs: 100 })
    const mini = computeQuantities(getArchetype('miniHome').fields)
    const houses = [
      priceHouse({ cards: {}, wall: null }, q, {}, 'design'),
      priceHouse({ cards: {}, wall: { kind: 'assembly', selection: { ...builtWall, assemblyType: 'doubleStud' } } }, q, {}, 'design'),
      priceHouse(typical, noAirflow, {}, 'baseline'),
      priceHouse(typical, big, {}, 'baseline'),
      priceHouse(typical, mini, {}, 'baseline'),
    ]
    const expected = {
      aboveGroundWalls: ['m2', h => h.opaqueWallM2], belowGradeWalls: ['m2', h => h.belowGradeM2], windowsDoors: ['m2', h => h.windowAreaM2],
      airTightness: ['house', () => 1], hrv: ['each', () => 1], dhw: ['each', () => 1], volume: ['house', () => 0],
    }
    const quantitiesFor = [q, q, noAirflow, big, mini]
    houses.forEach((house, i) => {
      for (const [id, [unit, qty]] of Object.entries(expected)) {
        const r = house[id]
        expect(r.unit, id).toBe(unit)
        expect(r.quantity, id).toBeCloseTo(qty(quantitiesFor[i]), 6)
        expect(r.lineOverride, id).toBeNull()
        expect(Array.isArray(r.components), id).toBe(true)
        expect(typeof r.description, id).toBe('string')
        if (r.state !== 'priced') {
          expect(r.perUnit, id).toBeNull()
          expect(r.components, id).toEqual([])
          expect(r.cost, id).toBe(0)
        }
      }
    })
    expect(houses[2].hrv.state).toBe('notPriced')
    expect(houses[3].hrv.state).toBe('notPriced')
    expect(houses[4].belowGradeWalls.state).toBe('notApplicable')
  })

  it('windows perUnit covers windows only; doors are added on top (R24 a)', () => {
    const r = priceHouse(typical, q, {}, 'baseline').windowsDoors
    const win = r.components.find(c => c.component === 'windows')
    const doors = r.components.find(c => c.component === 'doors')
    expect(r.perUnit).toBeCloseTo(win.material + win.labour, 6)
    const doorsCost = (doors.material + doors.labour) * doors.quantity
    expect(doorsCost).toBeGreaterThan(0)
    expect(r.perUnit * q.windowAreaM2 + doorsCost).toBeCloseTo(r.cost, 6)
  })

  it('a windows line override leaves the door cost in (R24 b)', () => {
    const ov = { [lineOverrideKey('design', 'windowsDoors')]: { line: 500 } }
    const r = priceHouse(typical, q, ov, 'design').windowsDoors
    const doors = r.components.find(c => c.component === 'doors')
    expect(r.lineOverride).toBe(500)
    expect(r.perUnit).toBe(500)
    expect(r.cost).toBeCloseTo(500 * q.windowAreaM2 + (doors.material + doors.labour) * doors.quantity, 6)
    expect(offLineCost(r)).toBeGreaterThan(0)
  })

  it('a line override on a quantity-1 category (hrv) (R24 c)', () => {
    const ov = { [lineOverrideKey('design', 'hrv')]: { line: 3000 } }
    const r = priceHouse(typical, q, ov, 'design').hrv
    expect(r.quantity).toBe(1)
    expect(r.lineOverride).toBe(3000)
    expect(r.perUnit).toBe(3000)
    expect(r.cost).toBe(3000)
    const baseline = priceHouse(typical, q, ov, 'baseline').hrv
    expect(baseline.lineOverride).toBeNull()
  })

  it('a sized row is overridden by priced-item id: a 45 L/s override does not apply at 30 L/s (R25)', () => {
    const key = overrideKey('design', 'hrv', 'hrv', 'sre_65_75@45')
    const ov = { [key]: { material: 1 } }
    const three = priceHouse(typical, q, ov, 'design').hrv.components[0]
    expect(three.option).toBe('sre_65_75')
    expect(three.priceId).toBe('sre_65_75@45')
    expect(three.material).toBe(1)
    expect(three.overridden.material).toBe(true)
    const q2 = computeQuantities({ ...getArchetype('singleDetached').fields, bedrooms: 2 })
    const two = priceHouse(typical, q2, ov, 'design').hrv.components[0]
    expect(two.option).toBe('sre_65_75')
    expect(two.priceId).toBe('sre_65_75@30')
    expect(two.overridden.material).toBe(false)
    expect(two.material).toBe(lookupCost({ category: 'hrv', component: 'hrv', option: 'sre_65_75', size: 30 }).material)
    const wh = priceHouse(typical, q, {}, 'design').dhw.components
    expect(wh.find(c => c.component === 'water_heater').priceId).toBe('elec_storage@50')
    expect(wh.find(c => c.component === 'circuit_240v').priceId).toBe('elec_storage')
  })

  it('a "both" framing edit is the same key in both houses (union of 1) (R26)', () => {
    const both = overrideKey('both', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const ov = { [both]: { labour: 30 } }
    const d = appliedOverrideKeys(priceHouse(typical, q, ov, 'design'))
    const b = appliedOverrideKeys(priceHouse(typical, q, ov, 'baseline'))
    expect([...d]).toEqual([both])
    expect([...b]).toEqual([both])
    expect(new Set([...d, ...b]).size).toBe(1)
  })

  it('a component override under an active line override is not in the set (R26)', () => {
    const line = lineOverrideKey('design', 'aboveGroundWalls')
    const framing = overrideKey('design', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const ov = { [line]: { line: 100 }, [framing]: { labour: 30 } }
    const keys = appliedOverrideKeys(priceHouse(typical, q, ov, 'design'))
    expect(keys.has(line)).toBe(true)
    expect(keys.has(framing)).toBe(false)
    expect(keys.size).toBe(1)
    // a door override stays applied under a windows line override: doors are not covered by the line
    const wline = lineOverrideKey('design', 'windowsDoors')
    const door = overrideKey('design', 'windowsDoors', 'doors', 'u_1_61')
    const keys2 = appliedOverrideKeys(priceHouse(typical, q, { [wline]: { line: 500 }, [door]: { material: 10 } }, 'design'))
    expect([...keys2].sort()).toEqual([door, wline].sort())
  })

  it('a side key only names the fields it supplied (R26)', () => {
    const both = overrideKey('both', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const mine = overrideKey('baseline', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const keys = appliedOverrideKeys(priceHouse(typical, q, { [both]: { labour: 30 }, [mine]: { labour: 35 } }, 'baseline'))
    expect([...keys]).toEqual([mine])
  })

  it('a "both" material override and a side labour override merge into both fields', () => {
    const both = overrideKey('both', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const mine = overrideKey('baseline', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')
    const ov = { [both]: { material: 5 }, [mine]: { labour: 7 } }
    const c = priceHouse(typical, q, ov, 'baseline').aboveGroundWalls.components[0]
    expect(c.material).toBe(5); expect(c.labour).toBe(7)
    expect(c.overridden).toEqual({ material: true, labour: true })
    const keys = appliedOverrideKeys(priceHouse(typical, q, ov, 'baseline'))
    expect([...keys].sort()).toEqual([both, mine].sort())
    const d = priceHouse(typical, q, ov, 'design').aboveGroundWalls.components[0]
    expect(d.material).toBe(5); expect(d.overridden).toEqual({ material: true, labour: false })
  })
})
