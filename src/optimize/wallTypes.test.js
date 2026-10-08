// src/optimize/wallTypes.test.js
import { WALL_TYPES, STANDARD_TYPE_ID, OWN_WALL_ID, wallCandidates, ownWallCandidate } from './wallTypes'
import { calculateWallRsi, getWallPoints } from '../data/ecpData'
import { wallLayers } from '../costing/wallLayers'

const allTypes = new Set(WALL_TYPES.map(t => t.id))
const noFoam = ['serviceCavity', 'doubleStud']

describe('curated wall types (spec 3)', () => {
  it('has the five construction types in order, standard first and locked', () => {
    expect(WALL_TYPES.map(t => t.id)).toEqual(['standard', 'thickFoam', 'largeStuds', 'serviceCavity', 'doubleStud'])
    expect(WALL_TYPES[0].locked).toBe(true)
    expect(WALL_TYPES.slice(1).every(t => !t.locked)).toBe(true)
    expect(STANDARD_TYPE_ID).toBe('standard')
  })
  it('every assembly computes an RSI and earns exactly the points it is curated for', () => {
    for (const t of WALL_TYPES) for (const a of t.assemblies) {
      const rsi = calculateWallRsi(a.selection)
      expect(rsi, `${t.id}/${a.id}`).not.toBeNull()
      expect(getWallPoints(rsi), `${t.id}/${a.id} computed RSI ${rsi}`).toBe(a.points)
    }
  })
  it('no service-cavity or double-stud assembly has exterior rigid foam', () => {
    for (const t of WALL_TYPES.filter(t => noFoam.includes(t.id))) for (const a of t.assemblies) {
      expect(a.selection.contInsType, `${t.id}/${a.id}`).toBeUndefined()
      expect(a.selection.contInsThickness, `${t.id}/${a.id}`).toBe('None')
    }
  })
  it('thin foam is under 1.5 in on the standard type; thick foam is 2 in or more', () => {
    const inches = s => (s.contInsThickness === 'None' ? 0 : parseFloat(s.contInsThickness.replace(/"/, '').replace('-1/2', '.5')))
    for (const a of WALL_TYPES[0].assemblies) expect(inches(a.selection)).toBeLessThan(1.5)
    for (const a of WALL_TYPES[1].assemblies) expect(inches(a.selection)).toBeGreaterThanOrEqual(2)
  })
  it('assembly ids are unique across all types', () => {
    const ids = WALL_TYPES.flatMap(t => t.assemblies.map(a => a.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('wallCandidates', () => {
  it('always includes the standard type, even when it is not in the ticked set', () => {
    const c = wallCandidates(new Set(), null)
    expect(c.length).toBe(WALL_TYPES[0].assemblies.length)
    expect(c.every(x => x.typeId === 'standard')).toBe(true)
  })
  it('includes exactly the ticked types', () => {
    const c = wallCandidates(new Set(['doubleStud']), null)
    expect(new Set(c.map(x => x.typeId))).toEqual(new Set(['standard', 'doubleStud']))
  })
  it('computes points per candidate and labels it in builder words', () => {
    const c = wallCandidates(allTypes, null).find(x => x.id === '2x6_r24_xps1')
    expect(c.points).toBe(7.7)
    expect(c.label).toBe('2x6 R24 batt + 1 in XPS, OSB, vinyl')
  })
  it('adds the builder\'s own complete wall as a candidate, last, flagged own', () => {
    const own = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsThickness: 'None', sheathingId: 'osb_11', claddingId: 'vinyl_siding' }
    const c = wallCandidates(new Set(), own)
    expect(c.at(-1)).toMatchObject({ id: OWN_WALL_ID, typeId: OWN_WALL_ID, own: true, points: getWallPoints(calculateWallRsi(own)) })
  })
  it('a Select RSI pick or an unfinished wall is not an own-wall candidate', () => {
    expect(ownWallCandidate({ simpleIndex: 3 })).toBeNull()
    expect(ownWallCandidate({ wallType: 'wood', assemblyType: 'single' })).toBeNull()
    expect(ownWallCandidate({})).toBeNull()
  })
  it('curated candidates take the builder\'s own sheathing and cladding when the own wall has them', () => {
    const own = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsThickness: 'None', sheathingId: 'plywood_sw_12_5', claddingId: 'fiber_cement' }
    const c = wallCandidates(new Set(), own)
    expect(c[0].selection.sheathingId).toBe('plywood_sw_12_5')
    expect(c[0].selection.claddingId).toBe('fiber_cement')
    expect(c[0].label).toMatch(/plywood, fibre cement$/)
  })
  it('every single-stud curated candidate is priceable today', () => {
    // double stud and service cavity become priceable in Task 2
    for (const c of wallCandidates(new Set(['thickFoam', 'largeStuds']), null)) expect(wallLayers(c.selection).priced, c.id).toBe(true)
  })
})
