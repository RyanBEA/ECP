import { scenario } from './__testing__/scenario'
import { buildSpecifics, basicViewText, signedDollars, diffClass, OVERHEAD_SENTENCE } from './specifics'
import { houseNoun, shapeSentence } from './houseText'
import { SQFT_PER_M2 } from './units'

const model = (s, id) => buildSpecifics(s.line(id), s.ctx)
const items = m => m.rows.map(r => r.item)

describe('money helpers', () => {
  it('signs whole dollars and classes them', () => {
    expect(signedDollars(108.4)).toBe('+$108')
    expect(signedDollars(-1034.8)).toBe('-$1,035')
    expect(signedDollars(0.4)).toBe('$0')
    expect([diffClass(5), diffClass(-5), diffClass(0.2)]).toEqual(['more', 'less', ''])
  })
})

describe('houseText', () => {
  it('names the house and its shape', () => {
    expect(houseNoun('Single detached')).toBe('single detached house')
    expect(houseNoun('Mini-home')).toBe('mini-home')
    expect(shapeSentence({ typeName: 'Single detached', houseFields: { lengthFt: 33, widthFt: 30 } }))
      .toBe('Based on a single detached house, 33 x 30 ft (10.1 x 9.1 m); other shapes will differ.')
  })
})

describe('buildSpecifics: above-ground walls', () => {
  const s = scenario({ wallSelection: { simpleIndex: 4 } })   // RSI 4.29 level vs Typical Tier 2's 3.99 assembly
  const m = model(s, 'aboveGroundWalls')
  it('lists every layer inside to outside, and the strapping only this design has', () => {
    expect(m.label).toBe('Layers')
    expect(m.firstCol).toBe('Layer')
    expect(items(m)).toEqual(['Interior finish', 'Air/vapour barrier', 'Framing', 'Cavity insulation', 'Sheathing', 'Continuous insulation', 'Strapping', 'Cladding'])
    expect(m.rows.filter(r => !r.same).map(r => r.item)).toEqual(['Cavity insulation', 'Continuous insulation', 'Strapping'])
    expect(m.rows.find(r => r.item === 'Strapping').baseline).toBeNull()
    expect(m.specRows).toEqual([])
    expect(m.summary).toBe('8 layers, 3 differ')
  })
  it('same rows carry no difference; differing rows carry this house in dollars', () => {
    for (const r of m.rows.filter(r => r.same)) expect(r.diff).toBe(0)
    const sum = m.rows.reduce((t, r) => t + r.diff, 0)
    expect(Math.abs(sum - m.footer.diff)).toBeLessThan(0.01)
    expect(m.footer.diff).toBeCloseTo(s.line('aboveGroundWalls').design.cost - s.line('aboveGroundWalls').baseline.cost, 6)
  })
  it('the per sq ft footer is the sum of the displayed row prices', () => {
    expect(m.footer.kind).toBe('perSqFt')
    const shown = side => m.rows.filter(r => r[side]).reduce((t, r) => t + Number(r[side].price.replace(/[^\d.]/g, '')), 0)
    expect(m.footer.designPerUnit).toBeCloseTo(shown('design'), 6)
    expect(m.footer.baselinePerUnit).toBeCloseTo(shown('baseline'), 6)
    expect(m.footer.quantityText).toMatch(/^x [\d,]+ sq ft$/)
    expect(m.rows[0].design.price).toMatch(/^\$\d+\.\d\d \/ sq ft$/)
  })
  it('notes: rim joists, overhead, house shape; no price source sentence', () => {
    expect(m.notes).toEqual(['Rim joists are the same in both houses and are not priced.', OVERHEAD_SENTENCE,
      'Based on a single detached house, 33 x 30 ft (10.1 x 9.1 m); other shapes will differ.'])
    expect(m.notes.join(' ')).not.toMatch(/LEEP|placeholder/)
  })
  it('the same assembly on both sides is all the same', () => {
    const same = model(scenario({ wallSelection: { simpleIndex: 3 } }), 'aboveGroundWalls')
    expect(same.rows.every(r => r.same)).toBe(true)
    expect(same.summary).toBe('7 layers, all the same')
  })
  it('a changed price breaks "the same" for that row only', () => {
    const changed = model(scenario({ wallSelection: { simpleIndex: 3 }, overrides: { 'design/aboveGroundWalls/framing/stud_2x6_16oc': { material: 50 } } }), 'aboveGroundWalls')
    expect(changed.rows.filter(r => !r.same).map(r => r.item)).toEqual(['Framing'])
  })
  it('a line price in use is stated, and the footer shows it (Review Focus 1)', () => {
    const lp = model(scenario({ wallSelection: { simpleIndex: 4 }, overrides: { 'design/aboveGroundWalls/__line': { line: 100 } } }), 'aboveGroundWalls')
    expect(lp.lineNote).toBe('Your own price per sq ft of wall is in use for This design; the rows show the prices it replaces.')
    expect(lp.footer.designPerUnit).toBeCloseTo(100 / SQFT_PER_M2, 6)
  })
})

