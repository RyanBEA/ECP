import { LEVER_CARDS, cardOptions, defaultConsider, toggleConsider, buildCandidates } from './candidates'
import { WALL_TYPES } from './wallTypes'
import { computeQuantities } from '../costing/quantities'
import { resolveHouseFields } from '../costing/useHouseCost'
import { MORE_THAN_5 } from '../costing/quantities'

const q = computeQuantities(resolveHouseFields('singleDetached', {}))
const qMini = computeQuantities(resolveHouseFields('miniHome', {}))

describe('cardOptions', () => {
  it('lists the code-minimum value first, then the card options, in builder words', () => {
    expect(cardOptions('windowsDoors').map(o => o.value)).toEqual([1.61, 1.44, 1.22])
    expect(cardOptions('windowsDoors')[0]).toMatchObject({ points: 0, pickCard: 'windowsDoors', label: 'U 1.61 (double glazed), code minimum' })
    expect(cardOptions('airTightness').map(o => o.value)).toEqual(['untested', 2.5, 2.0, 1.5, 1.0, 0.6])
    expect(cardOptions('belowGradeWalls').map(o => o.value)).toEqual([2.98, 3.09, 3.46, 3.9])
    expect(cardOptions('hrv').map(o => o.value)).toEqual([60, 65, 75])
  })
  it('merges the two water heater cards into one dhw card, electric storage first', () => {
    const o = cardOptions('dhw')
    expect(o.map(x => x.value)).toEqual(['electricStorage', 2.35, 0.79, 0.83, 0.85, 0.92])
    expect(o[0].pickCard).toBe('dhwElectric'); expect(o[1].pickCard).toBe('dhwElectric'); expect(o[2].pickCard).toBe('dhwGas')
    expect(o[1].points).toBe(3.8); expect(o[3].points).toBe(4.9)
  })
  it('lists the wall construction types for above-ground walls, standard locked', () => {
    const o = cardOptions('aboveGroundWalls')
    expect(o.map(x => x.value)).toEqual(WALL_TYPES.map(t => t.id))
    expect(o[0].locked).toBe(true)
  })
})

describe('consider state', () => {
  it('starts with everything ticked', () => {
    const c = defaultConsider()
    expect(Object.keys(c)).toEqual(LEVER_CARDS)
    for (const id of LEVER_CARDS) expect(c[id].size).toBe(cardOptions(id).length)
  })
  it('toggles a value off and on without mutating', () => {
    const c = defaultConsider()
    const off = toggleConsider(c, 'airTightness', 0.6)
    expect(off.airTightness.has(0.6)).toBe(false)
    expect(c.airTightness.has(0.6)).toBe(true)
    expect(toggleConsider(off, 'airTightness', 0.6).airTightness.has(0.6)).toBe(true)
  })
  it('never unticks the standard wall type', () => {
    const c = toggleConsider(defaultConsider(), 'aboveGroundWalls', 'standard')
    expect(c.aboveGroundWalls.has('standard')).toBe(true)
  })
})

describe('buildCandidates', () => {
  it('prices every allowed option for this house and keeps only priced ones', () => {
    const { cards, leftOut, unavailable } = buildCandidates(defaultConsider(), { wallSelection: {}, quantities: q })
    expect(leftOut).toEqual([]); expect(unavailable).toEqual([])
    expect(Object.keys(cards)).toEqual(LEVER_CARDS)
    for (const list of Object.values(cards)) for (const c of list) {
      expect(typeof c.cost).toBe('number'); expect(typeof c.points).toBe('number'); expect(c.label).toBeTruthy()
    }
    expect(cards.windowsDoors.map(c => c.value)).toEqual([1.61, 1.44, 1.22])
    expect(cards.aboveGroundWalls.length).toBe(WALL_TYPES.reduce((n, t) => n + t.assemblies.length, 0))
  })
  it('respects unticked options and reports a card with nothing ticked as left out', () => {
    let c = defaultConsider()
    c = toggleConsider(c, 'windowsDoors', 1.22)
    for (const v of [60, 65, 75]) c = toggleConsider(c, 'hrv', v)
    const { cards, leftOut } = buildCandidates(c, { wallSelection: {}, quantities: q })
    expect(cards.windowsDoors.map(x => x.value)).toEqual([1.61, 1.44])
    expect(cards.hrv).toBeUndefined()
    expect(leftOut).toEqual(['hrv'])
  })
  it('reports below-grade walls as unavailable for a house with no foundation wall', () => {
    const { cards, unavailable } = buildCandidates(defaultConsider(), { wallSelection: {}, quantities: qMini })
    expect(cards.belowGradeWalls).toBeUndefined()
    expect(unavailable).toEqual([{ cardId: 'belowGradeWalls', reason: 'not applicable (no foundation wall)' }])
  })
  it('reports ventilation as unavailable when the airflow is unknown', () => {
    const q6 = computeQuantities(resolveHouseFields('singleDetached', { singleDetached: { bedrooms: MORE_THAN_5 } }))
    const { cards, unavailable } = buildCandidates(defaultConsider(), { wallSelection: {}, quantities: q6 })
    expect(cards.hrv).toBeUndefined()
    expect(unavailable[0]).toMatchObject({ cardId: 'hrv' })
    expect(unavailable[0].reason).toMatch(/airflow/)
  })
  it('includes the builder\'s own wall as a candidate and applies price overrides', () => {
    const own = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsThickness: 'None', sheathingId: 'osb_11', claddingId: 'vinyl_siding' }
    const plain = buildCandidates(defaultConsider(), { wallSelection: own, quantities: q })
    const ownCand = plain.cards.aboveGroundWalls.find(c => c.id === 'own')
    expect(ownCand).toBeDefined()
    const overrides = { 'design/aboveGroundWalls/framing/stud_2x6_16oc': { material: 100 } }
    const dear = buildCandidates(defaultConsider(), { wallSelection: own, quantities: q, overrides })
    expect(dear.cards.aboveGroundWalls.find(c => c.id === 'own').cost).toBeGreaterThan(ownCand.cost)
  })
})
