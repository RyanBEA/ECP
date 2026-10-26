import { scenario } from './__testing__/scenario'
import { buildSpecifics } from './specifics'
import { COSTED_CATEGORIES } from './priceHouse'
import { variantRows, rowDollars, A_LABELS } from './variantRows'
import { categories } from '../data/ecpData'

const wallIndex = categories.find(c => c.id === 'aboveGroundWalls').options.findIndex(o => o.value === 4.73)
const s = scenario({ selections: { windowsDoors: 1, dhwElectric: 0, belowGradeWalls: 2, airTightness: 2, hrv: 2 }, wallSelection: { simpleIndex: wallIndex } })
const model = id => buildSpecifics(s.line(id), s.ctx)

describe('variantRows', () => {
  it('A: one row per category, label from A_LABELS', () => {
    for (const id of COSTED_CATEGORIES) {
      const v = variantRows('a', model(id), s.line(id))
      expect(v.rows).toHaveLength(1)
      expect(v.rows[0].item).toBe(A_LABELS[id])
    }
  })
  it('A footer equals the specifics footer', () => {
    for (const id of COSTED_CATEGORIES) expect(variantRows('a', model(id), s.line(id)).footer).toEqual(model(id).footer)
  })
  it('A per sq ft row equals the footer per unit', () => {
    for (const id of ['aboveGroundWalls', 'belowGradeWalls']) {
      const m = model(id), r = variantRows('a', m, s.line(id)).rows[0]
      expect(r.design).toBe(m.footer.designPerUnit)
      expect(r.baseline).toBe(m.footer.baselinePerUnit)
    }
  })
  it('B rows sum to the line cost to the cent', () => {
    for (const id of COSTED_CATEGORIES) {
      const line = s.line(id), v = variantRows('b', model(id), line)
      for (const side of ['design', 'baseline']) {
        const total = v.rows.reduce((t, r) => t + rowDollars(r, side), 0)
        expect(Math.abs(total - line[side].cost)).toBeLessThan(0.005)
      }
    }
  })
  it('B per sq ft rows sum to the footer per unit within rounding', () => {
    for (const id of ['aboveGroundWalls', 'belowGradeWalls']) {
      const m = model(id), v = variantRows('b', m, s.line(id))
      expect(Math.abs(v.rows.reduce((t, r) => t + (r.design || 0), 0) - m.footer.designPerUnit)).toBeLessThanOrEqual(0.01 * v.rows.length)
      expect(Math.abs(v.rows.reduce((t, r) => t + (r.baseline || 0), 0) - m.footer.baselinePerUnit)).toBeLessThanOrEqual(0.01 * v.rows.length)
    }
  })
  it('Other is empty for walls, windows and DHW on the test house', () => {
    for (const id of ['aboveGroundWalls', 'windowsDoors', 'dhw']) {
      expect(variantRows('b', model(id), s.line(id)).rows.map(r => r.item)).not.toContain('Other')
    }
  })
  it('trade order is stable', () => {
    expect(variantRows('b', model('aboveGroundWalls'), s.line('aboveGroundWalls')).rows.map(r => r.item)).toEqual(['Framer', 'Insulator', 'Drywaller', 'Siding'])
  })
  it('windows sub-line', () => {
    expect(variantRows('a', model('windowsDoors'), s.line('windowsDoors')).rows[0].sub).toMatch(/^[\d,]+ sq ft of windows, \d+ doors?$/)
    expect(variantRows('b', model('windowsDoors'), s.line('windowsDoors')).rows[0].sub).toBe('windows and doors, supplied and installed')
  })
  it('an unmapped component lands in Other', () => {
    const m = {
      categoryId: 'dhw',
      rows: [{ key: 'mystery', item: 'Mystery', same: false, design: { cost: 10, comp: { material: 10, labour: 0, unit: 'each', quantity: 1 } }, baseline: null, diff: 10, inLine: true }],
      footer: { kind: 'total', designCost: 10, baselineCost: 0, diff: 10 },
    }
    const rows = variantRows('b', m, null).rows
    expect(rows).toHaveLength(1)
    expect(rows[0].item).toBe('Other')
    expect(rowDollars(rows[0], 'design')).toBe(10)
  })
})
