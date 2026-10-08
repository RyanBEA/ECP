// Dominance pruning within one card (Capability 2 spec 2 step 2). Points add across cards, so an option that costs
// at least as much as another on the same card and earns no more points can never be in the cheapest package.
// Removing it never changes the answer; it only shrinks the enumeration.
const EPS = 1e-9

export function pruneDominated(options) {
  return options.filter(a => !options.some(b => b !== a
    && b.cost <= a.cost + EPS && b.points >= a.points - EPS
    && (b.cost < a.cost - EPS || b.points > a.points + EPS)))
}

export function pruneCards(cards) {
  return Object.fromEntries(Object.entries(cards).map(([id, list]) => [id, pruneDominated(list)]))
}
