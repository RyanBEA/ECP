// src/optimize/useOptimize.test.js
import { renderHook } from '@testing-library/react'
import { runOptimize, useOptimize, deltaWords, totalWords } from './useOptimize'
import { defaultConsider, toggleConsider, cardOptions } from './candidates'
import { resolveHouseFields, resolveBaselinePicks } from '../costing/useHouseCost'
import { computeQuantities } from '../costing/quantities'
import { priceHouse, designPicks } from '../costing/priceHouse'
import { computeDelta } from '../costing/delta'
import { categories } from '../data/ecpData'
import { assumedWallSelection } from '../costing/assumedAssemblies'

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
  it('an unpicked card is its code minimum, so the starting pick of a changed line is named that way', () => {
    // Windows unpicked and only U 1.22 ticked: the line changes from the code-minimum windows. Same for hrv, which has no code minimum.
    const { windowsDoors, hrv, ...rest } = base.selections
    let consider = base.consider
    for (const o of cardOptions('windowsDoors')) if (o.value !== 1.22) consider = toggleConsider(consider, 'windowsDoors', o.value)
    for (const o of cardOptions('hrv')) if (o.value !== 65) consider = toggleConsider(consider, 'hrv', o.value)
    const r = runOptimize({ ...base, selections: rest, consider })
    const win = r.winner.lines.find(l => l.cardId === 'windowsDoors')
    expect(win).toMatchObject({ changed: true, startingLabel: 'U 1.61 (double glazed), code minimum' })
    const vent = r.winner.lines.find(l => l.cardId === 'hrv')
    expect(vent).toMatchObject({ changed: true, startingLabel: 'not picked' })
    // Cards left unpicked on the Points tab and kept at their code minimum are not changes.
    const air = r.winner.lines.find(l => l.cardId === 'airTightness')
    if (air.label.startsWith('untested')) expect(air.changed).toBe(false)
  })
  it('a Select RSI wall above the code minimum is a change when the package puts an assembly in its place', () => {
    const level = categories.find(c => c.id === 'aboveGroundWalls').options.findIndex(o => o.value === 3.96)
    expect(level).toBeGreaterThanOrEqual(0)
    // A low target: the other cards earn 11.4 points, so the cheapest package drops the wall to the code-minimum assembly.
    // That is a change from the RSI 3.96 pick, not "the current design".
    const r = runOptimize({ ...base, tierPoints: 2, tierLabel: 'a low target', wallSelection: { simpleIndex: level } })
    const wall = r.winner.lines.find(l => l.cardId === 'aboveGroundWalls')
    expect(wall.label).toMatch(/R22/)
    expect(wall.changed).toBe(true)
    expect(wall.startingLabel).toMatch(/^RSI 3\.96/)
    expect(r.isBefore).toBe(false)
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
    expect(low.before.text).toBe('Your current design does not reach Tier 3 (0.0 points). Unpicked cards counted at the code minimum.')
    // Steel earns too few points for Tier 3, so test the unpriced branch against Tier 2 (11.4 points reach it).
    const steel = runOptimize({ ...base, tierPoints: 10, tierLabel: 'Tier 2', wallSelection: { wallType: 'steel', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsThickness: 'None' } })
    expect(steel.before.fullyPriced).toBe(false)
    expect(steel.before.text).toBe('Your current design has cards we can\'t price yet. Unpicked cards counted at the code minimum.')
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
    // Keep only the design's own values: the own wall (plus the always-ticked standard wall), 1.22, untested (no pick), 65, 2.35, 3.46.
    // An unpicked airtightness card is the code minimum, so keeping only 'untested' is the design's own value.
    let consider = defaultConsider()
    for (const t of ['thickFoam', 'largeStuds', 'serviceCavity', 'doubleStud']) consider = toggleConsider(consider, 'aboveGroundWalls', t)
    const keep = { windowsDoors: 1.22, airTightness: 'untested', hrv: 65, dhw: 2.35, belowGradeWalls: 3.46 }
    for (const [cardId, value] of Object.entries(keep)) {
      for (const o of cardOptions(cardId)) if (o.value !== value) consider = toggleConsider(consider, cardId, o.value)
    }
    const r = runOptimize({ ...base, consider })
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

describe('final review follow-ups', () => {
  const sig = r => JSON.stringify([r.winner, ...r.runnersUp].map(x => Object.fromEntries(Object.entries(x.pkg.items).map(([k, v]) => [k, v.id])).aboveGroundWalls
    + '|' + Object.values(x.pkg.items).map(v => v.id).join(',') + '|' + x.pkg.cost.toFixed(2)))

  // C1: the review's scenario. Own wall 2x6 R24 + 1 in XPS, windows 1.22, 1.5 ACH50, HRV 75, heat pump water heater.
  const c1 = {
    ...base,
    selections: { windowsDoors: idx('windowsDoors', 1.22), airTightness: idx('airTightness', 1.5), hrv: idx('hrv', 75), dhwElectric: idx('dhwElectric', 2.35) },
    wallSelection: assumedWallSelection(3.96),
  }
  it('C1: pruning leaves the runners-up unchanged and a service-cavity runner-up is present', () => {
    const pruned = runOptimize(c1)
    const unpruned = runOptimize({ ...c1, prune: false })
    expect(pruned.reaches).toBe(true)
    expect(sig(pruned)).toBe(sig(unpruned))
    expect(pruned.runnersUp.map(r => r.wallType)).toContain('serviceCavity')
    expect(pruned.count).toBeLessThanOrEqual(unpruned.count)
    // Runners-up are one per wall construction type, none of them the winner's type.
    const types = [pruned.winner, ...pruned.runnersUp].map(x => x.wallType)
    expect(new Set(types).size).toBe(types.length)
  })
  it('C1: the builder\'s own wall is classed by its real type, so its type is not offered twice', () => {
    const r = runOptimize(c1)
    const own = [r.winner, ...r.runnersUp].filter(x => x.pkg.items.aboveGroundWalls.own)
    for (const x of own) expect(x.wallType).toBe('standard')
  })

  // I2: the review's scenario. Own wall 2x10 R31 batt OSB vinyl, 2.0 ACH50, HRV 75, heat pump water heater; below-grade and windows unpicked.
  const i2 = {
    ...base,
    selections: { airTightness: idx('airTightness', 2.0), hrv: idx('hrv', 75), dhwElectric: idx('dhwElectric', 2.35) },
    wallSelection: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x10 R31', contInsThickness: 'None', sheathingId: 'osb_11', claddingId: 'vinyl_siding' },
  }
  it('I2: the before is priced like the package, so it equals the winner to the cent when the design is the answer', () => {
    const r = runOptimize(i2)
    expect(r.isBefore).toBe(true)
    expect(r.before.exact).toBeCloseTo(r.winner.delta, 2)
    expect(r.before.fullyPriced).toBe(true)
    expect(r.before.filledCards).toEqual(['belowGradeWalls', 'windowsDoors'])
    expect(r.before.text).toMatch(/^Your current design is .* Typical Tier 2\. Unpicked cards counted at the code minimum\.$/)
    expect(r.before.points).toBeCloseTo(20, 5)
    expect(r.before.reachesTarget).toBe(true)
  })
  it('I2: with every card picked nothing is filled and the before is the Cost tab\'s figure', () => {
    const all = { ...base, selections: { ...base.selections, airTightness: idx('airTightness', 2.0) } }
    const r = runOptimize(all)
    expect(r.before.filledCards).toEqual([])
    expect(r.before.text).not.toMatch(/Unpicked/)
    const quantities = computeQuantities(base.houseFields)
    const { name, picks } = resolveBaselinePicks(base.baselineChoice, base.houseType, base.usualHouse)
    const d = computeDelta(priceHouse(designPicks(all.selections, all.wallSelection), quantities, {}, 'design'), priceHouse(picks, quantities, {}, 'baseline'), name)
    expect(r.before.exact).toBeCloseTo(d.headline.exact, 6)
  })
  it('I2: an unpicked wall, or a Select RSI wall at the code minimum, is filled with the standard 2x6 R22 wall; a Select RSI wall above it and hrv are never filled', () => {
    const all = { ...base, selections: { ...base.selections, airTightness: idx('airTightness', 2.0) } }
    const none = runOptimize({ ...all, wallSelection: {} })
    expect(none.before.filledCards).toEqual(['aboveGroundWalls'])
    const level = categories.find(c => c.id === 'aboveGroundWalls').options.findIndex(o => o.value === 3.96)
    expect(level).toBeGreaterThanOrEqual(0)
    expect(runOptimize({ ...all, wallSelection: { simpleIndex: level } }).before.filledCards).toEqual([])
    const { hrv, ...rest } = all.selections
    expect(runOptimize({ ...all, selections: rest }).before.filledCards).not.toContain('hrv')
  })
})
