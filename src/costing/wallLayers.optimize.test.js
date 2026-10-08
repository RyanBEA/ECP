// src/costing/wallLayers.optimize.test.js
import { wallLayers } from './wallLayers'
import { describeWall } from './assumedAssemblies'
import { priceHouse } from './priceHouse'
import { computeQuantities } from './quantities'
import { resolveHouseFields } from './useHouseCost'
import { lookupCost } from '../costSystem/client'
import { scenario } from './__testing__/scenario'
import { buildSpecifics } from './specifics'

const ext = { sheathingId: 'osb_11', claddingId: 'vinyl_siding' }
const svc = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsThickness: 'None',
  hasServiceWall: true, serviceSpacing: '16"', serviceCavityMaterial: 'Fiberglass Batt', serviceCavityType: '2x4 R14', ...ext }
const ds = { wallType: 'wood', assemblyType: 'doubleStud', studSpacing: '16"', outerStud: '2x4', innerStud: '2x4', plate: '2x10', doubleStudMaterial: 'Dense Pack Cellulose', contInsThickness: 'None', ...ext }
const q = computeQuantities(resolveHouseFields('singleDetached', {}))

describe('service-cavity walls price (spec 3)', () => {
  it('adds the service studs and their batt as layers after the main cavity', () => {
    const wl = wallLayers(svc)
    expect(wl.priced).toBe(true)
    const ids = wl.layers.map(l => `${l.component}:${l.option}`)
    expect(ids).toEqual([
      'framing:stud_2x6_16oc', 'cavity_insulation:r24_batt_2x6', 'framing:stud_2x4_16oc', 'cavity_insulation:r14_batt_2x4',
      'sheathing:waferboard_osb_7_16in', 'air_vapour_barrier:poly_vapour_6mil', 'cladding:vinyl_siding', 'interior_finish:gypsum_1_2in',
    ])
    expect(wl.layers[2].label).toBe('2x4 service cavity studs @ 16 in o.c.')
  })
  it('ignores continuous insulation on a service wall, as calculateWallRsi does (review focus 1)', () => {
    const withFoam = { ...svc, contInsType: 'XPS', contInsThickness: '2"' }
    expect(wallLayers(withFoam).layers.some(l => l.component === 'continuous_insulation')).toBe(false)
    expect(wallLayers(withFoam).layers.some(l => l.component === 'strapping')).toBe(false)
  })
  it('describes in builder words', () => {
    expect(describeWall(svc)).toBe('2x6 R24 batt + 2x4 R14 service cavity, OSB, vinyl')
  })
})

describe('double-stud walls price (spec 3)', () => {
  it('prices two stud rows as one framing layer with quantityFactor 2, a plate and a deep blown-in cavity', () => {
    const wl = wallLayers(ds)
    expect(wl.priced).toBe(true)
    const framing = wl.layers.find(l => l.component === 'framing')
    expect(framing).toMatchObject({ option: 'stud_2x4_16oc', quantityFactor: 2, label: '2x4 outer and inner studs @ 16 in o.c. (two rows)' })
    expect(wl.layers.find(l => l.component === 'double_stud_plate')).toMatchObject({ option: 'plate_2x10' })
    expect(wl.layers.find(l => l.component === 'cavity_insulation')).toMatchObject({ option: 'dense_pack_cellulose_10in' })
  })
  it('has placeholder rows for every plate and every blown-in material at 8, 10 and 12 in', () => {
    for (const p of ['2x8', '2x10', '2x12']) expect(lookupCost({ category: 'aboveGroundWalls', component: 'double_stud_plate', option: `plate_${p}` })?.source).toBe('placeholder')
    for (const m of ['dense_pack_cellulose', 'loose_fill_cellulose', 'loose_fill_fiberglass']) for (const d of ['8in', '10in', '12in']) {
      expect(lookupCost({ category: 'aboveGroundWalls', component: 'cavity_insulation', option: `${m}_${d}` })?.source, `${m}_${d}`).toBe('placeholder')
    }
  })
  it('the framing layer counts twice in the line cost', () => {
    const r = priceHouse({ cards: {}, wall: { kind: 'assembly', selection: ds } }, q)
    expect(r.aboveGroundWalls.state).toBe('priced')
    const framing = r.aboveGroundWalls.components.find(c => c.component === 'framing')
    expect(framing.quantity).toBeCloseTo(q.opaqueWallM2 * 2, 6)
  })
  it('describes in builder words', () => {
    expect(describeWall(ds)).toBe('2x4 + 2x4 double stud on a 2x10 plate, dense-pack cellulose, OSB, vinyl')
  })
  it('still refuses steel, ICF and unfinished walls', () => {
    expect(wallLayers({ wallType: 'steel' }).priced).toBe(false)
    expect(wallLayers({ wallType: 'icf' }).priced).toBe(false)
    expect(wallLayers({ ...ds, plate: undefined }).priced).toBe(false)
  })
})

