// Controller-mandated coverage test (ruling R12): every wood single-stud wall main's builder can emit is fully
// priced by wallLayers, and every layer it returns has a row in the stand-in cost table.
import { wallLayers } from './wallLayers'
import { studSpacingOptions, continuousInsTypes, continuousInsThicknesses, getBoundaryOptions } from '../data/ecpData'
import { lookupCost } from '../costSystem/client'
import wallData from '../data/generated/wall-data.json'

const boundary = getBoundaryOptions()

// Expected ids, from the Task 4 report's new-id table
const batt = t => { const [stud, r] = t.split(' '); return `${r.toLowerCase()}_batt_${stud}` }
const CAVITY = {
  'Fiberglass Batt': batt, 'Mineral Wool Batt': batt,
  'Loose Fill Cellulose': t => `loose_fill_cellulose_${t}`,
  'Dense Pack Cellulose': t => `dense_pack_cellulose_${t}`,
  'Loose Fill Fiberglass': t => `loose_fill_fiberglass_${t}`,
}
const CI_MATERIAL = { EPS: 'eps_i', XPS: 'xps_iv', Polyiso: 'isocyanurate', 'Mineral Wool (Rock Wool)': 'mineral_wool_rock', 'Mineral Wool (Glass Fibre)': 'mineral_wool_glass' }
const CI_THICKNESS = { '1"': '1in', '1-1/2"': '1_5in', '2"': '2in', '2-1/2"': '2_5in', '3"': '3in' }

function expectFullyPriced(sel, from) {
  const r = wallLayers(sel)
  expect(r.priced, `${from}: ${r.reason}`).toBe(true)
  for (const l of r.layers) {
    expect(lookupCost({ category: 'aboveGroundWalls', component: l.component, option: l.option }), `${from} -> ${l.component}/${l.option}`).not.toBeNull()
  }
  return r
}
const opt = (r, component) => r.layers.find(l => l.component === component)?.option

describe('wall coverage (ruling R12)', () => {
  it('prices every wood single-stud spacing x cavity x continuous insulation combination', () => {
    let n = 0
    for (const { label: studSpacing } of studSpacingOptions) {
      const sp = studSpacing.replace('"', '')
      for (const [cavityMaterial, types] of Object.entries(wallData.wood.spacings[sp].materials)) {
        for (const [cavityType, e] of Object.entries(types)) {
          const base = { wallType: 'wood', assemblyType: 'single', studSpacing, cavityMaterial, cavityType }
          const cis = [
            { contInsType: undefined, contInsThickness: 'None' },
            ...continuousInsTypes.flatMap(contInsType => continuousInsThicknesses.filter(t => t !== 'None').map(contInsThickness => ({ contInsType, contInsThickness }))),
          ]
          for (const ci of cis) {
            const sel = { ...base, ...ci }
            const from = `${studSpacing} ${cavityMaterial} ${cavityType} ${ci.contInsType ?? ''} ${ci.contInsThickness}`
            const r = expectFullyPriced(sel, from)
            expect(opt(r, 'framing'), from).toBe(`stud_${e.stud}_${sp}oc`)
            expect(opt(r, 'cavity_insulation'), from).toBe(CAVITY[cavityMaterial](cavityType))
            expect(opt(r, 'continuous_insulation'), from).toBe(ci.contInsType ? `${CI_MATERIAL[ci.contInsType]}_${CI_THICKNESS[ci.contInsThickness]}` : undefined)
            n++
          }
        }
      }
    }
    expect(n).toBeGreaterThan(2000)
  })
  it('prices every sheathing and cladding option on a fixed wall', () => {
    const wall = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsType: 'XPS', contInsThickness: '1"' }
    for (const o of boundary.sheathing.options) expectFullyPriced({ ...wall, sheathingId: o.id }, `sheathing ${o.id}`)
    for (const o of boundary.cladding.options) expectFullyPriced({ ...wall, claddingId: o.id }, `cladding ${o.id}`)
  })
})
