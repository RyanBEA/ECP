// src/optimize/useOptimize.test.js
import { renderHook } from '@testing-library/react'
import { runOptimize, useOptimize } from './useOptimize'
import { defaultConsider, toggleConsider } from './candidates'
import { resolveHouseFields } from '../costing/useHouseCost'
import { categories } from '../data/ecpData'

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
    expect(r.before.text).toMatch(/Your current design is \+\$[\d,]+\./)
  })
  it('marks changed lines and names the builder\'s current pick', () => {
    const r = runOptimize(base)
    const win = r.winner.lines.find(l => l.cardId === 'windowsDoors')
    if (win.changed) { expect(win.startingLabel).toBe('U 1.22 (triple glazed)'); expect(win.startingDeltaText).toMatch(/\$/) }
    const same = r.winner.lines.filter(l => l.state === 'searched' && !l.changed)
    for (const l of same) expect(l.startingLabel).toBeNull()
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
  it('a package cheaper than the baseline reads as less (review focus 4)', () => {
    // Code minimum baseline against a Tier 2 target: the cheapest 10-point package costs more than code minimum,
    // so flip it: baseline Typical Tier 2 and a Tier 2 target can come in under the baseline.
    const r = runOptimize({ ...base, tierPoints: 10, tierLabel: 'Tier 2' })
    if (r.winner.delta < 0) expect(r.winner.deltaText).toMatch(/less$/)
    else expect(r.winner.deltaText).toMatch(/^\+\$|^\$0$|^< \$/)
    expect(r.headline).not.toMatch(/\+\$-/)
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
  it('show() swaps a runner-up into the winner slot and lists the old winner as a runner-up', () => {
    const r = runOptimize(base)
    if (r.runnersUp.length === 0) return
    const swapped = r.show(0)
    expect(swapped.winner.pkg.index).toBe(r.runnersUp[0].pkg.index)
    expect(swapped.runnersUp.map(s => s.pkg.index)).toContain(r.winner.pkg.index)
    expect(swapped.runnersUp.length).toBe(r.runnersUp.length)
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
