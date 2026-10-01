// Wall selection -> priced layers (spec 4.5). Wood single stud only in this version.
// Price option ids are the ones in optionMap.js WALL_LAYER_OPTIONS (Task 4 new-id table, ruling R12): every wood
// single-stud value main's wall builder offers maps to a priced id.
import { getBoundaryOptions } from '../data/ecpData'
import wallData from '../data/generated/wall-data.json'

const boundary = getBoundaryOptions()

// cavityMaterial -> cavityType -> price id. Fiberglass and mineral wool batts of the same stud and R-value share an id.
const BATTS = {
  '2x4 R12': 'r12_batt_2x4', '2x4 R14': 'r14_batt_2x4',
  '2x6 R20': 'r20_batt_2x6', '2x6 R22': 'r22_batt_2x6', '2x6 R24': 'r24_batt_2x6',
  '2x8 R28': 'r28_batt_2x8', '2x10 R31': 'r31_batt_2x10', '2x12 R40': 'r40_batt_2x12',
}
const fill = prefix => ({ '2x4': `${prefix}_2x4`, '2x6': `${prefix}_2x6`, '2x8': `${prefix}_2x8`, '2x10': `${prefix}_2x10`, '2x12': `${prefix}_2x12` })
const CAVITY = {
  'Fiberglass Batt': BATTS,
  'Mineral Wool Batt': { '2x4 R14': 'r14_batt_2x4', '2x6 R22': 'r22_batt_2x6', '2x6 R24': 'r24_batt_2x6', '2x8 R28': 'r28_batt_2x8' },
  'Loose Fill Cellulose': fill('loose_fill_cellulose'),
  'Dense Pack Cellulose': fill('dense_pack_cellulose'),
  'Loose Fill Fiberglass': fill('loose_fill_fiberglass'),
}
// Words for the cavity in a layer label
const CAVITY_WORD = {
  'Fiberglass Batt': 'fiberglass batt', 'Mineral Wool Batt': 'mineral wool batt',
  'Loose Fill Cellulose': 'loose-fill cellulose', 'Dense Pack Cellulose': 'dense-pack cellulose', 'Loose Fill Fiberglass': 'loose-fill fiberglass',
}

const THICKNESS = { '1"': '1in', '1-1/2"': '1_5in', '2"': '2in', '2-1/2"': '2_5in', '3"': '3in' }
const CI_PREFIX = { EPS: 'eps_i', XPS: 'xps_iv', Polyiso: 'isocyanurate', PIC: 'isocyanurate', 'Mineral Wool (Rock Wool)': 'mineral_wool_rock', 'Mineral Wool (Glass Fibre)': 'mineral_wool_glass' }

const SHEATHING = { osb_11: 'waferboard_osb_7_16in', osb_9_5: 'waferboard_osb_3_8in', plywood_sw_12_5: 'plywood_particle_board_1_2in', plywood_sw_9_5: 'plywood_particle_board_3_8in', gypsum_12_7: 'gypsum_sheathing_1_2in' }
const CLADDING = { vinyl_siding: 'vinyl_siding', vinyl_insulated: 'insulated_vinyl_siding', wood_bevel_200: 'wood_bevel', wood_bevel_250: 'wood_bevel', fiber_cement: 'fiber_cement', metal_siding: 'metal_siding', brick_veneer: 'brick_veneer', stucco_19: 'stucco' }

export const inches = t => {
  if (!t || t === 'None') return 0
  const c = t.replace('"', '')
  if (c.includes('-')) { const [w, f] = c.split('-'); const [n, d] = f.split('/'); return +w + n / d }
  return parseFloat(c)
}
const ascii = s => (s || '').replace(/"/g, ' in')
const notPriced = reason => ({ priced: false, reason })

export function wallLayers(sel) {
  const s = sel || {}
  if (s.simpleIndex !== undefined && s.simpleIndex !== null) return notPriced('picked by RSI level')
  if (!s.wallType) return notPriced('no wall chosen')
  if (s.wallType === 'steel') return notPriced('steel walls are not priced in this version')
  if (s.wallType === 'icf') return notPriced('ICF walls are not priced in this version')
  if (s.wallType !== 'wood') return notPriced('wall type not priced in this version')
  if (s.assemblyType === 'doubleStud') return notPriced('double stud walls are not priced in this version')
  if (s.hasServiceWall) return notPriced('service walls are not priced in this version')
  if (!s.cavityType || !s.studSpacing || !s.cavityMaterial) return notPriced('wall not finished')
  const oc = s.studSpacing.replace('"', '')
  // The builder's own table decides the stud; a combination it does not offer has no RSI and no price.
  const entry = wallData.wood.spacings[oc]?.materials[s.cavityMaterial]?.[s.cavityType]
  if (!entry) return notPriced('wall not finished')
  const cav = CAVITY[s.cavityMaterial]?.[s.cavityType]
  if (!cav) return notPriced(`${s.cavityMaterial} is not priced in this version`)
  const stud = entry.stud
  const layers = [
    { component: 'framing', option: `stud_${stud}_${oc}oc`, label: `${stud} studs @ ${oc} in o.c.` },
    { component: 'cavity_insulation', option: cav, label: `${s.cavityType} ${CAVITY_WORD[s.cavityMaterial]}` },
  ]
  // Without a type, continuous insulation adds no RSI (calculateWallRsi), so it adds no layer either.
  const ciIn = s.contInsType ? inches(s.contInsThickness) : 0
  if (ciIn > 0) {
    const prefix = CI_PREFIX[s.contInsType]
    const t = THICKNESS[s.contInsThickness]
    if (!prefix || !t) return notPriced(`${s.contInsType} is not priced in this version`)
    const type = s.contInsType === 'PIC' ? 'Polyiso' : s.contInsType
    layers.push({ component: 'continuous_insulation', option: `${prefix}_${t}`, label: `${ascii(s.contInsThickness)} ${type}` })
  }
  const shId = s.sheathingId || boundary.sheathing.defaults.wood
  const sh = SHEATHING[shId]
  if (!sh) return notPriced('sheathing not priced')
  layers.push({ component: 'sheathing', option: sh, label: ascii(boundary.sheathing.options.find(o => o.id === shId)?.label || shId) })
  layers.push({ component: 'air_vapour_barrier', option: 'poly_vapour_6mil', label: '6 mil poly' })
  if (ciIn >= 1.5) layers.push({ component: 'strapping', option: '1x3_16oc', label: '1x3 strapping over the continuous insulation' })
  const clId = s.claddingId || boundary.cladding.defaults.wood
  const cl = CLADDING[clId]
  if (!cl) return notPriced('cladding not priced')
  layers.push({ component: 'cladding', option: cl, label: ascii(boundary.cladding.options.find(o => o.id === clId)?.label || clId) })
  layers.push({ component: 'interior_finish', option: 'gypsum_1_2in', label: '1/2 in gypsum' })
  return { priced: true, layers }
}
