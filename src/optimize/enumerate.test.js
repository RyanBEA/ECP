// src/optimize/enumerate.test.js
import { enumeratePackages, optimize, startingIds, withChanges, packagePicks, wallTypeOfPackage } from './enumerate'

const c = (cardId, id, cost, points, extra = {}) => ({ cardId, id, cost, points, pickCard: cardId, value: id, ...extra })
const wall = (id, typeId, cost, points) => ({ cardId: 'aboveGroundWalls', id, typeId, cost, points, pickCard: 'wall', selection: { tag: id } })

const cards = {
  aboveGroundWalls: [wall('w1', 'standard', 0, 7.7), wall('w2', 'thickFoam', 2300, 11.1), wall('w3', 'doubleStud', 5000, 13.6)],
  airTightness: [c('airTightness', 'untested', 0, 0), c('airTightness', '1.5', 3100, 6.9), c('airTightness', '1.0', 6000, 10.4)],
  windowsDoors: [c('windowsDoors', '1.61', 0, 0), c('windowsDoors', '1.22', 7000, 4.6)],
}

describe('enumeratePackages', () => {
  it('forms every combination with summed points and cost and a stable index', () => {
    const all = enumeratePackages(cards)
    expect(all.length).toBe(3 * 3 * 2)
    expect(all[0]).toMatchObject({ points: 7.7, cost: 0, index: 0 })
    const last = all.at(-1)
    expect(last.points).toBeCloseTo(13.6 + 10.4 + 4.6); expect(last.cost).toBe(5000 + 6000 + 7000); expect(last.index).toBe(17)
    expect(Object.keys(all[0].items)).toEqual(['aboveGroundWalls', 'windowsDoors', 'airTightness'])   // LEVER_CARDS order
  })
  it('returns one empty package when there are no cards', () => {
    expect(enumeratePackages({})).toEqual([{ items: {}, points: 0, cost: 0, index: 0 }])
  })
})

describe('optimize (spec 2 steps 3 to 5)', () => {
  const start = { aboveGroundWalls: 'w2', airTightness: 'untested', windowsDoors: '1.22' }
  // Packages reaching 20, by cost: w3+1.5+1.61 (20.5, 8100); w2+1.0+1.61 (21.5, 8300); w3+1.0+1.61 (24.0, 11000);
  // w2+1.5+1.22 (22.6, 12400); w1+1.0+1.22 (22.7, 13000); w3+1.5+1.22 (25.1, 15100); w2+1.0+1.22 (26.1, 15300); w3+1.0+1.22 (28.6, 18000).
  it('returns the cheapest package that reaches the target', () => {
    const r = optimize({ cards, target: 20, startingIds: start })
    expect(r.reaches).toBe(true)
    expect(r.winner.items.aboveGroundWalls.id).toBe('w3')
    expect(r.winner.items.airTightness.id).toBe('1.5')
    expect(r.winner.items.windowsDoors.id).toBe('1.61')
    expect(r.winner.cost).toBe(8100)
    expect(r.count).toBe(18)
  })
  it('counts the cards that differ from the starting design', () => {
    const r = optimize({ cards, target: 20, startingIds: start })
    expect(r.winner.changes).toEqual(['aboveGroundWalls', 'windowsDoors', 'airTightness'])
  })
  it('lists runners-up cheapest first, each with a different wall type from the winner and each other', () => {
    const r = optimize({ cards, target: 20, startingIds: start })
    expect(r.runnersUp.map(p => wallTypeOfPackage(p))).toEqual(['thickFoam', 'standard'])
    expect(r.runnersUp[0].cost).toBe(8300)
    expect(r.runnersUp[1].cost).toBe(13000)
  })
  it('breaks a cost tie by fewer changes, then by enumeration order', () => {
    const tie = {
      a: [c('a', 'a1', 100, 5), c('a', 'a2', 100, 5)],
      b: [c('b', 'b1', 0, 5)],
    }
    const r = optimize({ cards: tie, target: 10, startingIds: { a: 'a2', b: 'b1' } })
    expect(r.winner.items.a.id).toBe('a2')
    const r2 = optimize({ cards: tie, target: 10, startingIds: { a: null, b: 'b1' } })
    expect(r2.winner.items.a.id).toBe('a1')
  })
  it('when nothing reaches the target, says so and returns the highest-scoring package', () => {
    const r = optimize({ cards, target: 40, startingIds: start })
    expect(r.reaches).toBe(false)
    expect(r.winner.points).toBeCloseTo(13.6 + 10.4 + 4.6)
    expect(r.runnersUp).toEqual([])
  })
  it('treats the target as reached at exactly the target', () => {
    const r = optimize({ cards: { a: [c('a', 'x', 1, 10.4)] }, target: 10.4, startingIds: { a: null } })
    expect(r.reaches).toBe(true)
  })
})

describe('startingIds and packagePicks', () => {
  it('maps Points-tab picks to candidate ids, the own wall when present', () => {
    const picks = { cards: { windowsDoors: 1.22, airTightness: 'untested', dhwGas: 0.83 }, wall: { kind: 'assembly', selection: {} } }
    expect(startingIds(picks, true)).toEqual({ aboveGroundWalls: 'own', belowGradeWalls: 'belowGradeWalls:2.98', windowsDoors: 'windowsDoors:1.22', airTightness: 'airTightness:untested', hrv: null, dhw: 'dhwGas:0.83' })
    expect(startingIds({ cards: {}, wall: { kind: 'level', rsi: 3.96 } }, false).aboveGroundWalls).toBe('2x6_r22')
  })
  it('maps an unpicked card to its code-minimum candidate (hrv has none)', () => {
    expect(startingIds({}, false)).toEqual({ aboveGroundWalls: '2x6_r22', belowGradeWalls: 'belowGradeWalls:2.98', windowsDoors: 'windowsDoors:1.61', airTightness: 'airTightness:untested', hrv: null, dhw: 'dhwElectric:electricStorage' })
    expect(startingIds({ cards: {} }, false)).toEqual(startingIds({}, false))
  })
  it('turns a package back into picks, with the dhw item on its own card', () => {
    const pkg = { items: { aboveGroundWalls: wall('w2', 'thickFoam', 0, 0), dhw: { cardId: 'dhw', id: 'dhwGas:0.83', pickCard: 'dhwGas', value: 0.83 }, windowsDoors: c('windowsDoors', 1.61, 0, 0) } }
    expect(packagePicks(pkg)).toEqual({ cards: { dhwGas: 0.83, windowsDoors: 1.61 }, wall: { kind: 'assembly', selection: { tag: 'w2' } } })
  })
  it('withChanges lists differing cards in LEVER_CARDS order', () => {
    const pkg = { items: { airTightness: c('airTightness', '1.5', 0, 0), aboveGroundWalls: wall('w2', 'thickFoam', 0, 0) }, points: 0, cost: 0, index: 0 }
    expect(withChanges(pkg, { aboveGroundWalls: 'w2', airTightness: 'untested' }).changes).toEqual(['airTightness'])
  })
})