describe('review fixes', () => {
  it('the Layers table keeps both the main and the service framing and batt rows', () => {
    const sc = scenario({ wallSelection: svc })
    const m = buildSpecifics(sc.line('aboveGroundWalls'), sc.ctx)
    const texts = m.rows.map(r => r.design?.text)
    expect(texts).toEqual(expect.arrayContaining(['2x6 studs @ 16 in o.c.', '2x6 R24 fiberglass batt', '2x4 service cavity studs @ 16 in o.c.', '2x4 R14 fiberglass batt (service cavity)']))
    expect(m.rows.filter(r => r.item === 'Framing')).toHaveLength(2)
    expect(m.rows.filter(r => r.item === 'Cavity insulation')).toHaveLength(2)
    const shown = m.rows.reduce((t, r) => t + (r.design ? r.design.cost : 0), 0)
    expect(shown).toBeCloseTo(sc.line('aboveGroundWalls').design.cost, 6)
  })
  it('a double stud wall with a service cavity is not priced, rather than priced as a bare double stud wall', () => {
    expect(wallLayers({ ...ds, hasServiceWall: true })).toEqual({ priced: false, reason: 'double stud walls with a service cavity are not priced in this version' })
  })
  it('gives every Layers row a unique id, component plus occurrence', () => {
    const sc = scenario({ wallSelection: svc })
    const m = buildSpecifics(sc.line('aboveGroundWalls'), sc.ctx)
    const ids = m.rows.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['framing#0', 'framing#1', 'cavity_insulation#0', 'cavity_insulation#1']))
    expect(m.rows.every(r => r.key === r.id.split('#')[0])).toBe(true)
  })
  it('lists the double stud plate row, named Plates, right after Cavity insulation', () => {
    const sc = scenario({ wallSelection: ds })
    const m = buildSpecifics(sc.line('aboveGroundWalls'), sc.ctx)
    const items = m.rows.map(r => r.item)
    expect(items.indexOf('Plates')).toBe(items.indexOf('Cavity insulation') + 1)
    expect(m.rows.find(r => r.item === 'Plates').design.text).toBe('2x10 top and bottom plates')
  })
})

describe('service wall interior layer (final review I3)', () => {
  const cost = sel => priceHouse({ cards: {}, wall: { kind: 'assembly', selection: sel } }, q).aboveGroundWalls.cost
  it('an OSB interior layer adds a sheathing layer right after the service cavity rows', () => {
    const wl = wallLayers({ ...svc, interiorLayerMaterial: 'osb_11' })
    expect(wl.priced).toBe(true)
    const sheathing = wl.layers.filter(l => l.component === 'sheathing')
    expect(sheathing).toHaveLength(2)
    expect(wl.layers[4]).toMatchObject({ component: 'sheathing', option: 'waferboard_osb_7_16in' })
    expect(wl.layers[4].label).toMatch(/OSB interior layer$/)
    expect(cost({ ...svc, interiorLayerMaterial: 'osb_11' })).toBeGreaterThan(cost(svc))
  })
  it('a 2 in XPS interior layer adds a continuous_insulation layer and raises the line cost', () => {
    const sel = { ...svc, interiorLayerMaterial: 'XPS', interiorLayerThickness: '2"' }
    const wl = wallLayers(sel)
    expect(wl.priced).toBe(true)
    expect(wl.layers[4]).toMatchObject({ component: 'continuous_insulation', option: 'xps_iv_2in', label: '2 in XPS interior layer' })
    expect(cost(sel)).toBeGreaterThan(cost(svc))
    // Still no exterior foam or strapping: the interior layer is not continuous insulation on the outside.
    expect(wl.layers.some(l => l.component === 'strapping')).toBe(false)
  })
  it('an unset interior layer adds nothing, and an interior layer is ignored off a service wall', () => {
    expect(wallLayers(svc).layers).toHaveLength(8)
    const plain = { ...svc, hasServiceWall: false, interiorLayerMaterial: 'osb_11' }
    expect(wallLayers(plain).layers.filter(l => l.component === 'sheathing')).toHaveLength(1)
  })
  it('a set material that maps to nothing refuses, rather than pricing the wall without it', () => {
    expect(wallLayers({ ...svc, interiorLayerMaterial: 'unobtainium' })).toEqual({ priced: false, reason: 'interior layer not priced in this version' })
    expect(wallLayers({ ...svc, interiorLayerMaterial: 'XPS' })).toEqual({ priced: false, reason: 'interior layer not priced in this version' })
    expect(wallLayers({ ...svc, interiorLayerMaterial: 'XPS', interiorLayerThickness: '4"' }).priced).toBe(false)
  })
})

