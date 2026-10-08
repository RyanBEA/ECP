// src/optimize/useOptimize.js
// One request snapshot in, one result out (Capability 2 spec 2, 4, 5.2 to 5.4, 6). Pure except for the memo.
import { useMemo } from 'react'
import { computeQuantities } from '../costing/quantities'
import { resolveBaselinePicks } from '../costing/useHouseCost'
import { priceHouse, designPicks } from '../costing/priceHouse'
import { computeDelta } from '../costing/delta'
import { cardPoints, wallPoints } from '../costing/baselines'
import { formatDelta, roundDisplay, ROUNDING_UNIT } from '../costing/units'
import { LEVER_CARDS, CARD_NAMES, cardOptions, buildCandidates } from './candidates'
import { pruneCards } from './prune'
import { optimize, startingIds, packagePicks, wallTypeOfPackage } from './enumerate'
import { ownWallCandidate } from './wallTypes'

const money = n => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
// Same wording as the Cost tab's lines (delta.js): '+$500', '< $500', '$0', '$500 less', '< $500 less'.
export function deltaWords(delta) {
  if (delta >= 0) return formatDelta(delta)
  const r = roundDisplay(delta)
  return r === 0 ? `< ${money(ROUNDING_UNIT)} less` : `${money(Math.abs(r))} less`
}
export function totalWords(delta, baselineName) {
  if (delta === 0) return `about the same as ${baselineName}`
  const r = roundDisplay(delta)
  if (r === 0) return `less than ${money(ROUNDING_UNIT)} different from ${baselineName}`
  return r > 0 ? `${formatDelta(delta)} over ${baselineName}` : `${money(Math.abs(r))} less than ${baselineName}`
}

// The Points-tab design's points per lever card (dhw merged), plus volume.
function startingPointsByCard(picks) {
  const c = picks.cards || {}
  return {
    aboveGroundWalls: wallPoints(picks.wall),
    belowGradeWalls: cardPoints('belowGradeWalls', c.belowGradeWalls),
    windowsDoors: cardPoints('windowsDoors', c.windowsDoors),
    airTightness: cardPoints('airTightness', c.airTightness),
    hrv: cardPoints('hrv', c.hrv),
    dhw: c.dhwElectric !== undefined ? cardPoints('dhwElectric', c.dhwElectric) : cardPoints('dhwGas', c.dhwGas),
    volume: cardPoints('volume', c.volume),
  }
}
// Builder words for a Points-tab pick on a card, from the same labels the candidates use.
function startingLabel(cardId, picks, startingPriced) {
  if (cardId === 'aboveGroundWalls') return startingPriced.aboveGroundWalls.state === 'unselected' ? null : startingPriced.aboveGroundWalls.description
  const c = picks.cards || {}
  const value = cardId === 'dhw' ? (c.dhwElectric ?? c.dhwGas) : c[cardId]
  if (value === undefined) return null
  return cardOptions(cardId).find(o => o.value === value)?.label ?? String(value)
}

