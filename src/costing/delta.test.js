import { computeDelta } from './delta'
import { formatDelta, roundDisplay, ROUNDING_UNIT } from './units'

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
// Lines are rounded independently, so they need not add up to the Total. The rule: the Total is
// roundDisplay(sum of exact deltas), the headline states that figure, each line shows its own exact
// delta rounded the same way, and the rounded lines sit within (non-zero lines x ROUNDING_UNIT / 2)
// of the rounded Total.
const money = n => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const expectedLineText = x => (x === 0 ? '$0' : x > 0 ? formatDelta(x) : `${formatDelta(-x).replace('+', '')} less`)

describe('reconciliation of lines and Total (spec 7.1)', () => {
  it('Total = roundDisplay(sum of exact deltas); lines rounded independently within the stated bound', () => {
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
      if (total !== 0) expect(d.headline.text).toContain(money(Math.abs(total)) + (total > 0 ? ' more' : ' less'))
      for (const id of ids) {
        const line = d.lines.find(l => l.categoryId === id)
        expect(line.delta).toBe(deltas[id])
        expect(line.deltaText).toBe(expectedLineText(deltas[id]))
      }
      const lineSum = ids.reduce((s, id) => s + roundDisplay(deltas[id]), 0)
      const nonZero = ids.filter(id => deltas[id] !== 0).length
      expect(Math.abs(lineSum - total)).toBeLessThanOrEqual(nonZero * ROUNDING_UNIT / 2)
      if (lineSum !== total) sawMismatch = true
    }
    // Documents that independently rounded lines can disagree with the Total.
    expect(sawMismatch).toBe(true)
  })
})

describe('fix round 1 (R27 to R30)', () => {
  const notPriced = reason => ({ state: 'notPriced', reason, cost: 0, components: [] })
  const unselected = { state: 'unselected', cost: 0, components: [] }

  it('R27: a picked double-stud wall plus 5 priced cards covers 5 of the 6 picked', () => {
    const design = { ...base, aboveGroundWalls: notPriced('double stud walls are not priced in this version') }
    const d = computeDelta(design, base, 'Typical Tier 2')
    expect(d.pickedCount).toBe(6); expect(d.coveredCount).toBe(5); expect(d.costedCount).toBe(6)
    expect(d.headline.coveredText).toBe('Covers 5 of the 6 cards you have picked')
  })
  it('R27: singular card when one is picked and covered', () => {
    const design = { ...base, aboveGroundWalls: unselected, belowGradeWalls: unselected, windowsDoors: unselected, airTightness: unselected, dhw: unselected, hrv: priced(3000) }
    const d = computeDelta(design, base, 'Typical Tier 2')
    expect(d.pickedCount).toBe(1)
    expect(d.headline.coveredText).toBe('Covers the 1 card you have picked')
  })
  it('R28: baseline unselected with a priced design is not priced, excluded from headline and coveredCount', () => {
    const b = { ...base, belowGradeWalls: unselected }
    const design = { ...base, belowGradeWalls: priced(9000) }
    const d = computeDelta(design, b, 'Typical Tier 2')
    const l = d.lines.find(x => x.categoryId === 'belowGradeWalls')
    expect(l.state).toBe('notPriced'); expect(l.delta).toBe(0)
    expect(l.reason).toBe('Typical Tier 2 has no pick for this card')
    expect(l.smallPrint).toBe('Typical Tier 2 has no pick for this card')
    expect(d.headline.exact).toBe(0)
    expect(d.coveredCount).toBe(5)
  })
  it('R29: a double-stud wall as the only pick gives $0 and says nothing can be priced', () => {
    const design = { ...base, aboveGroundWalls: notPriced('double stud walls are not priced in this version'), belowGradeWalls: unselected, windowsDoors: unselected, airTightness: unselected, hrv: unselected, dhw: unselected }
    const d = computeDelta(design, base, 'Typical Tier 2')
    expect(d.hasPicks).toBe(true); expect(d.coveredCount).toBe(0)
    expect(d.headline.text).toBe('$0')
    expect(d.headline.coveredText).toBe('None of the cards you have picked can be priced in this version')
  })
  it('round-to-zero headline names ROUNDING_UNIT', () => {
    const d = computeDelta({ ...base, hrv: priced(2800 + 100) }, base, 'Typical Tier 2')
    expect(d.headline.text).toBe(`Less than ${money(ROUNDING_UNIT)} different from Typical Tier 2, before HST.`)
  })
  it('sub-cent float residues count as exact zero for the headline and the line state', () => {
    const design = { ...base, hrv: priced(2800 + 0.001), dhw: priced(1200 - 0.004) }
    const d = computeDelta(design, base, 'Typical Tier 2')
    expect(d.headline.text).toBe('About the same as Typical Tier 2.')
    for (const id of ['hrv', 'dhw']) {
      const l = d.lines.find(x => x.categoryId === id)
      expect(l.delta).toBe(0); expect(l.deltaText).toBe('$0'); expect(l.smallPrint).toBe('same as Typical Tier 2')
    }
  })
  it('design-side not priced small print reads "This design: <reason>"', () => {
    const design = { ...base, aboveGroundWalls: notPriced('double stud walls are not priced in this version') }
    const l = computeDelta(design, base, 'Typical Tier 2').lines.find(x => x.categoryId === 'aboveGroundWalls')
    expect(l.smallPrint).toBe('This design: double stud walls are not priced in this version')
  })
  it('negative lines carry the word "less"', () => {
    const design = { ...base, hrv: priced(2800 - 400), dhw: priced(1200 - 200), airTightness: priced(500 + 200) }
    const d = computeDelta(design, base, 'Typical Tier 2')
    expect(d.lines.find(l => l.categoryId === 'hrv').deltaText).toBe('$500 less')
    expect(d.lines.find(l => l.categoryId === 'dhw').deltaText).toBe('< $500 less')
    expect(d.lines.find(l => l.categoryId === 'airTightness').deltaText).toBe('< $500')
  })
  it('empty design headline text is $0', () => {
    const none = Object.fromEntries(Object.keys(base).map(k => [k, k === 'volume' ? base.volume : unselected]))
    const d = computeDelta(none, base, 'Typical Tier 2')
    expect(d.headline.text).toBe('$0')
    expect(d.headline.coveredText).toBe('')
    expect(d.pickedCount).toBe(0)
  })
  it('baseline-side not priced gives no delta, names the baseline, and is not covered', () => {
    const b = { ...base, windowsDoors: notPriced('no price for one of the parts') }
    const d = computeDelta({ ...base, windowsDoors: priced(20000) }, b, 'Your usual house')
    const l = d.lines.find(x => x.categoryId === 'windowsDoors')
    expect(l.state).toBe('notPriced'); expect(l.delta).toBe(0)
    expect(l.reason).toBe('no price for one of the parts')
    expect(l.smallPrint).toBe('Your usual house: no price for one of the parts')
    expect(d.coveredCount).toBe(5); expect(d.headline.exact).toBe(0)
  })
})
