import { WALL_LAYER_OPTIONS, CARD_OPTIONS, cardOptionId, WATER_HEATER_PARTS, hrvSizeClass, HRV_SIZE_CLASSES } from './optionMap'
import { categories, studSpacingOptions, continuousInsTypes, continuousInsThicknesses } from '../data/ecpData'
import { lookupCost } from '../costSystem/client'
import wallData from '../data/generated/wall-data.json'
import continuousInsData from '../data/generated/continuous-ins.json'
import boundaryOptions from '../data/generated/boundary-options.json'

describe('optionMap', () => {
  it('maps every card option value to a price option id', () => {
    expect(cardOptionId('windowsDoors', 1.61)).toBe('u_1_61')
    expect(cardOptionId('windowsDoors', 1.44)).toBe('u_1_44')
    expect(cardOptionId('airTightness', 2.5)).toBe('ach_2_5')
    expect(cardOptionId('airTightness', 'untested')).toBe('untested')
    expect(cardOptionId('hrv', 65)).toBe('sre_65_75')
    expect(cardOptionId('belowGradeWalls', 3.46)).toBe('rsi_3_46')
    expect(cardOptionId('belowGradeWalls', 2.98)).toBe('rsi_2_98')
    expect(cardOptionId('dhwElectric', 2.35)).toBe('heat_pump')
    expect(cardOptionId('dhwGas', 0.92)).toBe('tankless_092')
    expect(cardOptionId('dhwElectric', 'electricStorage')).toBe('elec_storage')
    expect(cardOptionId('volume', 300)).toBeNull()
  })
  it('lists water-heater parts per option', () => {
    expect(WATER_HEATER_PARTS('elec_storage', 'electric').map(p => p.component)).toEqual(['water_heater', 'circuit_240v'])
    expect(WATER_HEATER_PARTS('tankless_092', 'gas').map(p => p.component)).toEqual(['water_heater', 'venting', 'condensate_drain', 'gas_branch', 'receptacle_120v'])
  })
  it('picks the smallest HRV size class covering the airflow range', () => {
    expect(HRV_SIZE_CLASSES).toEqual([30, 45, 75])
    expect(hrvSizeClass({ min: 22, max: 32 })).toBe(45)
    expect(hrvSizeClass({ min: 16, max: 24 })).toBe(30)
    expect(hrvSizeClass({ min: 60, max: 60 })).toBe(75)
    expect(hrvSizeClass({ min: 90, max: 90 })).toBeNull() // ruling R15: no nearest-size substitution
  })
  it('wall layer options cover framing, cavity, continuous insulation, sheathing, barrier, strapping, cladding, finish', () => {
    const components = new Set(WALL_LAYER_OPTIONS.map(o => o.component))
    expect([...components].sort()).toEqual(['air_vapour_barrier', 'cavity_insulation', 'cladding', 'continuous_insulation', 'framing', 'interior_finish', 'sheathing', 'strapping'])
    expect(CARD_OPTIONS.length).toBeGreaterThan(20)
  })
  it('every card option value on ecpData has a price id and a priced row', () => {
    // Guards against a card value with no price (controller ruling R7)
    const priceCategory = id => (id === 'dhwElectric' || id === 'dhwGas' ? 'dhw' : id)
    for (const category of categories) {
      if (category.id === 'volume' || category.id === 'aboveGroundWalls') continue
      for (const { value } of category.options) {
        const id = cardOptionId(category.id, value)
        expect(id, `${category.id}=${value}`).not.toBeNull()
        const entries = CARD_OPTIONS.filter(o => o.category === priceCategory(category.id) && o.option === id)
        expect(entries.length, `${category.id}=${value} -> ${id} in CARD_OPTIONS`).toBeGreaterThan(0)
        if (category.id === 'windowsDoors') {
          expect(entries.map(o => o.component).sort(), `${category.id}=${value}`).toEqual(['doors', 'windows'])
        }
        for (const o of entries) {
          if (o.component === 'hrv') {
            for (const size of HRV_SIZE_CLASSES) expect(lookupCost({ ...o, size }), `${category.id}=${value} -> ${id}@${size}`).not.toBeNull()
          } else {
            expect(lookupCost(o), `${category.id}=${value} -> ${o.component}/${id}`).not.toBeNull()
          }
        }
      }
    }
  })
  it('every wood single-stud option the wall builder offers has a priced row (ruling R12)', () => {
    // Builder value -> price option id, the table in the Task 4 report that wallLayers.js maps to
    const batt = t => { const [stud, r] = t.split(' '); return `${r.toLowerCase()}_batt_${stud}` }
    const CAVITY = {
      'Fiberglass Batt': batt, 'Mineral Wool Batt': batt,
      'Loose Fill Cellulose': t => `loose_fill_cellulose_${t}`,
      'Dense Pack Cellulose': t => `dense_pack_cellulose_${t}`,
      'Loose Fill Fiberglass': t => `loose_fill_fiberglass_${t}`,
    }
    const CI_MATERIAL = { EPS: 'eps_i', XPS: 'xps_iv', Polyiso: 'isocyanurate', 'Mineral Wool (Rock Wool)': 'mineral_wool_rock', 'Mineral Wool (Glass Fibre)': 'mineral_wool_glass' }
    const CI_THICKNESS = { '1"': '1in', '1-1/2"': '1_5in', '2"': '2in', '2-1/2"': '2_5in', '3"': '3in' }
    const SHEATHING = { osb_11: 'waferboard_osb_7_16in', osb_9_5: 'waferboard_osb_3_8in', plywood_sw_12_5: 'plywood_particle_board_1_2in', plywood_sw_9_5: 'plywood_particle_board_3_8in', gypsum_12_7: 'gypsum_sheathing_1_2in' }
    const CLADDING = { vinyl_siding: 'vinyl_siding', vinyl_insulated: 'insulated_vinyl_siding', wood_bevel_200: 'wood_bevel', wood_bevel_250: 'wood_bevel', fiber_cement: 'fiber_cement', metal_siding: 'metal_siding', brick_veneer: 'brick_veneer', stucco_19: 'stucco' }
    const wanted = []
    for (const { label } of studSpacingOptions) {
      const sp = label.replace('"', '')
      const materials = wallData.wood.spacings[sp].materials
      for (const [mat, types] of Object.entries(materials)) {
        for (const [type, e] of Object.entries(types)) {
          wanted.push(['framing', `stud_${e.stud}_${sp}oc`, `${label} ${type}`])
          wanted.push(['cavity_insulation', CAVITY[mat](type), `${mat} ${type}`])
        }
      }
    }
    for (const type of continuousInsTypes) {
      for (const t of continuousInsThicknesses.filter(x => x !== 'None')) {
        expect(continuousInsData[type].thicknesses[t], `${type} ${t}`).toBeDefined()
        wanted.push(['continuous_insulation', `${CI_MATERIAL[type]}_${CI_THICKNESS[t]}`, `${type} ${t}`])
      }
    }
    for (const o of boundaryOptions.sheathing.options) wanted.push(['sheathing', SHEATHING[o.id], o.id])
    for (const o of boundaryOptions.cladding.options) wanted.push(['cladding', CLADDING[o.id], o.id])
    const offered = new Set(WALL_LAYER_OPTIONS.map(o => `${o.component}/${o.option}`))
    for (const [component, option, from] of wanted) {
      expect(offered.has(`${component}/${option}`), `${from} -> ${component}/${option} in WALL_LAYER_OPTIONS`).toBe(true)
      expect(lookupCost({ category: 'aboveGroundWalls', component, option }), `${from} -> ${component}/${option}`).not.toBeNull()
    }
  })
})
