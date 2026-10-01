// Builds src/costing/data/stand-in-costs.json: HTAP (LEEP) wall rows where they exist, placeholders elsewhere.
// Run: npm run build:costs. Input: /srv/clients/BTZx/cost-DB-and-ECP/25_Working/made-up-numbers-db/htap-walls-mapped.json
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WALL_LAYER_OPTIONS, CARD_OPTIONS, HRV_SIZE_CLASSES, WATER_HEATER_SIZES } from '../src/costing/optionMap.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const HTAP = '/srv/clients/BTZx/cost-DB-and-ECP/25_Working/made-up-numbers-db/htap-walls-mapped.json'
const OUT = path.join(here, '..', 'src', 'costing', 'data', 'stand-in-costs.json')
const SQFT_PER_M2 = 10.76391042

const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r2 = x => Math.round(x * 100) / 100

// HTAP: group atomic rows with labour > 0 by target_id; prices are $/sq ft applied -> $/m2
const htap = JSON.parse(fs.readFileSync(HTAP, 'utf8')).rows
  .filter(r => r.kind === 'atomic' && r.labour > 0 && r.target_id.startsWith('wall.'))
const byId = {}
for (const r of htap) {
  (byId[r.target_id] ||= { material: [], labour: [], description: r.description }).material.push(r.material)
  byId[r.target_id].labour.push(r.labour)
}
const htapRow = (component, option) => {
  const comp = component === 'air_vapour_barrier' ? 'control_layer' : component
  const hit = byId[`wall.${comp}.${option}`]
  if (!hit) return null
  return { material: r2(median(hit.material) * SQFT_PER_M2), labour: r2(median(hit.labour) * SQFT_PER_M2), priced_item: hit.description, source: 'LEEP ON 2016' }
}

// Placeholder scales (invented, $/m2 or $ each) so the proof of concept has a number in every box
const PH_WALL = { framing: [18, 22], cavity_insulation: [8, 4], continuous_insulation: [16, 8], sheathing: [6, 5], air_vapour_barrier: [1, 2], strapping: [2, 3], cladding: [5, 7], interior_finish: [1.5, 2] }
const PH_CARD = {
  'windows/u_1_61': [565, 95], 'windows/u_1_44': [640, 95], 'windows/u_1_22': [760, 95],
  'doors/u_1_61': [900, 250], 'doors/u_1_44': [1050, 250], 'doors/u_1_22': [1300, 250],
  'airtightness/untested': [0, 0], 'airtightness/ach_2_5': [150, 350], 'airtightness/ach_2': [600, 1400], 'airtightness/ach_1_5': [1100, 2600], 'airtightness/ach_1': [1800, 4200], 'airtightness/ach_0_6': [2800, 6500],
  'foundation_assembly/rsi_2_98': [60, 55], 'foundation_assembly/rsi_3_09': [64, 57], 'foundation_assembly/rsi_3_46': [72, 60], 'foundation_assembly/rsi_3_9': [84, 66],
}
const PH_HRV = { sre_60_65: 1450, sre_65_75: 1900, sre_75_84: 2600 }
const PH_WH = { // material by size index for tanks; single value for tankless
  elec_storage: [850, 950, 1100, 1350], heat_pump: [2700, 2900, 3100, 3700], rdc_079: [3700, 3900, 4200, 4900],
  rdc_085: [4300, 4500, 4800, 5500], res_083: [3300, 3500, 3800, 4300], tankless_092: 2900,
}
const PH_PART = { circuit_240v: [200, 250], condensate_drain: [130, 120], venting: [180, 220], gas_branch: [100, 180], receptacle_120v: [40, 60] }

const rows = []
for (const o of WALL_LAYER_OPTIONS) {
  const h = htapRow(o.component, o.option)
  const [m, l] = PH_WALL[o.component]
  rows.push({ category: 'aboveGroundWalls', component: o.component, option: o.option, fuel: null, size: null, sizeUnit: null, unit: 'm2',
    ...(h || { material: m, labour: l, priced_item: o.label, source: 'placeholder' }) })
}
for (const o of CARD_OPTIONS) {
  if (o.component === 'hrv') {
    HRV_SIZE_CLASSES.forEach((size, i) => rows.push({ ...o, size, sizeUnit: 'L/s', unit: 'each', material: PH_HRV[o.option] + i * 350, labour: 900 + i * 50, priced_item: `HRV, ${o.option.replace('sre_', 'SRE ').replace('_', '-')}%, ${size} L/s`, source: 'placeholder' }))
  } else if (o.category === 'dhw' && o.component === 'water_heater') {
    if (o.option === 'tankless_092') rows.push({ ...o, size: null, sizeUnit: null, unit: 'each', material: PH_WH[o.option], labour: 800, priced_item: 'Condensing tankless, UEF 0.92', source: 'placeholder' })
    else WATER_HEATER_SIZES.forEach((size, i) => rows.push({ ...o, size, sizeUnit: 'gal', unit: 'each', material: PH_WH[o.option][i], labour: 350 + i * 50, priced_item: `${o.option} ${size} gal`, source: 'placeholder' }))
  } else if (o.category === 'dhw') {
    const [m, l] = PH_PART[o.component]
    rows.push({ ...o, sizeUnit: null, unit: 'each', material: m, labour: l, priced_item: o.component.replace(/_/g, ' '), source: 'placeholder' })
  } else {
    const [m, l] = PH_CARD[`${o.component}/${o.option}`]
    const unit = o.category === 'windowsDoors' ? (o.component === 'doors' ? 'each' : 'm2') : o.category === 'airTightness' ? 'house' : 'm2'
    rows.push({ ...o, sizeUnit: null, unit, material: m, labour: l, priced_item: `${o.component} ${o.option}`.replace(/_/g, ' '), source: 'placeholder' })
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1))
console.log(`wrote ${rows.length} rows to ${OUT} (${rows.filter(r => r.source !== 'placeholder').length} from LEEP/HTAP)`)
