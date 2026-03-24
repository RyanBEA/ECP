import { describe, it, expect } from 'vitest'
import { loadMaterials } from './loadMaterials.js'

const m = loadMaterials()

describe('loadMaterials', () => {
  it('loads all material groups', () => {
    expect(m.framing).toBeDefined()
    expect(m.cavity).toBeDefined()
    expect(m.continuous).toBeDefined()
    expect(m.boundary).toBeDefined()
    expect(m.icf).toBeDefined()
  })

  it('has correct wood stud dimensions', () => {
    expect(m.framing.wood.studs['2x4'].depth_mm).toBe(89)
    expect(m.framing.wood.studs['2x6'].depth_mm).toBe(140)
    expect(m.framing.wood.studs['2x8'].depth_mm).toBe(184)
    expect(m.framing.wood.studs['2x10'].depth_mm).toBe(235)
    expect(m.framing.wood.studs['2x12'].depth_mm).toBe(286)
  })

  it('has correct steel stud dimensions', () => {
    expect(m.framing.steel.studs['2x3-5/8'].depth_mm).toBe(92.075)
    expect(m.framing.steel.studs['2x6'].depth_mm).toBe(152)
  })

  it('has cavity RSI for fiberglass batt', () => {
    const fg = m.cavity.fiberglass_batt
    expect(fg.label).toBe('Fiberglass Batt')
    expect(fg.type).toBe('batt')
    const r20 = fg.cavities.find(c => c.id === '2x6 R20')
    expect(r20.wood_rsi).toBe(3.34)
    expect(r20.steel_rsi).toBe(3.52)
  })

  it('has RSI per mm for blown-in materials', () => {
    expect(m.cavity.dense_pack_cellulose.rsi_per_mm).toBe(0.024)
    expect(m.cavity.loose_fill_cellulose.rsi_per_mm).toBe(0.025)
    // Loose fill fiberglass uses depth_specific, not a single rsi_per_mm
    expect(m.cavity.loose_fill_fiberglass.depth_specific[89].rsi_per_mm).toBe(0.02865)
    expect(m.cavity.loose_fill_fiberglass.rsi_per_mm_deep).toBe(0.029)
  })

  it('has continuous insulation thicknesses with RSI', () => {
    const eps = m.continuous.eps
    expect(eps.thicknesses[0].label).toBe('1"')
    expect(eps.thicknesses[0].rsi).toBe(0.65)
  })

  it('has boundary layer options for sheathing', () => {
    const sh = m.boundary.sheathing
    expect(sh.selectable).toBe(true)
    const osb = sh.options.find(o => o.id === 'osb_11')
    expect(osb.rsi).toBe(0.108)
  })

  it('has boundary layer options for cladding', () => {
    const cl = m.boundary.cladding
    expect(cl.selectable).toBe(true)
    const vinyl = cl.options.find(o => o.id === 'vinyl_siding')
    expect(vinyl.rsi).toBe(0.11)
  })

  it('has ICF properties', () => {
    expect(m.icf.eps_rsi_per_mm).toBe(0.026)
    expect(m.icf.concrete_core_mm).toBe(152.4)
    expect(m.icf.forms).toHaveLength(3)
  })
})
