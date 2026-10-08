// src/optimize/considerText.test.js
import { considerSummary } from './considerText'
import { defaultConsider, toggleConsider } from './candidates'

describe('considerSummary (spec 5.2)', () => {
  it('says everything when nothing is unticked', () => {
    expect(considerSummary(defaultConsider())).toBe('everything')
  })
  it('names what is unticked, walls by type then options by card', () => {
    let c = toggleConsider(defaultConsider(), 'aboveGroundWalls', 'largeStuds')
    c = toggleConsider(c, 'airTightness', 0.6)
    expect(considerSummary(c)).toBe('everything except larger-stud walls and 0.6 ACH50')
    c = toggleConsider(c, 'dhw', 2.35)
    expect(considerSummary(c)).toBe('everything except larger-stud walls, 0.6 ACH50 and the heat pump water heater')
  })
  it('says a card is left out when every option on it is unticked', () => {
    let c = defaultConsider()
    for (const v of [60, 65, 75]) c = toggleConsider(c, 'hrv', v)
    expect(considerSummary(c)).toBe('everything except ventilation (left out)')
  })
})
