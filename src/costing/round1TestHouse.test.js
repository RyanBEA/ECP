// Records the Round 1 test-house figures from the (escalated) stand-in price table into round1-test-house.json.
// Downstream (session crib, mockup, Playwright checks) reads that file. Test house: single detached, default fields,
// RSI 4.73 wall level, windows/doors option 1, electric DHW option 0, baseline Typical Tier 2.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { scenario } from './__testing__/scenario'
import { buildSpecifics, SPECIFICS } from './specifics'
import { computeDelta } from './delta'
import { priceHouse } from './priceHouse'
import { perM2ToPerSqFt, m2ToSqFt } from './units'
import { categories } from '../data/ecpData'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, 'data')
const standInPath = path.join(dataDir, 'stand-in-costs.json')

const wallIndex = categories.find(c => c.id === 'aboveGroundWalls').options.findIndex(o => o.value === 4.73)
const picks = { windowsDoors: 1, dhwElectric: 0 }
const s = scenario({ selections: picks, wallSelection: { simpleIndex: wallIndex } })
const r2 = n => Math.round(n * 100) / 100
const display = c => (c.unit === 'm2' ? perM2ToPerSqFt : x => x)
const qty = c => (c ? (c.unit === 'm2' ? r2(m2ToSqFt(c.quantity)) : c.quantity) : 0)
const disp = (c, k) => (c ? r2(display(c)(c[k])) : 0)

function lineFigures(id) {
  const line = s.line(id)
  const m = buildSpecifics(line, s.ctx)
  const out = {
    designCost: r2(m.footer.designCost), baselineCost: r2(m.footer.baselineCost), diff: r2(m.footer.diff),
    rows: m.rows.map(r => ({
      item: r.item, designText: r.design ? r.design.text : '', baselineText: r.baseline ? r.baseline.text : '', same: r.same,
      designPrice: r.design ? r.design.price : '', baselinePrice: r.baseline ? r.baseline.price : '',
      designQuantity: qty(r.design?.comp), baselineQuantity: qty(r.baseline?.comp),
      designMaterial: disp(r.design?.comp, 'material'), designLabour: disp(r.design?.comp, 'labour'),
      baselineMaterial: disp(r.baseline?.comp, 'material'), baselineLabour: disp(r.baseline?.comp, 'labour'),
      diff: r2(r.diff),
    })),
  }
  if (m.footer.kind === 'perSqFt') {
    return { designPerSqFt: r2(m.footer.designPerUnit), baselinePerSqFt: r2(m.footer.baselinePerUnit), quantityText: m.footer.quantityText, ...out }
  }
  return out
}

describe('Round 1 test house', () => {
  it('prices from the escalated table and records the figures', () => {
    const raw = fs.readFileSync(standInPath)
    const rows = JSON.parse(raw)
    expect(rows.some(r => r.escalated)).toBe(true)
    expect(wallIndex).toBeGreaterThanOrEqual(0)

    const walls = lineFigures('aboveGroundWalls')
    const delta = computeDelta(
      priceHouse(s.ctx.designPicks, s.ctx.quantities, {}, 'design'),
      priceHouse(s.ctx.baselinePicks, s.ctx.quantities, {}, 'baseline'), s.ctx.baselineName)
    const headline = delta.headline.text
    expect(walls.designPerSqFt).toBeGreaterThan(12)
    expect(walls.designPerSqFt).toBeLessThan(30)
    expect(walls.designPerSqFt).toBeGreaterThan(walls.baselinePerSqFt)
    expect(headline).toMatch(/more than Typical Tier 2/)

    const out = {
      builtFrom: crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12), escalated: true,
      wallIndex, picks, headline, secondLine: delta.headline.secondLine,
      lines: { aboveGroundWalls: walls, windowsDoors: lineFigures('windowsDoors'), dhw: lineFigures('dhw') },
    }
    expect(SPECIFICS.dhw).toBeDefined()
    fs.writeFileSync(path.join(dataDir, 'round1-test-house.json'), JSON.stringify(out, null, 2) + '\n')
  })
})
