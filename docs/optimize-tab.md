# ECP Calculator - Optimize tab (Capability 2, as built)

**Branch:** `cost-optimize`, off `cost-ui-2` (merged `cost-ui-2`'s docs commit ab42be9). Version string `1.7.0-cost-optimize`. Local only, nothing pushed.
**Suite:** 53 files, 817 tests, green on 2026-10-08. The branch adds 9 files and 88 tests to the 44 files and 729 tests of `cost-ui-2`.
**Status:** a working prototype for Mark and Ryan to try and refine, not round 1 user-testing material (Ryan 2026-10-08). Prices are stand-ins.

Read `docs/cost-layer.md` first; this note only covers what Capability 2 adds. Where this file and the
code disagree, the code is right. The design is in the project repo, `25_Working/ECP_Tool/specs/2026-10-08-capability-2-optimize-design.md`
(history; section 8 lists the files outside `src/optimize/`). Paths below are relative to the repo root.

---

## 1. What it does, and the decisions that hold

The third tab, **Optimize**, finds the cheapest complete set of Points picks (a package) that reaches the
Tier chosen in the Tier selector, and shows it as a difference from the Cost tab's baseline. It uses the
Cost tab's sidebar (house card, "Compared with", price note), so house and baseline are set in one place.

- **Target is the selected Tier.** Heated volume is a property of the project: its points reduce what the search must find and it is never changed (Ryan 2026-10-07).
- **Ask first.** Screen 1 asks what the builder would consider; no number appears until they press the button. A tick means the tool may pick it; everything starts ticked (Ryan 2026-10-08, brainstorm).
- **The search is explicit, not live.** It runs on the button, not on each tick (Ryan 2026-10-08).
- **Walls are one card among the others, listed by construction type.** Builders do not speak RSI, so wall candidates are named assemblies curated by BEA, five types, the standard type locked on (Ryan 2026-10-08).
- **No exterior foam on service-cavity or double-stud candidates** (Ryan 2026-10-08: not how those walls are built; a moisture risk). A test enforces it.
- **The Points-tab design is the "before".** It is priced and shown next to the result and never steers the search (Ryan 2026-10-08).
- **Only priced options are candidates.** Airtightness is a lever (Ryan 2026-10-08).
- **Runners-up:** up to three, each with a different wall type from the winner and from each other.
- **"Put this on the Points tab"** replaces the picks, with a session-only "Restore my design". Nothing is persisted.
- **The search code is pure and framework-free** so it can move to a server later; where it lives is decided when the real cost system API exists (Ryan 2026-10-08).
- **An unpicked card counts as its code-minimum option**, because the Points tab means the code minimum by "no pick". The exception is a Select RSI wall level above 2.97, which counts as a change.

## 2. Module map: `src/optimize/`

| File | Purpose | Key exports |
|---|---|---|
| `wallTypes.js` | the five curated wall types and their assemblies (wall-builder selections); the builder's own wall as a candidate | `WALL_TYPES`, `STANDARD_TYPE_ID`, `OWN_WALL_ID`, `wallTypeOf`, `ownWallCandidate`, `wallCandidates` |
| `candidates.js` | options per card, the tick state, and the priced candidate list per card | `LEVER_CARDS`, `CARD_NAMES`, `cardOptions`, `codeMinimumId`, `defaultConsider`, `toggleConsider`, `buildCandidates` |
| `prune.js` | dominance pruning within a card (costs more and earns no more points: dropped) | `pruneDominated`, `pruneCards` |
| `enumerate.js` | every combination, filter to the target, sort, runners-up by wall type | `enumeratePackages`, `startingIds`, `withChanges`, `wallTypeOfPackage`, `optimize`, `packagePicks` |
| `useOptimize.js` | one request snapshot in, one result out; the before, headline and wording | `runOptimize`, `useOptimize`, `deltaWords`, `totalWords` |
| `considerText.js` | the "Considering: ..." sentence | `considerSummary` |

Lever cards are above-ground walls, below-grade walls, windows and doors, airtightness, ventilation and water heating (the two DHW Points cards are one). Heated volume is not a lever.

How a search runs (`runOptimize`):

1. Price the baseline and the Points-tab design with the Cost tab's own engine (`priceHouse`, same overrides).
2. `buildCandidates`: for each card, the ticked options priced for this house. A card with no ticks is **left out**; a card that cannot be priced or does not apply is **unavailable** (reason kept).
3. `pruneCards`, then `optimize`: target is the Tier points less the points of every card not searched (heated volume, left-out and unavailable cards, taken from the Points-tab design). Packages are sums of per-option cost and points; `priceHouse` is not called per package.
4. Sort by cost; ties prefer fewer changed cards, then first listed. If nothing reaches the target, the highest-scoring package is returned with `reaches: false`.

## 3. The result model

`runOptimize` returns a `Result`:

| Field | Meaning |
|---|---|
| `reaches` | some package reaches the target |
| `winner`, `runnersUp` | `Shown` objects (below); runners-up is empty when nothing reaches |
| `headline` | the sentence on the headline card ("Cheapest way to Tier 3 for this house: +$5,500 over Typical Tier 2.", "Your current design is the cheapest ...", "Nothing you've ticked reaches ...") |
| `isBefore` | the winner changes no card from the Points-tab design |
| `before` | `{ exact, text, points, reachesTarget, fullyPriced }`: the Points-tab design, with its sentence |
| `target`, `tierPoints`, `tierLabel`, `fixedPoints` | what the search had to find, and the points of cards it did not search |
| `searched`, `leftOut`, `unavailable`, `count` | cards searched, cards left out by the builder, `{ cardId, reason }` for unavailable ones, packages enumerated |
| `baselineName` | name of the baseline compared with |
| `coveredCount`, `searchedCount`, `coveredText` | copied from the shown package |
| `shownAlternative` | set only on a result returned by `show` |
| `show(i)` | returns a complete `Result` with runner-up `i` in the winner slot and the old winner among the runners-up, cheapest first. Out of range returns the same result. |

`Shown` (winner, runner-up, or alternative): `pkg` (the enumerated package: `items`, `points`, `cost`, `changes`, `index`), `delta` (exact, unrounded), `deltaText`, `totalText`, `points` (package plus fixed points), `lines`, `wallType`, `picks` (`{ cards, wall }`, ready for `picksToSelections`), `coveredCount`, `searchedCount`, `coveredText`.

`Line`, one per lever card plus a heated-volume line: `cardId`, `name`, `state`, `label`, `points`, `delta`, `deltaText`, `changed`, `note`, `startingLabel`, `startingDeltaText`.

- `state` is `searched`, `leftOut`, `unavailable` or `fixed` (heated volume).
- **`delta: null`** means the card is searched but the baseline has no priced pick for it. `deltaText` reads "not priced", `note` says the baseline has no priced pick, and the line is excluded from the total.
- **`coveredText`** is "Covers N of the M cards in the package" when any searched line has `delta: null`, otherwise empty.
- **A left-out card** shows one of three things (`useOptimize.js`). Its Points-tab pick is priced and the baseline has a priced pick: the priced delta against the baseline, the Cost tab's own line. The pick is priced but the baseline has no priced pick: "not priced" with `delta: null`. The pick is unpriced or absent: "left out by you" at `delta: 0`, so an unpriced pick counts as $0 with no warning.
- `changed`, `startingLabel` and `startingDeltaText` are set only when the package differs from the Points-tab pick on that card ("you have: U 1.22, +$7,000").
- Below-grade lines name the assumed foundation assembly rather than an RSI alone.

## 4. App state (`src/App.jsx`)

Nothing here is persisted.

- `consider`: per card, the `Set` of ticked values; for walls, the ticked construction types. Starts as `defaultConsider()`; `toggleConsider` ignores the standard wall type.
- `optScreen`: `'consider'` or `'result'`.
- `optRequest`: the snapshot the result was computed from (selections, wall, house type and fields, baseline choice, usual house, overrides, Tier points and label, `consider`). `useOptimize(optRequest)` memoises the result on it.
- `optStale`: true when any snapshot field differs by reference from the live value. The result then shows "Your inputs changed" with "Find again"; it never re-runs on its own. Toggling any tick makes it stale, since `consider` is replaced each time.
- `optBlocked`: the button is disabled with "Enter the designed airflow on the Cost tab to include ventilation" when bedrooms are "more than 5", no airflow is entered and any HRV option is still ticked.
- `savedPicks`: the Points-tab `selections` and `wallSelection` before an apply. Any hand pick on the Points tab or wall builder clears it, which turns "Restore my design" back into "Put this on the Points tab".
- **Apply** (`applyPackage`): saves the current picks, then for each searched card sets the package's pick, or clears the card when the pick has no card button (a code-minimum value, which is what the Points tab means by it). Left-out and unavailable cards keep the builder's pick. Walls are replaced only when the package has a wall assembly.
- **Restore** puts `savedPicks` back.
- **Apply and restore refresh the snapshot** (`optRequest`) with the new picks, so the result does not go stale from the tool's own action.

## 5. Screens

- `OptimizeTab`: the Cost tab's sidebar (or phone strips), then `ConsiderScreen` or `ResultScreen`.
- `ConsiderScreen` (screen 1): a `Disclosure` per lever card; walls and airtightness open by default; summaries such as "all 3 options" or "2 of 5 wall types"; the standard wall type ticked, disabled, "always considered"; a note that the builder's current wall is always included; the run button.
- `ResultScreen` (screen 2): "Considering: ..." with "Change" back to screen 1 (ticks kept); headline card with the stale notice, the before sentence, points against target, the standing small print and `coveredText`; the package table with change badges; apply or restore; runner-up rows with "Show". It holds a local copy of the result so `show(i)` swaps what is displayed without touching App state, and resets it when App passes a new result. "Show" does not change the headline, which keeps the true cheapest figure.
- `TabBar`: a third tab, arrow keys wrap through all three.

## 6. Tests

- `src/optimize/*.test.js` (61 tests in 6 files): curated walls are complete, priced, in their intended points step and free of exterior foam on service-cavity and double-stud walls; ticks are respected; pruning never changes the winner; the target respects heated-volume points; sort, tie-break and runners-up by wall type; the before is priced like the Cost tab; the result model, left-out and unpriced cases.
- `src/costing/wallLayers.optimize.test.js` (12): double stud and service-cavity pricing and wording, the placeholder rows, the refusal of a double stud wall with a service cavity, and the unique Layers row ids and Plates row.
- `src/components/OptimizeTab.test.jsx` (10): screen 1 contents and defaults, the HRV block and its unblock, screen 2 summary, headline, table and before, "Change" keeps ticks, change badges, "Show", apply then restore, the nothing-reaches headline.
- `src/App.optimize.test.jsx` (5): three tabs, stale on a Tier change, apply clearing an exclusive pair and restoring, a hand change ending the restore offer, Points and Cost unchanged.
- The Capability 1 suites run unchanged apart from three one-line edits: `TabBar.test.jsx` (arrow wrap now lands on Optimize), and `wallLayers.test.js` and `priceHouse.test.js` (an unfinished double stud wall now reads "wall not finished").

## 7. Prototype debt

Ordered by how much it matters.

1. **Placeholder prices.** Double stud and service-cavity walls rest on 12 invented rows (plates, deep blown-in cavities) added to `stand-in-costs.json`; the optimizer's answer is only as good as those. HRV above the largest priced size is unavailable, and airtightness prices are placeholders (one row per level).
2. **Unpriced left-out cards leave the total quietly.** A left-out card with `delta: null` (the baseline has no priced pick) is excluded from the total and `coveredText` does not mention it, because the line is not searched. A left-out card whose own pick is unpriced counts as $0 with no warning. (A searched line with `delta: null` does lower `coveredCount`, so `coveredText` says so.)
3. **`show()` keeps the true cheapest headline**, so a displayed alternative sits under the cheapest package's sentence. Revisit with real copy.
4. **`deltaWords` in `useOptimize.js` duplicates the private `lineDeltaText` in `delta.js`** (the "$500 less" wording). Export one and delete the other.
5. **No persistence of "what to consider".** Ticks reset on reload; the spec leaves saving them with the usual house until testing shows it is wanted.
6. **Curated walls are a first cut.** BEA defines the real list; no continuous insulation on service-cavity or double-stud candidates is a rule, not a check on the builder's own wall. A double stud wall with a service cavity is refused by `wallLayers.js`.
7. **The tab prop `applied` is passed down and unused.** `canRestore` carries the meaning.
8. **The search runs in the main thread**, synchronously, on a few tens of thousands of packages at most. No loading state, which the real cost system API will need (same seam as `docs/cost-layer.md` section 11, item 1).
9. **Not built, by decision:** budget mode, multiple lenses, saved scenarios, print output, the performance-doorway nudge, live re-search, the below-grade builder, a wall-builder warning about foam on these walls.
