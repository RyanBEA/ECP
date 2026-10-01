import { computeDelta } from './delta'
import { chipText, chipSecondLine } from './delta'
import { formatDelta, roundDisplay } from './units'

const priced = (cost, extra = {}) => ({ state: 'priced', cost, description: 'x', assumed: false, components: [], ...extra })
const base = { aboveGroundWalls: priced(17400), belowGradeWalls: priced(9000), windowsDoors: priced(13600), airTightness: priced(500), hrv: priced(2800), dhw: priced(1200), volume: { state: 'notCosted', cost: 0, components: [] } }

describe('computeDelta', () => {
  it('sorts by exact absolute delta, then zero, not costed, not applicable', () => {
    const design = { ...base, aboveGroundWalls: priced(20300), windowsDoors: priced(15400), hrv: priced(2400), airTightness: priced(4500), dhw: { state: 'unselected', cost: 0, components: [] }, belowGradeWalls: { state: 'notApplicable', cost: 0, components: [] } }
    const b = { ...base, belowGradeWalls: { state: 'notApplicable', cost: 0, components: [] } }
    const d = computeDelta(design, b, 'Typical Tier 2')
    expect(d.order).toEqual(['airTightness', 'aboveGroundWalls', 'windowsDoors', 'hrv', 'dhw', 'volume', 'belowGradeWalls'])
    expect(d.lines.find(l => l.categoryId === 'hrv').delta).toBe(-400)
    expect(d.lines.find(l => l.categoryId === 'dhw').state).toBe('sameAsBaseline')
    expect(d.headline.exact).toBe(4000 + 2900 + 1800 - 400)
    expect(d.headline.text).toBe('+$8,500 more than Typical Tier 2, before HST.')
    expect(d.coveredCount).toBe(4); expect(d.costedCount).toBe(5)   // below grade not applicable is not costed here
    expect(d.headline.coveredText).toBe('Covers the 4 cards you have picked')
  })
  it('keeps a frozen order', () => {
    const design = { ...base, hrv: priced(9000) }
    const d = computeDelta(design, base, 'Typical Tier 2', ['aboveGroundWalls', 'hrv', 'windowsDoors', 'airTightness', 'dhw', 'belowGradeWalls', 'volume'])
    expect(d.order[0]).toBe('aboveGroundWalls')
  })
  it('handles the empty design and the exact zero', () => {
    const none = Object.fromEntries(Object.keys(base).map(k => [k, { state: k === 'volume' ? 'notCosted' : 'unselected', cost: 0, components: [] }]))
    const d = computeDelta(none, base, 'Typical Tier 2')
    expect(d.hasPicks).toBe(false)
    expect(d.headline.exact).toBe(0)
    const same = computeDelta({ ...base }, base, 'Typical Tier 2')
    expect(same.hasPicks).toBe(true)
    expect(same.headline.text).toBe('About the same as Typical Tier 2.')
  })
  it('three small lines show "< $500" while the total shows $500 (Review Focus 5)', () => {
    const design = { ...base, aboveGroundWalls: priced(17400 + 150), windowsDoors: priced(13600 + 200), hrv: priced(2800 + 150) }
    const d = computeDelta(design, base, 'Typical Tier 2')
    expect(d.headline.exact).toBe(500)
    expect(d.headline.text).toBe('+$500 more than Typical Tier 2, before HST.')
    for (const id of ['aboveGroundWalls', 'windowsDoors', 'hrv']) expect(d.lines.find(l => l.categoryId === id).deltaText).toBe('< $500')
  })
  it('not priced on either side gives no delta and is not covered', () => {
    const design = { ...base, aboveGroundWalls: { state: 'notPriced', reason: 'double stud walls are not priced in this version', cost: 0, components: [] } }
    const d = computeDelta(design, base, 'Typical Tier 2')
    const w = d.lines.find(l => l.categoryId === 'aboveGroundWalls')
    expect(w.state).toBe('notPriced'); expect(w.delta).toBe(0); expect(w.reason).toMatch(/double stud/)
    expect(d.coveredCount).toBe(5)
  })
  it('writes the negative headline with "less"', () => {
    const d = computeDelta({ ...base, aboveGroundWalls: priced(16000) }, base, 'Your usual house')
    expect(d.headline.text).toBe('$1,500 less than Your usual house, before HST.')
  })
})

// Controller-mandated (spec 7.1): reconciliation of displayed lines against the Total.
// Lines are rounded independently, so they need not add up to the Total; the rule is that
// the Total is roundDisplay(sum of exact deltas) and each line shows formatDelta(its exact delta).
describe('reconciliation of lines and Total (spec 7.1)', () => {
  it('Total = roundDisplay(sum of exact deltas); each line text = formatDelta(its exact delta)', () => {
    const ids = ['aboveGroundWalls', 'belowGradeWalls', 'windowsDoors', 'airTightness', 'hrv', 'dhw']
    let seed = 12345
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    let sawMismatch = false
    for (let trial = 0; trial < 200; trial++) {
      const deltas = Object.fromEntries(ids.map(id => [id, Math.round((rand() - 0.5) * 6000)]))
      const design = { ...base, ...Object.fromEntries(ids.map(id => [id, priced(base[id].cost + deltas[id])])) }
      const d = computeDelta(design, base, 'Typical Tier 2')
      const sum = ids.reduce((s, id) => s + deltas[id], 0)
      expect(d.headline.exact).toBe(sum)
      const total = roundDisplay(d.headline.exact)
      expect(total).toBe(roundDisplay(sum))
      for (const id of ids) {
        const line = d.lines.find(l => l.categoryId === id)
        expect(line.delta).toBe(deltas[id])
        expect(line.deltaText).toBe(formatDelta(deltas[id]))
      }
      const lineSum = ids.reduce((s, id) => s + roundDisplay(deltas[id]), 0)
      if (lineSum !== total) sawMismatch = true
    }
    // Documents that independently rounded lines can disagree with the Total.
    expect(sawMismatch).toBe(true)
  })
})

describe('chip text (spec 2.3)', () => {
  it('reads the rounded delta and names the baseline', () => {
    expect(chipText(8300, 'Typical Tier 2')).toBe('+$8,500')
    expect(chipText(-800, 'Your usual house')).toBe('-$1,000')
    expect(chipText(0, 'Typical Tier 2')).toBe('$0')
    expect(chipSecondLine(8300, 'Typical Tier 2', false)).toBe('more than Typical Tier 2 . details ->')
    expect(chipSecondLine(-800, 'Your usual house', false)).toBe('less than Your usual house . details ->')
    expect(chipSecondLine(8300, 'Typical Tier 2', true)).toBe('more than Typical Tier 2 . your prices . details ->')
  })
})
