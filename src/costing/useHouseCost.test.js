import { renderHook } from '@testing-library/react'
import { useHouseCost, resolveHouseFields, resolveBaselinePicks } from './useHouseCost'
import { getArchetype } from './archetypes'
import { assumedWallSelection } from './assumedAssemblies'
import { overrideKey } from './priceHouse'
import { getPresetPicks } from './baselines'

describe('resolveHouseFields', () => {
  it('applies per-type overrides on the archetype defaults', () => {
    expect(resolveHouseFields('rowHome', { rowHome: { storeys: 3 }, miniHome: { storeys: 2 } })).toEqual({ ...getArchetype('rowHome').fields, storeys: 3 })
  })
})
describe('resolveBaselinePicks', () => {
  it('falls back to Typical Tier 2 when no usual house exists for the type (Review Focus 3)', () => {
    const r = resolveBaselinePicks('usualHouse', 'rowHome', { miniHome: { cards: { hrv: 75 }, wall: null } })
    expect(r.name).toBe('Typical Tier 2')
    expect(r.picks.cards.hrv).toBe(65)
    const u = resolveBaselinePicks('usualHouse', 'miniHome', { miniHome: { cards: { hrv: 75 }, wall: null } })
    expect(u.name).toBe('Your usual house'); expect(u.picks.cards.hrv).toBe(75)
  })
  // Ruling R32: a missing baseline pick means the preset value (spec 5.1).
  it('fills a usual house\'s missing cards and missing wall from Typical Tier 2 for the type', () => {
    const stored = { singleDetached: { cards: { hrv: 75 }, wall: null } }
    const r = resolveBaselinePicks('usualHouse', 'singleDetached', stored)
    const typical = getPresetPicks('typicalTier2', 'singleDetached')
    expect(r.name).toBe('Your usual house')
    expect(r.picks).toEqual({ cards: { ...typical.cards, hrv: 75 }, wall: typical.wall })
    expect(stored).toEqual({ singleDetached: { cards: { hrv: 75 }, wall: null } })   // stored usual house not mutated
  })
  it('a usual house with a gas water heater does not gain the electric one', () => {
    const r = resolveBaselinePicks('usualHouse', 'singleDetached', { singleDetached: { cards: { dhwGas: 0.92 }, wall: null } })
    expect(r.picks.cards.dhwGas).toBe(0.92)
    expect(r.picks.cards).not.toHaveProperty('dhwElectric')
    expect(r.picks.cards.hrv).toBe(65)
  })
})
describe('useHouseCost', () => {
  it('derives a headline that moves when a pick changes', () => {
    const base = { selections: { hrv: 2 }, wallSelection: {}, houseType: 'singleDetached', houseFields: getArchetype('singleDetached').fields, baselineChoice: 'typicalTier2', usualHouse: {}, overrides: {}, frozenOrder: null }
    const { result, rerender } = renderHook(props => useHouseCost(props), { initialProps: base })
    const first = result.current.delta.headline.exact
    expect(first).toBeGreaterThan(0)
    rerender({ ...base, selections: { hrv: 0 } })
    expect(result.current.delta.headline.exact).toBeLessThan(first)
    expect(result.current.baselineName).toBe('Typical Tier 2')
    expect(result.current.overrideCount).toBe(0)
  })
  // Ruling R26: a 'both' override on a row identical on both sides counts once, not once per side.
  it('counts one both-sides override on an identical framing row once', () => {
    const props = {
      selections: {}, wallSelection: assumedWallSelection(3.96), houseType: 'singleDetached',
      houseFields: getArchetype('singleDetached').fields, baselineChoice: 'typicalTier2', usualHouse: {},
      overrides: { [overrideKey('both', 'aboveGroundWalls', 'framing', 'stud_2x6_16oc')]: { labour: 1 } }, frozenOrder: null,
    }
    const { result } = renderHook(p => useHouseCost(p), { initialProps: props })
    const framing = side => result.current[side].aboveGroundWalls.components.find(c => c.component === 'framing')
    expect(framing('design').overridden.labour).toBe(true)
    expect(framing('baseline').overridden.labour).toBe(true)
    expect(result.current.overrideCount).toBe(1)
  })
})
