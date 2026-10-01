import { computeQuantities, quantitySentences, AIRFLOW_BY_BEDROOMS } from './quantities'
import { getArchetype } from './archetypes'

const row = getArchetype('rowHome').fields
const single = getArchetype('singleDetached').fields
const mini = getArchetype('miniHome').fields

describe('computeQuantities', () => {
  it('matches the row-home reference values from spec 6.2', () => {
    // 6 x 11 m, 2 storeys, 2.7 m, 15 % glazing, two 11 m party walls, 1 door
    const q = computeQuantities({ ...row, lengthFt: 36.0892, widthFt: 19.685, storeyHeightFt: 8.8583 })
    expect(q.exposedLengthM).toBeCloseTo(12, 2)
    expect(q.exteriorGrossM2).toBeCloseTo(64.8, 1)
    expect(q.openingsM2).toBeCloseTo(9.72, 2)
    expect(q.doorAreaM2).toBeCloseTo(1.9, 2)
    expect(q.windowAreaM2).toBeCloseTo(7.82, 2)
    expect(q.opaqueWallM2).toBeCloseTo(55.08, 2)
  })
  it('party walls are the long sides whichever field holds the long dimension', () => {
    const a = computeQuantities(row)
    const b = computeQuantities({ ...row, lengthFt: row.widthFt, widthFt: row.lengthFt })
    expect(b.exposedLengthM).toBeCloseTo(a.exposedLengthM, 6)
  })
  it('single detached has no party walls and a foundation', () => {
    const q = computeQuantities(single)
    expect(q.exposedLengthM).toBeCloseTo(q.perimeterM, 6)
    expect(q.belowGradeApplicable).toBe(true)
    expect(q.belowGradeM2).toBeGreaterThan(0)
  })
  it('mini-home has no below-grade wall', () => {
    const q = computeQuantities(mini)
    expect(q.belowGradeApplicable).toBe(false)
    expect(q.belowGradeM2).toBe(0)
  })
  it('a half storey counts half a storey height', () => {
    const a = computeQuantities({ ...single, storeys: 1 })
    const b = computeQuantities({ ...single, storeys: 1.5 })
    expect(b.exteriorGrossM2 / a.exteriorGrossM2).toBeCloseTo(1.5, 6)
  })
  it('airflow follows Table 9.32.3.3 and the designed value above 5 bedrooms', () => {
    expect(AIRFLOW_BY_BEDROOMS[3]).toEqual({ min: 22, max: 32 })
    expect(computeQuantities({ ...single, bedrooms: 4 }).airflow).toEqual({ min: 26, max: 38 })
    expect(computeQuantities({ ...single, bedrooms: 'moreThan5' }).airflow).toBeNull()
    expect(computeQuantities({ ...single, bedrooms: 'moreThan5', designedAirflowLs: 40 }).airflow).toEqual({ min: 40, max: 40 })
  })
  it('writes the level-2 sentences in imperial', () => {
    const q = computeQuantities(single)
    const s = quantitySentences(q, single)
    expect(s.opaqueWall).toMatch(/2 storeys x 9 ft x 126 ft exposed perimeter, less 17% openings = [\d,]+ sq ft opaque wall/)
    expect(s.belowGrade).toMatch(/8 ft foundation wall/)
    expect(quantitySentences(computeQuantities(mini), mini).belowGrade).toBe('No foundation wall; below-grade walls do not apply.')
  })
  it('states the half-storey simplification only for fractional storeys', () => {
    const half = { ...single, storeys: 1.5 }
    expect(quantitySentences(computeQuantities(half), half).opaqueWall)
      .toMatch(/1\.5 storeys x 9 ft x 126 ft exposed perimeter.*\(a half storey counts as half a storey height; a simplification\)/)
    expect(quantitySentences(computeQuantities(single), single).opaqueWall).not.toMatch(/half storey/)
  })
  it('uses singular forms for one storey, one door and one bedroom', () => {
    expect(quantitySentences(computeQuantities(mini), mini).opaqueWall).toMatch(/^1 storey x 9 ft x /)
    const oneBed = { ...single, bedrooms: 1 }
    expect(quantitySentences(computeQuantities(oneBed), oneBed).airflow).toBe('1 bedroom: 16-24 L/s (NBC Table 9.32.3.3).')
  })
  it('writes the windows sentence', () => {
    const s = quantitySentences(computeQuantities(single), single)
    expect(s.windows).toBe('17% of 2,268 sq ft exterior wall is openings, less 2 doors = 345 sq ft of windows.')
    const r = quantitySentences(computeQuantities(row), row)
    expect(r.windows).toBe('15% of 720 sq ft exterior wall is openings, less 1 door = 88 sq ft of windows.')
  })
  it('writes the airflow sentence, the designed value and the fallback', () => {
    expect(quantitySentences(computeQuantities(single), single).airflow).toBe('3 bedrooms: 22-32 L/s (NBC Table 9.32.3.3).')
    const designed = { ...single, bedrooms: 'moreThan5', designedAirflowLs: 40 }
    expect(quantitySentences(computeQuantities(designed), designed).airflow).toBe('Designed airflow: 40-40 L/s (NBC Table 9.32.3.3).')
    const missing = { ...single, bedrooms: 'moreThan5' }
    expect(quantitySentences(computeQuantities(missing), missing).airflow).toBe('More than 5 bedrooms: enter the designed airflow to price the HRV.')
  })
})