describe('buildSpecifics: the other lines', () => {
  it('windows and doors: parts with their own quantities', () => {
    const m = model(scenario({ selections: { windowsDoors: 1 } }), 'windowsDoors')
    expect(m.label).toBe('U-values and areas')
    expect(items(m)).toEqual(['Windows', 'Exterior doors'])
    expect(m.rows[0].sub).toMatch(/^[\d,]+ sq ft$/)
    expect(m.rows[1].sub).toBe('2 doors')
    expect([m.rows[1].design.text, m.rows[1].baseline.text]).toEqual(['U 1.22', 'U 1.61'])
    expect(m.rows[1].design.price).toBe('2 x $1,550')
    expect(m.footer.kind).toBe('total')
    expect(m.summary).toMatch(/^[\d,]+ sq ft of windows and 2 doors, both priced by U-value$/)
    expect(m.notes[0]).toBe('Doors are priced at the same U-value as the windows, as on the Points card.')
  })
  it('ventilation: flow rate, size and SRE as specification rows', () => {
    const m = model(scenario({ selections: { hrv: 2 } }), 'hrv')
    expect(m.label).toBe('Flow rates and SRE')
    expect(m.specRows.map(r => [r.item, r.design, r.same])).toEqual([
      ['Airflow needed', '22-32 L/s for 3 bedrooms (NBC Table 9.32.3.3)', true],
      ['HRV size priced', '45 L/s, the smallest size that covers 32 L/s', true],
      ['Sensible recovery efficiency', '75% SRE', false],
    ])
    expect(m.specRows[2].baseline).toBe('65% SRE')
    expect(items(m)).toEqual(['HRV unit'])
    expect(m.rows[0].design.text).toBe('75% SRE, 45 L/s')
    expect(m.summary).toBe('22-32 L/s for 3 bedrooms, 45 L/s unit; 75% SRE vs 65% SRE')
  })
  it('ventilation with a designed airflow', () => {
    const m = model(scenario({ selections: { hrv: 2 }, fields: { bedrooms: 'moreThan5', designedAirflowLs: 40 } }), 'hrv')
    expect(m.specRows[0].design).toBe('40 L/s, designed airflow')
    expect(m.specRows[1].design).toBe('45 L/s, the smallest size that covers 40 L/s')
  })
  it('water heating: size and fuel rows, and each part', () => {
    const m = model(scenario({ selections: { dhwElectric: 0 } }), 'dhw')
    expect(m.specRows.map(r => [r.item, r.design, r.same])).toEqual([['Size', '50 gal, from your house fields', true], ['Fuel', 'electric', true]])
    expect(items(m)).toEqual(['Water heater', 'Condensate drain', '240 V circuit'])
    expect(m.rows.map(r => r.same)).toEqual([false, false, true])
    expect(m.rows[0].design.text).toBe('heat pump water heater, EF 2.35')
    expect(m.rows[0].baseline.text).toBe('electric storage tank, code minimum')
    expect(m.rows[1].baseline).toBeNull()
    expect(m.summary).toBe('50 gal, electric; 3 parts, 1 the same')
    expect(m.notes).toContain('Fuel supply to the house is not priced.')
    expect(m.notes).not.toContain('Gas heaters are priced as natural gas.')
  })
  it('a tankless gas heater is sized by input and gets the natural gas note', () => {
    const m = model(scenario({ selections: { dhwGas: 3 } }), 'dhw')
    expect(m.specRows[0]).toMatchObject({ design: 'tankless, sized by input', baseline: '50 gal, from your house fields', same: false })
    expect(m.specRows[1]).toMatchObject({ design: 'natural gas', baseline: 'electric', same: false })
    expect(m.notes).toContain('Gas heaters are priced as natural gas.')
  })
  it('below grade: the assumed layers as specification rows, one priced row', () => {
    const m = model(scenario({ selections: { belowGradeWalls: 1 } }), 'belowGradeWalls')   // 3.09 vs 3.46
    expect(m.label).toBe('Assembly')
    expect(m.specRows.map(r => [r.item, r.design, r.baseline])).toEqual([
      ['Interior finish', '1/2 in gypsum', '1/2 in gypsum'],
      ['Framing and insulation', '2x6 R22 @ 16 in', '2x4 R12 @ 16 in'],
      ['Foam against the concrete', 'none', '2 in XPS'],
      ['Foundation wall', '200 mm concrete', '200 mm concrete'],
    ])
    expect(items(m)).toEqual(['Whole assembly'])
    expect(m.rows[0].design.text).toBe('RSI 3.09 assembly')
    expect(m.footer.kind).toBe('perSqFt')
    expect(m.summary).toBe('4 layers, 2 differ; priced as one figure per sq ft')
  })
  it('airtightness: one placeholder row; a mini-home baseline is tested too (Review Focus 3)', () => {
    const m = model(scenario({ selections: { airTightness: 2 } }), 'airTightness')
    expect(items(m)).toEqual(['Air sealing and blower-door test'])
    expect(m.rows[0].baseline.price).toBe('$0 per house')
    expect(m.summary).toBe('one placeholder price per airtightness level')
    const mini = model(scenario({ selections: { airTightness: 2 }, houseType: 'miniHome' }), 'airTightness')
    expect(mini.rows[0].baseline.text).toBe('2 ACH50, tested')
    expect(mini.rows[0].baseline.cost).toBeGreaterThan(0)
    expect(mini.notes.at(-1)).toMatch(/^Based on a mini-home, 66 x 16 ft/)
  })
  it('lines that are not priced have no model', () => {
    const s = scenario({ selections: { hrv: 2 } })
    expect(buildSpecifics(s.line('belowGradeWalls'), s.ctx)).toBeNull()
    expect(buildSpecifics(s.line('volume'), s.ctx)).toBeNull()
  })
})

