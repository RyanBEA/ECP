// src/optimize/useOptimize.test.js
import { renderHook } from '@testing-library/react'
import { runOptimize, useOptimize, deltaWords, totalWords } from './useOptimize'
import { defaultConsider, toggleConsider, cardOptions } from './candidates'
import { resolveHouseFields, resolveBaselinePicks } from '../costing/useHouseCost'
import { computeQuantities } from '../costing/quantities'
import { priceHouse, designPicks } from '../costing/priceHouse'
import { computeDelta } from '../costing/delta'
import { categories } from '../data/ecpData'

const ownAch = categories.find(c => c.id === 'airTightness').options[0].value
const idx = (cardId, value) => categories.find(c => c.id === cardId).options.findIndex(o => o.value === value)
const base = {
  selections: { windowsDoors: idx('windowsDoors', 1.22), dhwElectric: idx('dhwElectric', 2.35), belowGradeWalls: idx('belowGradeWalls', 3.46), hrv: idx('hrv', 65) },
  wallSelection: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsType: 'XPS', contInsThickness: '2"', sheathingId: 'osb_11', claddingId: 'vinyl_siding' },
  houseType: 'singleDetached', houseFields: resolveHouseFields('singleDetached', {}), baselineChoice: 'typicalTier2', usualHouse: {}, overrides: {},
  tierPoints: 20, tierLabel: 'Tier 3', consider: defaultConsider(),
}

