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
})
