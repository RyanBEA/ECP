// Dominance pruning within one card (Capability 2 spec 2 step 2). Points add across cards, so an option that costs
// at least as much as another on the same card and earns no more points can never be in the cheapest package.
// Removing it never changes the winner or the cheapest package of each wall construction type, so walls are pruned
// within a construction type only. The starting option is never pruned, so the "fewer changes" tie-break can pick it.
const EPS = 1e-9

export function pruneDominated(options) {
  return options.filter(a => !options.some(b => b !== a
    && b.cost <= a.cost + EPS && b.points >= a.points - EPS
    && (b.cost < a.cost - EPS || b.points > a.points + EPS)))
}

// Survivors of dominance within each group (key function), in the original order, plus the starting option.
function pruneWithin(list, keyOf, startingId) {
  const groups = new Map()
  for (const c of list) {
    const k = keyOf(c)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(c)
  }
  const keep = new Set()
  for (const g of groups.values()) for (const c of pruneDominated(g)) keep.add(c)
  return list.filter(c => keep.has(c) || (startingId !== undefined && startingId !== null && c.id === startingId))
}

export function pruneCards(cards, startingIds = {}) {
  return Object.fromEntries(Object.entries(cards).map(([id, list]) => [
    id,
    pruneWithin(list, id === 'aboveGroundWalls' ? c => c.typeId : () => 0, startingIds[id]),
  ]))
}
