import { wallLayers } from './wallLayers'

const wood = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsType: 'XPS', contInsThickness: '1"' }

describe('wallLayers', () => {
  it('maps a wood single-stud wall with 1 in XPS to layers without strapping', () => {
    const r = wallLayers(wood)
    expect(r.priced).toBe(true)
    expect(r.layers.map(l => l.component)).toEqual(['framing', 'cavity_insulation', 'continuous_insulation', 'sheathing', 'air_vapour_barrier', 'cladding', 'interior_finish'])
    expect(r.layers[0].option).toBe('stud_2x6_16oc')
    expect(r.layers[1].option).toBe('r24_batt_2x6')
    expect(r.layers[2].option).toBe('xps_iv_1in')
    expect(r.layers[3].option).toBe('waferboard_osb_7_16in')  // boundary default applied
    expect(r.layers[5].option).toBe('vinyl_siding')
  })
  it('adds strapping at 1-1/2 in and above', () => {
    expect(wallLayers({ ...wood, contInsThickness: '1-1/2"' }).layers.map(l => l.component)).toContain('strapping')
    expect(wallLayers({ ...wood, contInsThickness: '2"', contInsType: 'Polyiso' }).layers.find(l => l.component === 'continuous_insulation').option).toBe('isocyanurate_2in')
  })
  it('omits continuous insulation when None', () => {
    expect(wallLayers({ ...wood, contInsThickness: 'None' }).layers.map(l => l.component)).not.toContain('continuous_insulation')
  })
  it('refuses unsupported wall types with a reason', () => {
    expect(wallLayers({ ...wood, assemblyType: 'doubleStud' })).toEqual({ priced: false, reason: 'double stud walls are not priced in this version' })
    expect(wallLayers({ ...wood, hasServiceWall: true }).priced).toBe(false)
    expect(wallLayers({ wallType: 'icf', icfFormThickness: '2.5"' }).priced).toBe(false)
    expect(wallLayers({ wallType: 'steel' }).priced).toBe(false)
    expect(wallLayers({}).priced).toBe(false)
    expect(wallLayers({ simpleIndex: 3 }).priced).toBe(false)
  })
})
