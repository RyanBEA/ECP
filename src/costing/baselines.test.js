import { BASELINE_PRESETS, getPresetPicks, presetPoints, BASELINE_NAMES } from './baselines'
import { ARCHETYPES } from './archetypes'

describe('baseline presets', () => {
  it('names the three baselines', () => {
    expect(BASELINE_NAMES).toEqual({ codeMinimum: 'Code minimum', typicalTier2: 'Typical Tier 2', usualHouse: 'Your usual house' })
  })
  it('code minimum is the same for every archetype and scores 0.7 (the mandatory HRV)', () => {
    for (const a of ARCHETYPES) {
      const p = getPresetPicks('codeMinimum', a.type)
      expect(p.wall).toEqual({ kind: 'level', rsi: 2.97 })
      expect(p.cards.windowsDoors).toBe(1.61)
      expect(p.cards.airTightness).toBe('untested')
      expect(p.cards.hrv).toBe(60)
      expect(p.cards.dhwElectric).toBe('electricStorage')
      expect(presetPoints(p)).toBeCloseTo(0.7, 5)
    }
  })
  it('typical Tier 2 scores at least 10 for every archetype (spec 6.1)', () => {
    for (const a of ARCHETYPES) {
      const p = getPresetPicks('typicalTier2', a.type)
      expect(presetPoints(p), a.type).toBeGreaterThanOrEqual(10)
    }
  })
  it('typical Tier 2 single detached is the wall + 65% HRV + RSI 3.46 below grade', () => {
    const p = getPresetPicks('typicalTier2', 'singleDetached')
    expect(p.wall.kind).toBe('assembly')
    expect(p.cards.hrv).toBe(65)
    expect(p.cards.belowGradeWalls).toBe(3.46)
    expect(presetPoints(p)).toBeCloseTo(10.7, 5)
  })
  it('typical Tier 2 mini-home has no below-grade pick and a tested 2.0 ACH', () => {
    const p = getPresetPicks('typicalTier2', 'miniHome')
    expect(p.cards).not.toHaveProperty('belowGradeWalls')
    expect(p.cards.airTightness).toBe(2.0)
    expect(presetPoints(p)).toBeCloseTo(13.4, 5)
  })
  it('each preset carries a one-line description', () => {
    expect(BASELINE_PRESETS.codeMinimum.describe).toMatch(/Not a compliant house since April 2026/)
    expect(BASELINE_PRESETS.typicalTier2.describe).toMatch(/BEA's assumption/)
  })
})
