// src/optimize/prune.test.js
import { pruneDominated, pruneCards } from './prune'

const o = (id, cost, points) => ({ id, cost, points })

describe('pruneDominated (spec 2 step 2)', () => {
  it('removes an option that costs more and earns fewer points than another', () => {
    const kept = pruneDominated([o('a', 100, 2), o('b', 150, 1), o('c', 200, 3)])
    expect(kept.map(x => x.id)).toEqual(['a', 'c'])
  })
  it('removes an option that costs more for the same points, and one that earns fewer for the same cost', () => {
    expect(pruneDominated([o('a', 100, 2), o('b', 120, 2)]).map(x => x.id)).toEqual(['a'])
    expect(pruneDominated([o('a', 100, 2), o('b', 100, 1)]).map(x => x.id)).toEqual(['a'])
  })
  it('never removes an option that is the cheapest or earns the most', () => {
    const list = [o('cheap', 10, 0), o('mid', 50, 1), o('rich', 500, 9)]
    const kept = pruneDominated(list).map(x => x.id)
    expect(kept).toContain('cheap'); expect(kept).toContain('rich')
  })
  it('keeps both of two identical options and keeps order', () => {
    expect(pruneDominated([o('a', 100, 2), o('b', 100, 2), o('c', 90, 3)]).map(x => x.id)).toEqual(['c'])
    expect(pruneDominated([o('a', 100, 2), o('b', 100, 2)]).map(x => x.id)).toEqual(['a', 'b'])
  })
  it('keeps a frontier intact: more cost with more points is a real trade-off', () => {
    const list = [o('a', 0, 0), o('b', 100, 3.5), o('c', 300, 6.9), o('d', 600, 10.4)]
    expect(pruneDominated(list)).toEqual(list)
  })
  it('pruneCards applies per card and leaves the keys', () => {
    const cards = { x: [o('a', 1, 1), o('b', 2, 1)], y: [o('c', 5, 5)] }
    expect(pruneCards(cards)).toEqual({ x: [o('a', 1, 1)], y: [o('c', 5, 5)] })
  })
  it('prunes walls within each construction type only (a type whose only candidate is dominated by another type survives)', () => {
    const w = (id, typeId, cost, points) => ({ id, typeId, cost, points })
    const walls = [w('a1', 'A', 100, 5), w('a2', 'A', 200, 4), w('b1', 'B', 300, 3), w('b2', 'B', 400, 2)]
    const kept = pruneCards({ aboveGroundWalls: walls }).aboveGroundWalls
    expect(kept.map(x => x.id)).toEqual(['a1', 'b1'])
    // Across all candidates b1 would have been dropped (a1 costs less and earns more).
    expect(pruneDominated(walls).map(x => x.id)).toEqual(['a1'])
  })
  it('never prunes the starting option, even when another option beats it', () => {
    const cards = { x: [o('own', 100, 1), o('better', 100, 2), o('worse', 150, 1)] }
    expect(pruneCards(cards, { x: 'own' }).x.map(c => c.id)).toEqual(['own', 'better'])
    expect(pruneCards(cards, {}).x.map(c => c.id)).toEqual(['better'])
  })
  it('keeps the starting option: equal cost, fewer points', () => {
    const cards = { x: [o('start', 100, 1), o('other', 100, 2)] }
    expect(pruneCards(cards, { x: 'start' }).x.map(c => c.id)).toContain('start')
  })
})
