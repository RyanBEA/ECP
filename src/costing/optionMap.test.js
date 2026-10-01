import { WALL_LAYER_OPTIONS, CARD_OPTIONS, cardOptionId, WATER_HEATER_PARTS, hrvSizeClass, HRV_SIZE_CLASSES } from './optionMap'
import { categories } from '../data/ecpData'
import { lookupCost } from '../costSystem/client'

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
    expect(hrvSizeClass({ min: 90, max: 90 })).toBe(75)
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
})