describe('basicViewText', () => {
  it('a wall picked by level: plain notice, both houses described', () => {
    const s = scenario({ wallSelection: { simpleIndex: 4 } })
    const t = basicViewText(s.line('aboveGroundWalls'), s.ctx, s.sentences)
    expect(t.designText).toBe('RSI 4.29 level, priced as 2x6 R22 batt + 1-1/2 in Polyiso, OSB, vinyl')
    expect(t.baselineText).toBe('RSI 3.99 (2x6 R24 batt + 1 in XPS, OSB, vinyl)')
    expect(t.notice).toEqual({ text: 'You picked this wall by RSI level, so it is priced as a common wall that reaches RSI 4.29: 2x6 R22 batt + 1-1/2 in Polyiso, OSB, vinyl. To price your own wall, build it layer by layer on Points.', goToPoints: true })
    expect(t.quantity).toEqual({ text: s.sentences.opaqueWall, field: 'storeyHeightFt' })
    expect(t.notice.text).not.toMatch(/BEA's assumed/)
  })
  it('a Code minimum baseline wall is described by level', () => {
    const s = scenario({ wallSelection: { simpleIndex: 4 }, baselineId: 'codeMinimum' })
    expect(basicViewText(s.line('aboveGroundWalls'), s.ctx, s.sentences).baselineText).toBe('RSI 2.97 level, priced as 2x6 R22 batt, OSB, vinyl')
  })
  it('below grade, ventilation, water heating and airtightness', () => {
    const s = scenario({ selections: { belowGradeWalls: 3, hrv: 2, dhwGas: 3, airTightness: 2 } })
    const bg = basicViewText(s.line('belowGradeWalls'), s.ctx, s.sentences)
    expect(bg.designText).toBe('RSI 3.9, priced as 200 mm concrete, 2 in XPS, 2x6 R20 @ 16 in interior, gypsum')
    expect(bg.notice.text).toBe('Each RSI level is priced as a common assembly that reaches it, including a foundation built in the below-grade wall builder. Your own foundation layers cannot be priced in this version.')
    expect(bg.notice.goToPoints).toBe(false)
    expect(bg.quantity.field).toBe('foundationHeightFt')
    expect(basicViewText(s.line('hrv'), s.ctx, s.sentences).quantity).toEqual({ text: 'One HRV, sized from your 3 bedrooms.', field: 'bedrooms' })
    const dhw = basicViewText(s.line('dhw'), s.ctx, s.sentences)
    expect(dhw.designText).toBe('condensing tankless water heater, UEF 0.92')
    expect(dhw.quantity).toEqual({ text: 'One tankless heater, sized by input.', field: 'waterHeaterGal' })
    expect(basicViewText(s.line('airTightness'), s.ctx, s.sentences)).toMatchObject({ designText: '1.5 ACH50, tested', quantity: { text: 'Priced per house.', field: null } })
  })
})
