// Wall selection -> priced layers (spec 4.5; Capability 2 spec 3 adds double stud and service cavity).
// Price option ids are the ones in optionMap.js WALL_LAYER_OPTIONS (Task 4 new-id table, ruling R12): every wood
// single-stud value main's wall builder offers maps to a priced id.
import { getBoundaryOptions } from '../data/ecpData'
import wallData from '../data/generated/wall-data.json'
import { ciOptionId } from './optionMap'

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

// Blown-in cavity of a double stud wall, keyed by plate: the price id names the cavity depth.
const DEEP_CAVITY = {
  'Loose Fill Cellulose': { '2x8': 'loose_fill_cellulose_8in', '2x10': 'loose_fill_cellulose_10in', '2x12': 'loose_fill_cellulose_12in' },
  'Dense Pack Cellulose': { '2x8': 'dense_pack_cellulose_8in', '2x10': 'dense_pack_cellulose_10in', '2x12': 'dense_pack_cellulose_12in' },
  'Loose Fill Fiberglass': { '2x8': 'loose_fill_fiberglass_8in', '2x10': 'loose_fill_fiberglass_10in', '2x12': 'loose_fill_fiberglass_12in' },
}
const PLATE_IN = { '2x8': '8', '2x10': '10', '2x12': '12' }

// Exterior layers shared by every wood wall: continuous insulation (with strapping from 1.5 in), sheathing,
// air/vapour barrier, cladding, interior gypsum. Returns a notPriced result or the layers to append.
function exteriorLayers(s, ciIn) {
  const layers = []
  if (ciIn > 0) {
    const ci = ciOptionId(s.contInsType, s.contInsThickness)
    if (!ci) return notPriced(`${s.contInsType} is not priced in this version`)
    const type = s.contInsType === 'PIC' ? 'Polyiso' : s.contInsType
    layers.push({ component: 'continuous_insulation', option: ci, label: `${ascii(s.contInsThickness)} ${type}` })
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
  return { layers }
}

// A stud row and its batt or blown-in fill from the wood table; `suffix` words the service cavity.
function studRow(cavityMaterial, cavityType, spacing, suffix = '') {
  const oc = (spacing || '').replace('"', '')
  const entry = wallData.wood.spacings[oc]?.materials[cavityMaterial]?.[cavityType]
  if (!entry) return notPriced('wall not finished')
  const cav = CAVITY[cavityMaterial]?.[cavityType]
  if (!cav) return notPriced(`${cavityMaterial} is not priced in this version`)
  return { layers: [
    { component: 'framing', option: `stud_${entry.stud}_${oc}oc`, label: suffix ? `${entry.stud} ${suffix} studs @ ${oc} in o.c.` : `${entry.stud} studs @ ${oc} in o.c.` },
    { component: 'cavity_insulation', option: cav, label: `${cavityType} ${CAVITY_WORD[cavityMaterial]}${suffix ? ` (${suffix})` : ''}` },
  ] }
}

export function wallLayers(sel) {
  const s = sel || {}
  if (s.simpleIndex !== undefined && s.simpleIndex !== null) return notPriced('picked by RSI level')
  if (!s.wallType) return notPriced('no wall chosen')
  if (s.wallType === 'steel') return notPriced('steel walls are not priced in this version')
  if (s.wallType === 'icf') return notPriced('ICF walls are not priced in this version')
  if (s.wallType !== 'wood') return notPriced('wall type not priced in this version')

  let core
  if (s.assemblyType === 'doubleStud') {
    const oc = (s.studSpacing || '').replace('"', '')
    if (!s.outerStud || !s.innerStud || !s.plate || !s.doubleStudMaterial || !wallData.wood.spacings[oc]) return notPriced('wall not finished')
    if (s.outerStud !== s.innerStud) return notPriced('double stud walls with different stud sizes are not priced in this version')
    const cav = DEEP_CAVITY[s.doubleStudMaterial]?.[s.plate]
    if (!cav) return notPriced(`${s.doubleStudMaterial} is not priced in this version`)
    core = { layers: [
      { component: 'framing', option: `stud_${s.outerStud}_${oc}oc`, quantityFactor: 2, label: `${s.outerStud} outer and inner studs @ ${oc} in o.c. (two rows)` },
      { component: 'double_stud_plate', option: `plate_${s.plate}`, label: `${s.plate} top and bottom plates` },
      { component: 'cavity_insulation', option: cav, label: `${PLATE_IN[s.plate]} in ${CAVITY_WORD[s.doubleStudMaterial]}` },
    ] }
  } else {
    if (!s.cavityType || !s.studSpacing || !s.cavityMaterial) return notPriced('wall not finished')
    core = studRow(s.cavityMaterial, s.cavityType, s.studSpacing)
    if (core.priced === false) return core
    if (s.hasServiceWall) {
      const svc = studRow(s.serviceCavityMaterial, s.serviceCavityType, s.serviceSpacing, 'service cavity')
      if (svc.priced === false) return svc
      core = { layers: [...core.layers, ...svc.layers] }
    }
  }
  // Without a type, continuous insulation adds no RSI (calculateWallRsi), so it adds no layer either.
  // A service wall is scored without its continuous insulation (calculateWallRsi's service path), so it is priced without it too.
  const ciIn = s.contInsType && !s.hasServiceWall ? inches(s.contInsThickness) : 0
  const ext = exteriorLayers(s, ciIn)
  if (ext.priced === false) return ext
  return { priced: true, layers: [...core.layers, ...ext.layers] }
}
