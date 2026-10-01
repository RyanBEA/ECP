import { ASSUMED_WALLS, assumedWallSelection, describeWall, ASSUMED_FOUNDATIONS } from './assumedAssemblies'
import { calculateWallRsi, wallPointsThresholds, MIN_WALL_RSI } from '../data/ecpData'
import { wallLayers } from './wallLayers'
import { foundationAssemblyRsi } from './assumedAssemblies'
import { categories } from '../data/ecpData'
import { lookupCost } from '../costSystem/client'

describe('assumed assemblies', () => {
  it('has an assembly for the code minimum and every points level', () => {
    const levels = [MIN_WALL_RSI, ...wallPointsThresholds.map(t => t.minRsi)]
    for (const lvl of levels) expect(ASSUMED_WALLS[lvl], `level ${lvl}`).toBeDefined()
  })
  it('every assumed wall computes within its level (spec 4.5)', () => {
    const steps = [MIN_WALL_RSI, ...wallPointsThresholds.map(t => t.minRsi)].sort((a, b) => a - b)
    steps.forEach((lvl, i) => {
      const rsi = Math.round(calculateWallRsi(ASSUMED_WALLS[lvl]) * 100) / 100
      const next = steps[i + 1] ?? Infinity
      expect(rsi, `level ${lvl} computed ${rsi}`).toBeGreaterThanOrEqual(lvl)
      expect(rsi, `level ${lvl} computed ${rsi}`).toBeLessThan(next)
    })
  })
  it('every assumed wall is priceable', () => {
    for (const sel of Object.values(ASSUMED_WALLS)) expect(wallLayers(sel).priced).toBe(true)
  })
  it('describes a wall in builder words', () => {
    expect(describeWall(assumedWallSelection(3.96))).toBe('2x6 R24 batt + 1 in XPS, OSB, vinyl')
    expect(describeWall({ wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsThickness: 'None' })).toBe('2x6 R20 batt, OSB, vinyl')
  })
  it('has a foundation assembly for every below-grade level', () => {
    expect(Object.keys(ASSUMED_FOUNDATIONS).map(Number).sort()).toEqual([2.98, 3.09, 3.46, 3.9])
    expect(ASSUMED_FOUNDATIONS[3.46].layers[0].option).toBe('rsi_3_46')
  })
})

describe('assumed assemblies, fix round 1 (rulings R19, R20)', () => {
  it('every assumed foundation computes within its below-grade level (spec 6.3, ruling R19)', () => {
    const options = categories.find(c => c.id === 'belowGradeWalls').options.map(o => o.value)
    const steps = [2.98, ...options].sort((a, b) => a - b)
    expect(steps).toEqual([2.98, 3.09, 3.46, 3.9])
    steps.forEach((lvl, i) => {
      const rsi = Math.round(foundationAssemblyRsi(ASSUMED_FOUNDATIONS[lvl]) * 100) / 100
      const next = steps[i + 1] ?? Infinity
      expect(rsi, `level ${lvl} computed ${rsi}`).toBeGreaterThanOrEqual(lvl)
      expect(rsi, `level ${lvl} computed ${rsi}`).toBeLessThan(next)
    })
  })
  it('computes the foundation picks by the cost-layer method (ruling R19)', () => {
    const r = lvl => Math.round(foundationAssemblyRsi(ASSUMED_FOUNDATIONS[lvl]) * 100) / 100
    expect(r(2.98)).toBe(3.06)
    expect(r(3.09)).toBe(3.12)
    expect(r(3.46)).toBe(3.6)
    expect(r(3.9)).toBe(4.55)
    expect(ASSUMED_FOUNDATIONS[3.46].label).toBe('200 mm concrete, 2 in XPS, 2x4 R12 @ 16 in interior, gypsum')
  })
  it('has a priced row for every assumed foundation (ruling R20)', () => {
    for (const f of Object.values(ASSUMED_FOUNDATIONS)) {
      expect(f.layers).toHaveLength(1)
      for (const l of f.layers) {
        expect(l.component).toBe('foundation_assembly')
        expect(lookupCost({ category: 'belowGradeWalls', component: l.component, option: l.option }), l.option).not.toBeNull()
      }
    }
  })
  it('uses sturdier picks at 3.69 and 4.29 (ruling R20)', () => {
    expect(describeWall(assumedWallSelection(3.69))).toBe('2x6 R20 batt + 1 in Polyiso, OSB, vinyl')
    expect(describeWall(assumedWallSelection(4.29))).toBe('2x6 R22 batt + 1-1/2 in Polyiso, OSB, vinyl')
  })
  it('describeWall states a spacing other than 16 in and never prints undefined (ruling R20)', () => {
    const w = { wallType: 'wood', assemblyType: 'single', studSpacing: '24"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsType: 'XPS', contInsThickness: '1"' }
    expect(describeWall(w)).toBe('2x6 R24 batt @ 24 in + 1 in XPS, OSB, vinyl')
    expect(describeWall({ ...w, studSpacing: '16"' })).toBe('2x6 R24 batt + 1 in XPS, OSB, vinyl')
    const odd = describeWall({ ...w, sheathingId: 'mystery_board', claddingId: 'mystery_siding' })
    expect(odd).toBe('2x6 R24 batt @ 24 in + 1 in XPS, mystery_board, mystery_siding')
    expect(odd).not.toContain('undefined')
  })
})
