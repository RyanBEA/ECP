// src/optimize/enumerate.js
// Brute-force search over the pruned candidates (Capability 2 spec 2 steps 3 to 5). Points and costs add across
// cards, so a package's totals are sums; priceHouse is never called per package.
import { LEVER_CARDS } from './candidates'
import { OWN_WALL_ID } from './wallTypes'

const EPS = 1e-9

// LEVER_CARDS order first; any other card keys follow in insertion order.
const cardRank = id => { const i = LEVER_CARDS.indexOf(id); return i < 0 ? LEVER_CARDS.length : i }
const cardOrder = ids => [...ids].sort((a, b) => cardRank(a) - cardRank(b))

export function enumeratePackages(cards) {
  const ids = cardOrder(Object.keys(cards).filter(id => cards[id]))
  let acc = [{ items: {}, points: 0, cost: 0 }]
  for (const id of ids) {
    const next = []
    for (const p of acc) for (const c of cards[id]) next.push({ items: { ...p.items, [id]: c }, points: p.points + c.points, cost: p.cost + c.cost })
    acc = next
  }
  return acc.map((p, index) => ({ ...p, index }))
}

// The Points-tab design as candidate ids, so a package can say which cards it changes.
export function startingIds(picks, ownWallPresent) {
  const cards = picks?.cards || {}
  const idFor = (pickCard, value) => (value === undefined ? null : `${pickCard}:${value}`)
  return {
    aboveGroundWalls: ownWallPresent ? OWN_WALL_ID : null,
    belowGradeWalls: idFor('belowGradeWalls', cards.belowGradeWalls),
    windowsDoors: idFor('windowsDoors', cards.windowsDoors),
    airTightness: idFor('airTightness', cards.airTightness),
    hrv: idFor('hrv', cards.hrv),
    dhw: cards.dhwElectric !== undefined ? idFor('dhwElectric', cards.dhwElectric) : idFor('dhwGas', cards.dhwGas),
  }
}

export function withChanges(pkg, starting) {
  const changes = cardOrder(Object.keys(pkg.items)).filter(id => pkg.items[id].id !== starting[id])
  return { ...pkg, changes }
}

export const wallTypeOfPackage = pkg => pkg.items.aboveGroundWalls?.typeId ?? 'none'

export function optimize({ cards, target, startingIds: starting, runnersUp = 3 }) {
  const all = enumeratePackages(cards).map(p => withChanges(p, starting))
  const reach = all.filter(p => p.points >= target - EPS)
  if (reach.length === 0) {
    const best = [...all].sort((a, b) => b.points - a.points || a.cost - b.cost || a.index - b.index)[0] ?? null
    return { reaches: false, winner: best, runnersUp: [], count: all.length }
  }
  reach.sort((a, b) => a.cost - b.cost || a.changes.length - b.changes.length || a.index - b.index)
  const winner = reach[0]
  const used = new Set([wallTypeOfPackage(winner)])
  const rs = []
  for (const p of reach.slice(1)) {
    const t = wallTypeOfPackage(p)
    if (used.has(t)) continue
    used.add(t); rs.push(p)
    if (rs.length === runnersUp) break
  }
  return { reaches: true, winner, runnersUp: rs, count: all.length }
}

export function packagePicks(pkg) {
  const cards = {}
  let wall = null
  for (const c of Object.values(pkg.items)) {
    if (c.pickCard === 'wall') wall = { kind: 'assembly', selection: c.selection }
    else cards[c.pickCard] = c.value
  }
  return { cards, wall }
}
