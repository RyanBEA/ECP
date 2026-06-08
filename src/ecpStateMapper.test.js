import { describe, it, expect } from 'vitest'
import { mapToEcpState, ASSUMED_SHGC, BASELINE_DEFAULTS } from './ecpStateMapper'

describe('mapToEcpState', () => {
  it('uses baseline defaults when nothing is selected', () => {
    const { ecp_state, sources } = mapToEcpState({ selections: {}, wallSelection: {}, wallRsi: 0 })
    expect(ecp_state.below_grade_wall.rsi).toBe(BASELINE_DEFAULTS.below_grade_wall_rsi)
    expect(ecp_state.airtightness_ach50).toBe(BASELINE_DEFAULTS.airtightness_ach50)
    expect(ecp_state.windows.shgc).toBe(ASSUMED_SHGC)
    expect(sources.airtightness).toBe('default')
    expect(sources.windows).toBe('assumed') // shgc is always assumed; U from default here
  })

  it('converts window U-value to RSI and ventilation % to fraction', () => {
    // windowsDoors index 1 = U 1.22 ; hrv index 2 = 75% ; airTightness index 1 = 2.0
    const { ecp_state, sources } = mapToEcpState({
      selections: { windowsDoors: 1, hrv: 2, airTightness: 1 },
      wallSelection: {}, wallRsi: 0,
    })
    expect(ecp_state.windows.rsi).toBeCloseTo(1 / 1.22, 4)
    expect(ecp_state.hrv.sre).toBeCloseTo(0.75, 4)
    expect(ecp_state.airtightness_ach50).toBe(2.0)
    expect(sources.airtightness).toBe('selected')
    expect(sources.ventilation).toBe('selected')
  })

  it('uses the provided wall RSI for above-grade wall', () => {
    const { ecp_state, sources } = mapToEcpState({
      selections: {}, wallSelection: { wallType: 'wood' }, wallRsi: 4.5,
    })
    expect(ecp_state.above_grade_wall.rsi).toBe(4.5)
    expect(sources.aboveGradeWall).toBe('selected')
  })

  it('maps electric HPWH DHW (EF 2.35) through', () => {
    const { ecp_state } = mapToEcpState({ selections: { dhwElectric: 0 }, wallSelection: {}, wallRsi: 0 })
    expect(ecp_state.dhw.ef).toBe(2.35)
  })
})
