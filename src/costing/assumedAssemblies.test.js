import { ASSUMED_WALLS, assumedWallSelection, describeWall, ASSUMED_FOUNDATIONS } from './assumedAssemblies'
import { calculateWallRsi, wallPointsThresholds, MIN_WALL_RSI } from '../data/ecpData'
import { wallLayers } from './wallLayers'

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
