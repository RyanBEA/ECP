import { fillFromTypical } from './useHouseCost'
import { getPresetPicks } from './baselines'

// Ruling R41: the baseline editor starts from the same R32 fill the cost hook uses.
describe('fillFromTypical', () => {
  it('fills missing cards and a missing wall from Typical Tier 2 for the type, keeping what is there', () => {
    const usual = { cards: { hrv: 75 }, wall: null }
    const typical = getPresetPicks('typicalTier2', 'singleDetached')
    expect(fillFromTypical(usual, 'singleDetached')).toEqual({ cards: { ...typical.cards, hrv: 75 }, wall: typical.wall })
    expect(usual).toEqual({ cards: { hrv: 75 }, wall: null })
  })
  it('uses the type: a mini home gains no foundation wall and the 2.0 air tightness', () => {
    const filled = fillFromTypical({ cards: {}, wall: null }, 'miniHome')
    expect(filled.cards).not.toHaveProperty('belowGradeWalls')
    expect(filled.cards.airTightness).toBe(2.0)
  })
  it('does not add the electric water heater when the gas one is picked', () => {
    const filled = fillFromTypical({ cards: { dhwGas: 0.92 } }, 'singleDetached')
    expect(filled.cards.dhwGas).toBe(0.92)
    expect(filled.cards).not.toHaveProperty('dhwElectric')
  })
  it('keeps a saved wall', () => {
    const wall = { kind: 'level', rsi: 3.69 }
    expect(fillFromTypical({ cards: {}, wall }, 'singleDetached').wall).toEqual(wall)
  })
})