export function runOptimize(req) {
  const { selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse, overrides = {}, tierPoints, tierLabel, consider } = req
  const quantities = computeQuantities(houseFields)
  const { name: baselineName, picks: baselinePicks } = resolveBaselinePicks(baselineChoice, houseType, usualHouse)
  const baseline = priceHouse(baselinePicks, quantities, overrides, 'baseline')
  const starting = designPicks(selections, wallSelection)
  const startingPriced = priceHouse(starting, quantities, overrides, 'design')
  const startingPts = startingPointsByCard(starting)

  const { cards, leftOut, unavailable } = buildCandidates(consider, { wallSelection, quantities, overrides })
  const pruned = pruneCards(cards)
  const searched = Object.keys(pruned)
  const notSearched = [...LEVER_CARDS.filter(id => !searched.includes(id)), 'volume']
  const fixedPoints = notSearched.reduce((s, id) => s + (startingPts[id] || 0), 0)
  const target = tierPoints - fixedPoints
  const ids = startingIds(starting, ownWallCandidate(wallSelection) !== null)
  const result = optimize({ cards: pruned, target, startingIds: ids })

  const baselineCostOf = id => (baseline[id]?.state === 'priced' ? baseline[id].cost : 0)
  const startingCostOf = id => (startingPriced[id]?.state === 'priced' ? startingPriced[id].cost : null)

  const shown = pkg => {
    if (!pkg) return null
    const lines = []
    for (const id of LEVER_CARDS) {
      const item = pkg.items[id]
      if (item) {
        const baselinePriced = baseline[id]?.state === 'priced'
        const delta = baselinePriced ? item.cost - baselineCostOf(id) : null
        const changed = pkg.changes.includes(id)
        const sc = startingCostOf(id)
        // Below-grade walls name the assumed foundation assembly, not an RSI alone (controller ruling).
        const label = id === 'belowGradeWalls' ? item.description : item.label
        lines.push({ cardId: id, name: CARD_NAMES[id], state: 'searched', label, points: item.points, delta, deltaText: baselinePriced ? deltaWords(delta) : 'not priced', changed,
          note: baselinePriced ? null : `${baselineName} has no priced pick for this card`,
          startingLabel: changed ? (startingLabel(id, starting, startingPriced) ?? 'not picked') : null,
          startingDeltaText: changed && sc !== null && baselinePriced ? deltaWords(sc - baselineCostOf(id)) : null })
      } else if (leftOut.includes(id)) {
        // The builder keeps the Points-tab pick; when it is priced, its cost against the baseline counts (the Cost tab's own line).
        const sc = startingCostOf(id)
        const baselinePriced = baseline[id]?.state === 'priced'
        let delta = 0
        let deltaText = 'left out by you'
        if (sc !== null && baselinePriced) { delta = sc - baselineCostOf(id); deltaText = deltaWords(delta) }
        else if (sc !== null) { delta = null; deltaText = 'not priced' }
        lines.push({ cardId: id, name: CARD_NAMES[id], state: 'leftOut', label: startingLabel(id, starting, startingPriced) ?? 'not picked', points: startingPts[id] || 0, delta, deltaText, changed: false, startingLabel: null, startingDeltaText: null })
      } else {
        const u = unavailable.find(x => x.cardId === id)
        lines.push({ cardId: id, name: CARD_NAMES[id], state: 'unavailable', label: u?.reason ?? 'not priced', points: startingPts[id] || 0, delta: 0, deltaText: '', changed: false, startingLabel: null, startingDeltaText: null })
      }
    }
    lines.push({ cardId: 'volume', name: CARD_NAMES.volume, state: 'fixed', label: 'Not changed; a property of your project', points: startingPts.volume || 0, delta: 0, deltaText: 'no cost', changed: false, startingLabel: null, startingDeltaText: null })
    const delta = lines.reduce((s, l) => s + (typeof l.delta === 'number' ? l.delta : 0), 0)
    const searchedLines = lines.filter(l => l.state === 'searched')
    const searchedCount = searchedLines.length
    const coveredCount = searchedLines.filter(l => typeof l.delta === 'number').length
    const coveredText = coveredCount < searchedCount ? `Covers ${coveredCount} of the ${searchedCount} cards in the package` : ''
    return { pkg, delta, deltaText: deltaWords(delta), totalText: totalWords(delta, baselineName), points: pkg.points + fixedPoints, lines, wallType: wallTypeOfPackage(pkg), picks: packagePicks(pkg), coveredCount, searchedCount, coveredText }
  }

  // The before: the Cost tab's own view of the Points-tab design (spec 5.3).
  const d = computeDelta(startingPriced, baseline, baselineName)
  const beforePoints = Object.values(startingPts).reduce((s, p) => s + p, 0)
  const fullyPriced = d.hasPicks && d.coveredCount === d.pickedCount
  const reachesTarget = beforePoints >= tierPoints - 1e-9
  let beforeText
  if (!reachesTarget) beforeText = `Your current design does not reach ${tierLabel} (${beforePoints.toFixed(1)} points).`
  else if (!fullyPriced) beforeText = 'Your current design has cards we can\'t price yet.'
  else beforeText = `Your current design is ${totalWords(d.headline.exact, baselineName)}.`
  const before = { exact: d.headline.exact, text: beforeText, points: beforePoints, reachesTarget, fullyPriced }

  const winner = shown(result.winner)
  const runnersUp = result.runnersUp.map(shown)
  const isBefore = winner && result.reaches && winner.pkg.changes.length === 0
  let headline
  if (!result.reaches) headline = `Nothing you've ticked reaches ${tierLabel} for this house.`
  else if (isBefore) headline = `Your current design is the cheapest way to ${tierLabel} we found.`
  else headline = `Cheapest way to ${tierLabel} for this house: ${winner.totalText}.`

  // Every result, first or swapped, is built here so its show() closes over its own winner and runners-up.
  const finish = (win, rest, extra = {}) => {
    const out = { reaches: result.reaches, winner: win, runnersUp: rest, before, target, tierPoints, tierLabel, fixedPoints, leftOut, unavailable, searched, count: result.count, baselineName, headline, isBefore,
      coveredCount: win ? win.coveredCount : 0, searchedCount: win ? win.searchedCount : 0, coveredText: win ? win.coveredText : '', ...extra }
    // "Show" on a runner-up (spec 5.4): swap it into the winner slot; the old winner joins the runners-up, cheapest first.
    // The headline keeps the true cheapest package's figure (the first winner's), since the sentence is still "Cheapest way".
    out.show = i => {
      const next = rest[i]
      if (!next) return out
      const others = [win, ...rest.filter((_, j) => j !== i)].sort((a, b) => a.pkg.cost - b.pkg.cost)
      return finish(next, others, { isBefore: false, shownAlternative: true, headline: result.reaches ? `Cheapest way to ${tierLabel} for this house: ${winner.totalText}.` : headline })
    }
    return out
  }
  return finish(winner, runnersUp)
}

export function useOptimize(request) {
  return useMemo(() => (request ? runOptimize(request) : null), [request])
}