describe('runOptimize (spec 2, 5.2, 5.3, 6)', () => {
  it('finds a package that reaches the Tier and prices it against the baseline', () => {
    const r = runOptimize(base)
    expect(r.reaches).toBe(true)
    expect(r.winner.points).toBeGreaterThanOrEqual(20)
    expect(r.winner.lines.filter(l => l.state === 'searched').length).toBe(6)
    expect(r.winner.lines.find(l => l.cardId === 'volume')).toMatchObject({ state: 'fixed', label: 'Not changed; a property of your project' })
    expect(r.headline).toMatch(/^Cheapest way to Tier 3 for this house: .* Typical Tier 2\.$/)
    expect(r.baselineName).toBe('Typical Tier 2')
    const below = r.winner.lines.find(l => l.cardId === 'belowGradeWalls')
    expect(below.label.startsWith('RSI ')).toBe(true)
    expect(below.label).toContain('assumed')
  })
  it('the before is the Cost tab\'s view of the Points-tab design', () => {
    const r = runOptimize(base)
    expect(r.before.points).toBeCloseTo(11.1 + 4.6 + 3.8 + 0.8 + 2.2, 5)
    expect(r.before.reachesTarget).toBe(true)
    expect(r.before.fullyPriced).toBe(true)
    expect(r.before.text).toMatch(/Your current design is \+\$[\d,]+ over Typical Tier 2\./)
  })
  it('marks changed lines and names the builder\'s current pick', () => {
    const r = runOptimize(base)
    const searched = r.winner.lines.filter(l => l.state === 'searched')
    for (const l of searched.filter(x => x.changed)) { expect(typeof l.startingLabel).toBe('string'); expect(l.startingLabel.length).toBeGreaterThan(0) }
    for (const l of searched.filter(x => !x.changed)) expect(l.startingLabel).toBeNull()
    const win = r.winner.lines.find(l => l.cardId === 'windowsDoors')
    if (win.changed) { expect(win.startingLabel).toBe('U 1.22 (triple glazed)'); expect(win.startingDeltaText).toMatch(/\$/) }
  })
  it('heated volume reduces the target and is never changed', () => {
    const withVolume = { ...base, selections: { ...base.selections, volume: idx('volume', 350) } }
    const r = runOptimize(withVolume)
    expect(r.fixedPoints).toBe(5)
    expect(r.target).toBe(15)
    expect(r.winner.lines.find(l => l.cardId === 'volume')).toMatchObject({ state: 'fixed', points: 5 })
    expect(r.winner.points + r.fixedPoints).toBeGreaterThanOrEqual(20)
  })
  it('a card left out by the builder keeps the Points-tab pick and its points', () => {
    let consider = base.consider
    for (const v of [60, 65, 75]) consider = toggleConsider(consider, 'hrv', v)
    const r = runOptimize({ ...base, consider })
    const hrv = r.winner.lines.find(l => l.cardId === 'hrv')
    expect(hrv).toMatchObject({ state: 'leftOut', points: 2.2, label: 'HRV, 65% SRE' })
    expect(r.fixedPoints).toBe(2.2)
    expect(r.leftOut).toEqual(['hrv'])
    // The kept pick is priced like the Cost tab prices it, and the total includes it.
    const quantities = computeQuantities(base.houseFields)
    const { name, picks } = resolveBaselinePicks(base.baselineChoice, base.houseType, base.usualHouse)
    const baseline = priceHouse(picks, quantities, {}, 'baseline')
    const startingPriced = priceHouse(designPicks(base.selections, base.wallSelection), quantities, {}, 'design')
    const costTabHrv = computeDelta(startingPriced, baseline, name).lines.find(l => l.categoryId === 'hrv')
    expect(hrv.delta).toBeCloseTo(costTabHrv.delta, 6)
    expect(r.winner.delta).toBeCloseTo(r.winner.lines.reduce((sum, l) => sum + l.delta, 0), 6)
  })
  it('a left-out card that costs more than the baseline adds its delta to the package total', () => {
    let consider = base.consider
    for (const o of cardOptions('dhw')) consider = toggleConsider(consider, 'dhw', o.value)
    const r = runOptimize({ ...base, consider })
    const dhw = r.winner.lines.find(l => l.cardId === 'dhw')
    expect(dhw.state).toBe('leftOut')
    expect(dhw.delta).not.toBe(0)
    expect(dhw.deltaText).not.toBe('left out by you')
    expect(r.winner.delta).toBeCloseTo(r.winner.lines.reduce((sum, l) => sum + l.delta, 0), 6)
  })
  it('says why when the Points-tab design does not reach the Tier or has unpriced cards', () => {
    const low = runOptimize({ ...base, selections: {} , wallSelection: {} })
    expect(low.before.reachesTarget).toBe(false)
    expect(low.before.text).toBe('Your current design does not reach Tier 3 (0.0 points).')
    // Steel earns too few points for Tier 3, so test the unpriced branch against Tier 2 (11.4 points reach it).
    const steel = runOptimize({ ...base, tierPoints: 10, tierLabel: 'Tier 2', wallSelection: { wallType: 'steel', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsThickness: 'None' } })
    expect(steel.before.fullyPriced).toBe(false)
    expect(steel.before.text).toBe('Your current design has cards we can\'t price yet.')
  })
  it('a Tier 2 target never prints a signed negative in the headline', () => {
    const r = runOptimize({ ...base, tierPoints: 10, tierLabel: 'Tier 2' })
    expect(r.headline).not.toMatch(/\+\$-/)
  })
  it('wording helpers round and sign money like the Cost tab', () => {
    expect(deltaWords(-700)).toBe('$500 less')
    expect(deltaWords(-100)).toBe('< $500 less')
    expect(deltaWords(0)).toBe('$0')
    expect(deltaWords(2600)).toBe('+$2,500')
    expect(totalWords(-700, 'Typical Tier 2')).toBe('$500 less than Typical Tier 2')
    expect(totalWords(0, 'X')).toBe('about the same as X')
  })
  it('names the current design as the answer when it is already the cheapest way (isBefore)', () => {
    // Keep only the design's own values: the own wall (plus the always-ticked standard wall), 1.22, the first airtightness option, 65, 2.35, 3.46.
    // The design must pick airtightness: an unpicked card reads as 'not picked', so the optimizer's untested option would count as a change.
    const own = { ...base, selections: { ...base.selections, airTightness: idx('airTightness', ownAch) } }
    let consider = defaultConsider()
    for (const t of ['thickFoam', 'largeStuds', 'serviceCavity', 'doubleStud']) consider = toggleConsider(consider, 'aboveGroundWalls', t)
    const keep = { windowsDoors: 1.22, airTightness: ownAch, hrv: 65, dhw: 2.35, belowGradeWalls: 3.46 }
    for (const [cardId, value] of Object.entries(keep)) {
      for (const o of cardOptions(cardId)) if (o.value !== value) consider = toggleConsider(consider, cardId, o.value)
    }
    const r = runOptimize({ ...own, consider })
    expect(r.isBefore).toBe(true)
    expect(r.headline).toBe('Your current design is the cheapest way to Tier 3 we found.')
  })
  it('when nothing reaches, reaches is false and the headline says so', () => {
    let consider = base.consider
    for (const t of ['thickFoam', 'largeStuds', 'serviceCavity', 'doubleStud']) consider = toggleConsider(consider, 'aboveGroundWalls', t)
    for (const v of [2.5, 2.0, 1.5, 1.0, 0.6]) consider = toggleConsider(consider, 'airTightness', v)
    for (const v of [1.44, 1.22]) consider = toggleConsider(consider, 'windowsDoors', v)
    const r = runOptimize({ ...base, wallSelection: {}, consider })
    expect(r.reaches).toBe(false)
    expect(r.headline).toBe('Nothing you\'ve ticked reaches Tier 3 for this house.')
    expect(r.winner).not.toBeNull()
  })
  it('show() swaps a runner-up into the winner slot, and keeps working on the swapped result', () => {
    const r = runOptimize(base)
    expect(r.runnersUp.length).toBeGreaterThan(0)
    const first = r.show(0)
    expect(first.winner.pkg.index).toBe(r.runnersUp[0].pkg.index)
    expect(first.runnersUp.map(s => s.pkg.index)).toContain(r.winner.pkg.index)
    expect(first.runnersUp.length).toBe(r.runnersUp.length)
    const second = first.show(0)
    expect(second.winner.pkg.index).toBe(first.runnersUp[0].pkg.index)
    expect(second.runnersUp.map(s => s.pkg.index)).toContain(first.winner.pkg.index)
    expect(second.headline).toBe(first.headline)
  })
  it('a card the baseline has no priced pick for is not priced, and the package says how many cards it covers', () => {
    const mini = { ...base, houseType: 'miniHome', houseFields: resolveHouseFields('miniHome', { miniHome: { foundationHeightFt: 8 } }) }
    const r = runOptimize(mini)
    const below = r.winner.lines.find(l => l.cardId === 'belowGradeWalls')
    expect(below.state).toBe('searched')
    expect(below.delta).toBeNull()
    expect(below.deltaText).toBe('not priced')
    expect(r.coveredText).toMatch(/Covers 5 of the 6 cards/)
  })
})

describe('useOptimize', () => {
  it('returns null with no request and memoises on the request object', () => {
    const { result, rerender } = renderHook(({ req }) => useOptimize(req), { initialProps: { req: null } })
    expect(result.current).toBeNull()
    rerender({ req: base })
    const first = result.current
    rerender({ req: base })
    expect(result.current).toBe(first)
    rerender({ req: { ...base } })
    expect(result.current).not.toBe(first)
  })
})
