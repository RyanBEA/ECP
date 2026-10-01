import { presetText } from './baselines'

// Ruling R34: readable preset values for the baseline editor's preset row.
describe('presetText', () => {
  it('names the electric storage tank', () => {
    expect(presetText('dhwElectric', 'electricStorage')).toBe('electric storage tank')
  })
  it('describes untested air tightness', () => {
    expect(presetText('airTightness', 'untested')).toBe('untested, prescriptive air-barrier detailing')
  })
  it('gives the metric and value for numeric presets', () => {
    expect(presetText('windowsDoors', 1.61)).toBe('U-value 1.61')
    expect(presetText('hrv', 60)).toBe('SRE 60')
  })
})
