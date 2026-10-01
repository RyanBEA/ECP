import { applySelect, isCategoryDisabled, totalCardPoints, picksToSelections, selectionsToPicks } from './usePicks'
import { categories } from '../data/ecpData'
import { getPresetPicks } from './baselines'
import { ARCHETYPES } from './archetypes'

describe('usePicks', () => {
  it('clears the other member of an exclusive group', () => {
    const s1 = applySelect({}, 'dhwElectric', 0)
    const s2 = applySelect(s1, 'dhwGas', 1)
    expect(s2).toEqual({ dhwGas: 1 })
    expect(applySelect(s2, 'dhwGas', null)).toEqual({})
    expect(isCategoryDisabled(s2, categories.find(c => c.id === 'dhwElectric'))).toBe(true)
  })
  it('sums card points', () => {
    expect(totalCardPoints({ hrv: 1, windowsDoors: 0 })).toBeCloseTo(3.8, 5)
  })
  it('converts preset picks to editor selections, keeping preset-only values aside', () => {
    const { selections, wallSelection, presetOnly } = picksToSelections(getPresetPicks('typicalTier2', 'singleDetached'))
    expect(selections).toEqual({ belowGradeWalls: 1, hrv: 1 })          // 3.46 is index 1; 65 is index 1
    expect(presetOnly).toEqual({ windowsDoors: 1.61, airTightness: 'untested', dhwElectric: 'electricStorage' })
    expect(wallSelection.cavityType).toBe('2x6 R24')
    const back = selectionsToPicks(selections, wallSelection, presetOnly)
    expect(back.cards).toEqual({ belowGradeWalls: 3.46, hrv: 65, windowsDoors: 1.61, airTightness: 'untested', dhwElectric: 'electricStorage' })
    expect(back.wall.kind).toBe('assembly')
  })
  it('a level wall becomes a simpleIndex when the level is on the card, else stays a level', () => {
    expect(picksToSelections({ cards: {}, wall: { kind: 'level', rsi: 3.96 } }).wallSelection).toEqual({ simpleIndex: 3 })
    const cm = picksToSelections({ cards: {}, wall: { kind: 'level', rsi: 2.97 } })
    expect(cm.wallSelection).toEqual({})
    expect(cm.presetOnly.aboveGroundWalls).toBe(2.97)
    expect(selectionsToPicks({}, {}, { aboveGroundWalls: 2.97 }).wall).toEqual({ kind: 'level', rsi: 2.97 })
  })
  it('a picked option on a card replaces its preset-only value', () => {
    expect(selectionsToPicks({ windowsDoors: 0 }, {}, { windowsDoors: 1.61 }).cards.windowsDoors).toBe(1.44)
  })

  // Ruling R31: a selected card in an exclusive group drops the other members' preset-only values.
  it('a picked card in an exclusive group drops the preset-only value of the other member', () => {
    expect(selectionsToPicks({ dhwGas: 3 }, {}, { dhwElectric: 'electricStorage', windowsDoors: 1.61 }).cards)
      .toEqual({ windowsDoors: 1.61, dhwGas: 0.92 })
    expect(selectionsToPicks({ dhwElectric: 0 }, {}, { dhwElectric: 'electricStorage' }).cards).toEqual({ dhwElectric: 2.35 })
    expect(selectionsToPicks({}, {}, { dhwElectric: 'electricStorage' }).cards).toEqual({ dhwElectric: 'electricStorage' })
  })
  describe.each(['codeMinimum', 'typicalTier2'])('round trip for %s', presetId => {
    it.each(ARCHETYPES.map(a => a.type))('%s: picks -> selections -> picks is unchanged', type => {
      const p = getPresetPicks(presetId, type)
      const { selections, wallSelection, presetOnly } = picksToSelections(p)
      expect(selectionsToPicks(selections, wallSelection, presetOnly)).toEqual(p)
    })
  })
})
