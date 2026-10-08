# ECP Calculator - Cost layer (Capability 1, as built)

**Branch:** `cost-ui-2`, head e33d1f3 (2026-10-05), 49 commits on `main` f01e9d7. Version string `1.6.0-cost-ui-2`. Local only, nothing pushed.
**Suite:** 44 files, 729 tests, green on 2026-10-08.
**Status:** a working prototype for design and user testing, not a release. Prices are stand-ins.

This is the one description of the cost layer as it exists. It replaces the design specs
(revision 2 and 3) and the execution ledgers as the thing to read before changing the code.
Those files are design history; section 13 says where they are. Where this file and the
code disagree, the code is right and this file needs fixing.

Everything here was read from the code on 2026-10-08. File paths are relative to the repo root.

---

## 1. What it does

The app has two tabs, **Points** (the original calculator, unchanged) and **Cost**. Cost shows one
figure: how much more or less the builder's current Points picks cost than a **baseline** house,
before HST, rounded to the nearest $500. The builder can see where the figure comes from in three
depths: the category line, a Basic view (two costs, the difference, what each house has, how the
quantity was derived), and a specifics table (layers or parts, with the ability to type their own
material and labour prices).

The baseline is one of:

- **Code minimum**: NBC 2020 as adopted in Nova Scotia, every card at its minimum.
- **Typical Tier 2** (default): BEA's assumption of how Nova Scotia builders reach 10 points today.
- **Your usual house**: Typical Tier 2 edited by the builder with the same cards as Points, saved in the browser, one per house type.

Both houses share one set of house facts (type, storeys, footprint, glazing ratio, bedrooms, and
five hidden fields), filled from an archetype and editable. Costs are never printed. Design picks
are never saved; cost settings, the usual house and price overrides are saved in `localStorage`.

Six of the seven Points categories are costed: above-ground walls, below-grade walls, windows and
doors, airtightness, ventilation (HRV) and water heating. Heated volume earns points and has no cost.

## 2. Product decisions that hold

Each one names who decided and when. Do not re-open these without Ryan.

**Structure**
- Two tabs, Points and Cost, between the header and the intro. Points stays mounted and hidden while Cost shows, so `WallBuilder` keeps its state. (Ryan 2026-10-01)
- Points renders exactly as `main`; `src/components/variantParity.test.jsx` guards it. The only additions on Points are the tab bar and a footer button, "What does this cost? ->", which reads "Cost details ->" once the Cost tab has ever been opened. (Ryan 2026-10-01)
- **No cost figure on the Points tab.** The header cost chip and the "Show cost on Points" option in revision 2 were built and then removed (commit e33d1f3, Ryan 2026-10-05). The footer button is the only hook.
- The Tier selector affects points only, never costs. The app stays 900 px wide.
- Costs never print. Print media hides the tab bar, the Cost tab, the editor and both dialogs; `PrintSummary` is unchanged.
- No placeholders for Capabilities 2 and 3 inside the Cost tab. Capability 2 is its own tab (see `25_Working/ECP_Tool/specs/2026-10-08-capability-2-optimize-design.md` in the project repo). Revision 2's "the tab bar never gains a third tab" is therefore amended by that spec.

**Wording and units**
- The two houses are always "This design" and the baseline's name ("Code minimum", "Typical Tier 2", "Your usual house"). Never "yours", "typical" or "usual" alone. The radio label is "My usual house"; the house, once saved, is "Your usual house". (Ryan 2026-10-01; iteration 3)
- "Tier" means an NBC tier and nothing else.
- Imperial primary: sq ft, $/sq ft, ft; metric computed internally, shown in brackets where Points already shows it; RSI and U stay as on the cards. (Ryan 2026-10-01)
- User-facing text is plain ASCII. Icons are inline SVG (`src/components/icons.jsx`), never typed glyphs. The small-print separator is " . " rendered as a drawn dot.
- Sources are called LEEP in user text, never HTAP. Code identifiers may still say htap. (R5)
- Negative deltas carry the word "less" and a sign; meaning never depends on colour.

**The figure**
- One figure per house: the difference from the baseline, not an absolute price. Deltas may be negative.
- Headline and Total are the sum of exact per-category deltas, rounded to `ROUNDING_UNIT` ($500 while prices are stand-ins; $100 once real). Sorting and line states use exact values; only display rounds. A line under half the unit shows "< $500".
- An unselected design card is "same as [baseline]", $0, and says so. Points still counts it as 0; the two meanings are kept apart.
- A category the tool cannot price is excluded from the headline, and the headline's third line says how many picked cards it covers. (R22, R27 to R29)
- Uncertainty is not quantified. Assumptions are stated in sentences instead. Mark has not fully signed off on this (decisions log, 2026-10-06).
- Installed prices are assumed to include contractor overhead, profit and waste; one sentence says so under every specifics table. (Ryan 2026-10-01; Mark "i think so?")
- Provenance beyond one footnote ("Prices: placeholder and LEEP 2013-2016 (Ontario, Manitoba) data, saved on this device") is not shown. It needs its own design. (Ryan 2026-10-02)

**Baselines and the usual house**
- Typical Tier 2 is a BEA assumption from the usage data, one preset per archetype, and must score 10 or more points on `main`'s tables (unit test). Single detached and row home share one preset; mini-home has its own. (Ryan 2026-10-01)
- Code minimum values are from NBC 2020 + NS amendments as floors on the ECP path. Baseline airtightness is untested prescriptive. Both presets are data.
- The usual house is edited with the Points cards reused under the Cost tab, never on a third tab. Picks are stored by value, not option index, with a schema version. A missing pick means the preset value. (Ryan 2026-10-01; R32)
- **Save as you pick.** The editor has no Done, no Cancel and no discard prompt. Every pick writes the usual house and selects it as the baseline; "Undo changes" returns the draft to how it was when the editor opened, which on a first open means no usual house and the previous baseline. From 900 px up the editor is a dialog over the Cost tab; below, a page in place of it. The layout is fixed when it opens and does not swap on resize. (Ryan 2026-10-05, iteration 3 decisions D1 to D6)
- "view" on a preset's pick opens that one card read-only in a small dialog at every width; "view" on a saved usual house opens the editor scrolled to the card. (D7)
- A live cost line stays in view while editing and updates with each pick. (D5)

**Walls**
- A wall built layer by layer on Points is priced from its own layers. A wall picked by RSI level is priced as a common assembly BEA assumes for that level, and the Basic view says so with a "Go to Points" link. Below-grade walls are always priced as an assumed assembly because there is no foundation builder yet. "BEA's assumed assembly" must not appear in user text; the phrase is gone, but "assumed assembly" still leads one line description (section 11).
- Wood single-stud walls are priced. Double stud, service wall, steel and ICF show "not priced in this version" and drop out of the headline. (Capability 2 adds double stud and service cavity on its own branch.)
- Which real assembly each RSI level maps to is separate work; the current table stands as a placeholder. (Ryan 2026-10-02)
- Adjacent RSI levels may invert in price; that is a fact about the data, not a bug, and the test that forbade it was dropped. (R17)

**Disclosure and layout (revision 3, Ryan 2026-10-02)**
- One disclosure vocabulary: a chevron row opens more detail in place; an arrow link opens another view; "Use my own prices" switches a specifics table into editing and reads "Done" while editing. A line with nothing to open has no chevron.
- Ryan's words: "The basic mode level of detail in option 3 is great. That should be the default, and then there is an expandable chevron for the specifics, e.g. layers for walls, flow rates and SRE for ventilation, etc. The specifics are presented in option 1 is ideal, i.e. the tabular format highlighting the differences and the button to use your own prices."
- The specifics table shows every layer or part on both sides, muting the ones that are the same rather than hiding them. Mark's working assumption in the decisions log (layers hidden, one price with no material/labour split) differs; that product call is open between them.
- Brand purple stays on controls. The BEA data-viz tokens (`--viz-design`, `--viz-baseline`, `--viz-more`, `--viz-less`) colour cost figures only, with a contrast test. The light palette is "warm stone" (whiteboard page 11, option C).

**Overrides**
- A builder may type their own material and labour price per priced row, per side, and a line price per side. On a row that is the same in both houses an edit applies to both unless they choose "this house only". Overrides persist on the device until reset, apply only while that item is priced, and are counted as distinct applied keys. (Ryan 2026-10-01; R26, R36)

## 3. Architecture

Three layers, one-way imports:

```
components (screens)  ->  costing (pure modules, hooks)  ->  costSystem/client (the price seam)
                                        \-> data/ecpData (Points data, unchanged)
```

- `src/costing/` is pure JavaScript apart from one hook, `useHouseCost`. Everything is unit-tested without the DOM.
- `src/costSystem/client.js` is the **only** reader of the price table and the only file that will change shape when Volta's cost system API replaces the bundled JSON. `priceHouse.js` is its only caller.
- Screen components under `src/components/` hold display state only. All cost state lives in `App.jsx` (section 6).

### Module map

| File | Purpose | Key exports |
|---|---|---|
| `src/costing/units.js` | ft/m and sq ft/m2 conversion, display rounding | `SQFT_PER_M2`, `ROUNDING_UNIT`, `roundDisplay`, `formatDelta` |
| `src/costing/archetypes.js` | three house types and their default fields | `ARCHETYPES`, `HOUSE_FIELD_KEYS`, `VISIBLE_FIELD_KEYS`, `getArchetype` |
| `src/costing/quantities.js` | house fields -> metric quantities, plus the imperial sentences | `computeQuantities`, `quantitySentences`, `AIRFLOW_BY_BEDROOMS` |
| `src/costing/optionMap.js` | Points card values and wall layers -> price option ids; HRV size classes; water-heater parts | `cardOptionId`, `hrvSizeClass`, `WATER_HEATER_PARTS`, `WALL_LAYER_OPTIONS`, `CARD_OPTIONS` |
| `src/costing/wallLayers.js` | a wall selection (builder shape) -> the list of priced layers, or why it cannot be priced | `wallLayers` |
| `src/costing/assumedAssemblies.js` | the assumed wall per Select-RSI level and per below-grade level; wall wording | `ASSUMED_WALLS`, `ASSUMED_FOUNDATIONS`, `assumedWallSelection`, `describeWall`, `wallText` |
| `src/costing/baselines.js` | the two presets, their points and readable text | `BASELINE_NAMES`, `BASELINE_PRESETS`, `getPresetPicks`, `presetPoints`, `presetText` |
| `src/costing/priceHouse.js` | picks + quantities + overrides -> a priced house, per category | `priceHouse`, `designPicks`, `overrideKey`, `lineOverrideKey`, `appliedOverrideKeys` |
| `src/costing/delta.js` | two priced houses -> lines, headline, counts, sort | `computeDelta`, `SECOND_LINE` |
| `src/costing/useHouseCost.js` | the memoised hook that ties it together; baseline resolution | `useHouseCost`, `resolveHouseFields`, `resolveBaselinePicks`, `fillFromTypical` |
| `src/costing/usePicks.js` | Points selection logic shared with the editor; index-shape <-> by-value picks | `applySelect`, `isCategoryDisabled`, `picksToSelections`, `selectionsToPicks` |
| `src/costing/specifics.js` | one priced line -> Basic-view text and the specifics table model | `buildSpecifics`, `basicViewText`, `SPECIFICS`, `OVERHEAD_SENTENCE` |
| `src/costing/houseText.js` | shared nouns and the house-shape sentence | `houseNoun`, `plural`, `shapeSentence` |
| `src/costing/persist.js` | the versioned `localStorage` blob | `STORAGE_KEY`, `SCHEMA_VERSION`, `loadPersisted`, `savePersisted` |
| `src/costing/data/stand-in-costs.json` | generated price table, 143 rows | |
| `src/costSystem/client.js` | synchronous price lookup over the bundled table | `lookupCost`, `requestCosts`, `PRICE_SOURCE_LABEL`, `USING_STAND_IN` |
| `scripts/build-stand-in-costs.js` | builds the price table (`npm run build:costs`) | |

Screen components, all new on the branch unless noted:

| Component | Role |
|---|---|
| `TabBar` | Points / Cost tablist, arrow keys and roving tabindex |
| `CostTab` | the Cost tab: sidebar or phone strips, headline, category lines, Total |
| `HouseFields` | House card: type, five visible fields, "More about this house" |
| `BaselinePicker` | "Compared with" radios and the "What [baseline] includes" list |
| `CategoryLine` | one statement line; opens to `LineSummary` and the specifics `Disclosure` |
| `LineSummary` | the Basic view: three tiles, descriptions, notice, quantity sentence |
| `SpecificsTable` | read tables (wide and narrow) and the edit table ("Use my own prices") |
| `PriceInput` | always-visible numeric field; Enter commits, Esc cancels, blur commits only a change |
| `PriceCell` | older click-to-edit cell; only its `draftOf` helper is still used |
| `BaselineEditor` | the usual-house editor reusing the Points cards; save as you pick; Undo; live line |
| `BaselineCardView` | one preset card, read-only, in a `Dialog` |
| `Dialog` | modal on the native `<dialog>`; Esc, Close and backdrop click close it |
| `Disclosure` | the one expandable-row control |
| `icons.jsx`, `useNarrow.js` | SVG icons; `matchMedia('(max-width: 899px)')` hook |
| `CategoryCard`, `OptionButton`, `WallBuilder`, `PointsCounter` (changed) | gain a `variant="baseline"` prop; `CategoryCard` shows a read-only preset row when the preset value is not one of its options; `WallBuilder` gains `hideExtras` and derives its initial mode from the selection |

Styles: `src/App.css`, cost rules from about line 769 (the revision 3 Cost tab block from 831), print rules from 1220.

## 4. Data shapes

### 4.1 The price request and row (the D2 seam)

```js
// src/costSystem/client.js
lookupCost({ category, component, option, fuel = null, size = null })
// match key: `${category}|${component}|${option}|${fuel ?? ''}|${size ?? ''}`
// -> null, or exactly:
{ material, labour,        // $ per `unit`
  priced_item,             // description; used as the row label when optionMap gives none
  source,                  // 'LEEP ON' | 'LEEP MB' | 'placeholder'; carried but not displayed
  unit }                   // 'm2' | 'each' | 'house'
```

`category` is one of the six costed ids. `component` is e.g. `framing`, `cavity_insulation`,
`continuous_insulation`, `windows`, `doors`, `airtightness`, `foundation_assembly`, `hrv`, `water_heater`, `venting`.
`size` is L/s for HRVs and gallons for water heaters. There is no nearest-size substitution: a
missing row means the item is not priced. `requestCosts` is a Promise wrapper nobody calls yet.

This request shape, and the five row fields `priceHouse.js` reads, are what the D2 data contract
has to honour or `priceHouse.js` changes with it.

### 4.2 Picks

```js
picks = {
  cards: { belowGradeWalls: 3.46, windowsDoors: 1.61, airTightness: 'untested' | 2.5 | 2 | 1.5 | 1 | 0.6,
           hrv: 65, dhwElectric: 'electricStorage' | 2.35, dhwGas: 0.79 | 0.83 | 0.85 | 0.92 },   // by value
  wall: null | { kind: 'level', rsi: 3.96 } | { kind: 'assembly', selection: <WallBuilder selection> }
}
```

The design's picks are derived every render from Points' index-based `selections` and
`wallSelection` by `designPicks`. The editor converts the other way with `picksToSelections` and
back with `selectionsToPicks`. Values a card does not offer are "preset-only" and shown as a read-only row in the baseline variant:
Code minimum's RSI 2.97 wall and RSI 2.98 below grade, and in every preset windows U 1.61,
airtightness `'untested'` and the `'electricStorage'` water heater.

### 4.3 A priced house

`priceHouse(picks, quantities, overrides, side)` returns one result per category:

```js
{ state, reason?, description, assumed, unit, quantity, perUnit, cost, components, lineOverride, lineKey }
```

| `state` | meaning |
|---|---|
| `priced` | `components` non-empty; `perUnit` = line override or in-line cost / quantity; `cost` in dollars |
| `unselected` | no pick on this side; `cost` 0 |
| `notApplicable` | below-grade walls with foundation height 0 |
| `notPriced` | `reason` says why. From `wallLayers.js`: no wall chosen, picked by RSI level, wall not finished, wall type not priced, sheathing or cladding not priced. From `priceHouse.js`: no assumed assembly for that RSI, enter the designed airflow to price the HRV, airflow above the largest HRV size, no price for one of the parts |
| `notCosted` | heated volume only |

Line unit and quantity per category: walls and below-grade m2 of opaque or foundation wall;
windows and doors m2 of windows; airtightness per house; HRV and water heating each.
Components priced in another unit than the line (doors, each, inside the windows line) are added
on top and are never covered by a line override. (R23, R24)

A component: `{ component, option, priceId, label, unit, quantity, material, labour, overridden: {material, labour}, overrideKeys, source }`.
`priceId` is the option id, or `option@size` for sized rows.

### 4.4 The delta

`computeDelta(design, baseline, baselineName, frozenOrder)` returns

```js
{ lines: [{ categoryId, name, delta, design, baseline, state, reason?, smallPrint, deltaText }],
  headline: { exact, text, secondLine, coveredText },
  coveredCount, costedCount, pickedCount, hasPicks, order }
```

Line states: `priced`, `sameAsBaseline` (design unselected), `notPriced` (either side, or the
baseline has no pick), `notApplicable`, `notCosted`. Sort: non-zero deltas by absolute value
descending, then $0, then not costed, then not applicable. While a line is open the order is frozen
(`frozenOrder`). `useHouseCost` returns `{ quantities, sentences, design, baseline, baselinePicks, baselineName, baselineId, delta, overrideCount, designPicks }`.

### 4.5 Overrides

Keys: `${side}/${categoryId}/${component}/${priceId}` with side `design`, `baseline` or `both`,
value `{ material?, labour? }`; and `${side}/${categoryId}/__line` with value `{ line }`. Per field
the side key beats the `both` key (R26). A line override makes the components in the line's unit
dormant. Stored in the row's unit ($/m2 for m2 rows); the table edits in display units and
`CostTab` converts m2 values with `SQFT_PER_M2` (R3). A reset writes `undefined`, which deletes
the key. Reset-card deletes keys whose category segment matches; reset-all sets `{}`.

### 4.6 The persisted blob

`localStorage['ecp-cost-ui']`, `schemaVersion` 1:

```js
{ schemaVersion: 1, hasOpenedCost: false, chipHidden: false,   // chipHidden is dead, see section 11
  houseType: 'singleDetached', baselineChoice: 'typicalTier2',
  fieldOverrides: { [houseType]: { fieldKey: value } },
  usualHouse:     { [houseType]: picks },
  overrides:      { [key]: value } }
```

A missing, unparseable or wrong-version blob gives the defaults; there is no migration. Mistyped
sub-objects reset individually. Every read and write is guarded, so blocked storage behaves like a
first visit. Not persisted: design picks, the active tab, which line is open, editor state.

### 4.7 The specifics model

`buildSpecifics(line, ctx)` (null unless the line is priced) returns labels, specification rows
(facts, no price), priced rows (`{ item, same, design: cell, baseline: cell, diff, inLine }`), a
per-sq-ft or total footer, notes, and a one-line summary for the closed chevron. `basicViewText`
returns the Basic view's two descriptions, optional notice and quantity sentence. All per-category
labels and summaries live in the `SPECIFICS` table in `specifics.js`.

## 5. Computation

### 5.1 Quantities (`quantities.js`, metric internally)

```
exposed length   = 2 (L + W) - partyWalls x max(L, W)        party walls are the long sides
exterior gross   = exposed length x storeys x storey height   half storeys scale linearly, stated in the sentence
openings         = exterior gross x glazing ratio
door area        = doors x 1.9 m2                             placeholder
window area      = max(0, openings - door area)
opaque wall      = exterior gross - openings
below-grade wall = exposed length x foundation height         0 -> not applicable; above-grade exposure not separated
airflow          = NBC Table 9.32.3.3 by bedrooms (1: 16-24 ... 5: 30-45 L/s); "more than 5" uses the designed airflow
HRV size class   = first of 30, 45, 75 L/s at or above airflow max; none above 75
```

Rim joists are noted, not priced. The glazing ratio is whole-house.

### 5.2 Archetypes (`archetypes.js`, placeholder geometry)

| | Single detached | Row home | Mini-home |
|---|---|---|---|
| storeys | 2 | 2 | 1 |
| footprint ft | 33 x 30 | 36 x 20 | 66 x 16 |
| glazing ratio | 0.17 | 0.15 | 0.12 |
| bedrooms | 3 | 3 | 3 |
| storey height ft | 9 | 9 | 9 |
| foundation wall ft | 8 | 8 | 0 |
| exterior doors | 2 | 1 | 2 |
| party walls | 0 | 2 | 0 |
| water heater gal | 50 | 40 | 40 |

Field overrides are stored per house type; changing the type clears that type's overrides with a notice.

### 5.3 Baseline presets (`baselines.js`)

| Card | Code minimum | Typical Tier 2 (detached, row) | Typical Tier 2 (mini) |
|---|---|---|---|
| Above-ground wall | RSI 2.97 level | assumed assembly for 3.96 (2x6 R24 + 1 in XPS) | same |
| Below-grade | RSI 2.98 | RSI 3.46 | no pick (n/a) |
| Windows and doors | U 1.61 | U 1.61 | U 1.61 |
| Airtightness | untested | untested | 2.0 ACH50 tested |
| HRV | 60% SRE | 65% | 65% |
| Water heating | electric storage | electric storage | electric storage |

### 5.4 Assumed assemblies (`assumedAssemblies.js`)

Above ground, all 2x6 wood single stud at 16 in, fibreglass batt, OSB, vinyl (computed RSI in brackets):
2.97 R22 (3.00); 3.08 R24 (3.11); 3.69 R20 + 1 in polyiso (3.78); 3.85 R22 + 1 in XPS (3.88);
3.96 R24 + 1 in XPS (3.99); 4.29 R22 + 1.5 in polyiso (4.38); 4.4 R20 + 2 in XPS (4.49);
4.57 R22 + 2 in XPS (4.68); 4.73 R24 + 2 in XPS (4.79); 4.84 R24 + 2 in polyiso (4.91);
5.01 R24 + 2.5 in XPS (5.25); 5.45 R24 + 3 in XPS (5.67). A unit test checks each computes at or above its level.

Below grade, each priced as **one** item `foundation_assembly / rsi_<level>`; the layers exist only for text and tests:
2.98 concrete + 1 in XPS + 2x4 R14 @ 24 in + gypsum (3.06); 3.09 concrete + 2x6 R22 (3.12);
3.46 concrete + 2 in XPS + 2x4 R12 (3.60); 3.9 concrete + 2 in XPS + 2x6 R20 (4.55).

### 5.5 Pricing rules in `priceHouse.js`

- A built wall is priced layer by layer from `wallLayers.js`: framing, cavity insulation, continuous insulation if any, sheathing, air/vapour barrier, strapping (only when continuous insulation is 1.5 in or more), cladding, interior finish. Sheathing and cladding fall back to the data layer's boundary defaults. The specifics table shows the layers in `WALL_ORDER` (`specifics.js`), inside to outside; that order is display only.
- A level wall is priced as its assumed assembly, with `assumed: true` and a description that says so.
- Windows are priced per m2 by U-value; doors per each at the same U-value.
- Airtightness is one placeholder row per level, per house.
- The HRV is one row by SRE band and size class.
- Water heating is the heater plus its parts from `WATER_HEATER_PARTS` by fuel (venting, condensate drain, gas branch, 120 V receptacle, 240 V circuit). Design-side UEF options are assumed natural gas; the presets use the electric storage tank.
- "The same" in the specifics table is a display rule: both sides have the component with the same label, material and labour. Override keys stay per `priceId`, so a `both` edit on a same-displayed row whose sides have different ids writes one override per id (I2-3), and the changed-count then reads 2 (I2-4, accepted).

## 6. State and control flow

All cost state is in `App.jsx`:

| State | What it is | Persisted |
|---|---|---|
| `selections`, `wallSelection` | Points picks, unchanged from `main`; handlers now come from `usePicks` | no |
| `activeTab` | `'points'` or `'cost'` | no |
| `persisted` | the section 4.6 blob; updated through `patch()`; saved by effect on every change | yes |
| `editing` | `null` or `{ initialPicks, focusCard, layout: 'dialog' | 'page', snapshot: { usual, choice } }` | no |
| `viewCard` | `null` or `{ cardId, picks, baselineName }` for `BaselineCardView` | no |
| `openLine`, `level3`, `frozenOrder` | the open category, the one with specifics open, the frozen sort order | no |
| `includesOpen`, `baseStrip` | disclosure state lifted so it survives the editor (I2-6) | no |
| `notice`, `toWall` | type-change notice; scroll-to-wall after "Go to Points" | no |

`houseFields = resolveHouseFields(houseType, fieldOverrides)` and `cost = useHouseCost(...)` are memoised.

**Editor flow.** `openEditor` snapshots the current usual house and baseline choice and fixes the
layout from `useNarrow()`. `BaselineEditor` keeps its own draft and calls `onChange(picks)` when the
draft differs from its start, `onChange(null)` when it is back at the start. App writes
`usualHouse[houseType]` and `baselineChoice: 'usualHouse'` on picks, restores the snapshot on null.
Leaving by Esc, Close, backdrop, "Back to Cost", the crumb or a tab keeps whatever is saved. When
priced, a saved usual house is filled from Typical Tier 2 for any missing card (`fillFromTypical`)
without changing what is stored.

**Open line flow.** Opening a line calls `onFreezeOrder(delta.order)`; closing releases it. A line
that stops being priced (for instance Type -> Mini-home with Below-grade open) closes itself. The
specifics start closed each time a line opens; closing either leaves edit mode.

**Reuse of the Points cards.** `BaselineEditor` renders the same `CategoryCard` and `WallBuilder`
with `variant="baseline"` (amber styling, preset row, no diagram or Excel export) and the same
`usePicks` functions, so exclusive groups and clearing behave as on Points. Its points target is
fixed at 10 whatever the header Tier shows.

## 7. Screens

- **Wide (900 px and up):** a 250 px sidebar (House card, Compared with card, Prices footnote with override count and "reset all") beside the statement (headline card, seven lines, Total, "Costs are not printed."). An open line becomes its own card with a sticky header; the list splits around it.
- **Narrow (below 900 px):** the sidebar becomes two `Disclosure` strips above the headline; the Prices footnote moves to the bottom; 44 px minimum targets; the specifics table stacks per row; the editor is a page.
- **Empty state:** headline "$0", a prompt to pick on Points, and a sentence saying what the baseline means.
- **Dialogs:** the usual-house editor (title "Your usual house", live line under the title) and the one-card view. Scrolling lives in `.dialog-body` so a scrollbar click does not close the dialog (I3-5); the dialog opens in `useLayoutEffect` so a child's scroll-to-card works (I3-3). Height uses `100dvh` with a `100vh` fallback.
- **Theme:** sun/moon icon toggle; warm stone light palette; `--viz-*` tokens have dark values.
- **Accessibility done:** tablist keyboard model, `aria-expanded` on disclosures, live region on the editor's cost line, Close autofocused in dialogs, focus returns to the Cost tab when the phone editor page closes. Known gaps are in section 11.

## 8. Stand-in prices

`src/costing/data/stand-in-costs.json`: 143 rows. Sources: 19 LEEP Ontario, 2 LEEP Manitoba,
122 placeholder. By category: above-ground walls 78, water heating 40, HRV 9, windows and doors 6,
airtightness 6, below-grade 4.

`scripts/build-stand-in-costs.js` (`npm run build:costs`) reads
`25_Working/made-up-numbers-db/htap-walls-mapped.json` from the project repo (override with
`STAND_IN_HTAP`) and `src/data/generated/wall-data.json`. Rules: LEEP rows only, Ontario preferred,
else the median of other regions (R13); placeholders for wall layers derived from LEEP rows of the
same family and kept monotone (R14, R18); flat invented numbers for cladding, windows, doors,
airtightness, below-grade assemblies, HRVs and water heaters. The script throws if a wall option has
no LEEP row and no placeholder rule. `PRICE_SOURCE_LABEL` is computed from the regions actually
present in the table (R44); `SECOND_LINE` in `delta.js` is a separate hard-coded sentence.

## 9. Tests

`npm test` runs 729 tests in 44 files, 12 to 20 s depending on load. Costing and client modules: 153 tests in 17 files, the
largest being `priceHouse` (21), `specifics` (20), `delta` (17), `client` (14). Worth knowing:

- `optionMap.test.js` asserts every Points card option value has a price id and a priced row.
- `baselines.test.js` asserts each archetype's Typical Tier 2 scores at least 10.
- `assumedAssemblies.test.js` asserts every assumed wall and foundation computes within its level.
- `variantParity.test.jsx` asserts Points renders as on `main`.
- `styles.contrast.test.js` asserts the three `--viz-*` text colours reach 4.5:1 in light and dark.
- `src/components/__testing__/costHarness.jsx` drives `CostTab` with live state the way App does; `CostTab` keeps local fallbacks for `level3`, `includesOpen` and `baseStrip` so the harness works without App.

## 10. Implementation decisions worth keeping

These were execution rulings (cited in code comments as `R<n>`) that still shape the code. The
ledger they came from is archived (section 13); this list is what a future builder needs.

- **Units at the seam between table and store:** the specifics table emits display units; `CostTab` converts only m2 values; stored overrides are metric. (R3)
- **Every result in every state has the full shape** (`unit`, `quantity`, `perUnit`, `components`, `lineOverride`), so consumers never branch on presence. (R23)
- **Line unit vs on-top components:** a line override covers only components priced in the line's unit; doors stay on top. (R24)
- **Sized rows override by `option@size`.** (R25)
- **Override precedence and counting:** side key beats `both` key per field; the count is the union of applied keys over both houses; keys under an active line override are dormant and not counted. (R26, I2-4, I2-5)
- **A baseline with no pick for a card** makes that line `notPriced` with the reason "[baseline] has no pick for this card". (R28)
- **A missing baseline pick means the preset value**; Clear in the editor returns a card to its preset; an empty wall selection counts as the preset wall. (R32, R42)
- **Exclusive groups in the editor:** `selectionsToPicks` drops preset-only values of the other members of a selected card's group, so the builder may change the usual house's water heater. (R31)
- **HRV above the largest size is `notPriced`**, not "partly priced". (R15, R22)
- **House number fields keep a local draft** and commit only finite in-range values; invalid input is never stored. (R40)
- **Dormant overrides are kept**, not deleted, when the item stops being priced.
- **The `both` edit on a same-displayed row** writes one override per distinct `priceId`. (I2-3)
- **Dialog mechanics:** open in `useLayoutEffect`; scroll in `.dialog-body`; Esc may fire `onClose` twice (keydown and `cancel`), so close handlers must stay idempotent. (I3-3, I3-5, I3-9)
- **Skip the tab-bar scroll** when the phone editor page opens with a `focusCard`. (I3-4)
- **`.headline` keeps `var(--primary)`**; viz colours are for figures only. (I2-2)

## 11. Prototype debt: what the real build must revisit

Ordered by how much it matters.

**The cost-system seam (D2, due 2026-10-31)**
1. `lookupCost` is synchronous and per item; `priceHouse` and `useHouseCost` run inside `useMemo` with no loading, error or partial-result state. Volta's API will need one batched request per house state and a loading state in the UI. Revision 2 called this "the only UI-visible change the swap implies"; the claim has not been tested against a real API shape.
2. The request has no region, year or price basis. The decisions log records this as a placeholder.
3. The row fields `priceHouse` depends on (`material`, `labour`, `unit`, `priced_item`, `source`) and the match-key semantics (exact size, no substitution) are an implicit contract. Write them into D2 or change `priceHouse`.
4. Two decisions-log items differ from the build: Volta's locked "equipment requested by spec range" versus the build's HRV size class, and "two requests per category" versus one lookup per part.

**Placeholder data and assumptions (all labelled in the UI or decisions log)**
5. 122 of 143 prices are invented; the rest are LEEP Ontario and Manitoba 2013-2016.
6. Archetype geometry, door area (1.9 m2), airtightness as one row per level, below-grade as one figure per level, and the assumed wall per RSI level are all placeholders. "BEA to define the real set" of assemblies is an open to-do.
7. Which wall types are priced, whether doors are costed, window cost drivers beyond frame material, and the price basis are "not decided" in the decisions log.
8. `ROUNDING_UNIT` is 500 and `SECOND_LINE` names placeholder prices; neither is tied to `USING_STAND_IN`, so switching to real data means editing three places by hand.

**Open product calls**
9. Layers visible and material/labour split (Ryan, built) versus layers hidden and one price (Mark's working assumption).
10. Uncertainty shown as stated assumptions only (built) versus "directional ranges" (contract assumption 4; Mark "not 100% decided").
11. Revision 2's "never a third tab" versus the Capability 2 Optimize tab. The `TabBar` tests need a deliberate amendment when that lands.

**Known gaps in what is built**
12. "assumed assembly" still appears in the above-ground wall's line description (`priceHouse.js` line 97, "RSI x, assumed assembly: ...") and "assumed:" in the below-grade one (line 109), against revision 3 section 4.1, which wants "priced as [assembly]".
13. In the narrow edit table, "Both houses" inputs are aria-named "This design" (I2-9).
14. The read-only Code minimum points counter ignores the RSI 2.97 wall and may understate its points.
15. "change house" for ventilation with more than 5 bedrooms should focus the designed-airflow field; doors accept non-integers.
16. The per-line provenance sentence (`sourceSentence`, R44) was removed from the code although revision 3 said it would stay. Whoever designs provenance rebuilds it from the components' `source` fields, which are still carried.
17. `chipHidden` is persisted but nothing reads it since the chip was removed; drop it at the next schema bump.
18. Spec text that no longer describes the build: revision 2 sections 2.3 (chip), 3.1 (dropdown, "assumed" tags), 4 to 4.2 (ladder), 5 (Cancel/Done, discard prompt) and revision 3 section 3.2 (read-only editor, replaced by the one-card dialog).

**Code hygiene for the hardening pass**
19. Dead or test-only exports: `USING_STAND_IN`, `requestCosts`, `COSTED_CATEGORIES`, `appliedOverrideCount`, `sqFtToM2`, `LEEP_REGION_ORDER`, `sortRegions`, the `PriceCell` component (only `draftOf` is used), `sizeUnit` in the data.
20. Duplicates: `SQFT_PER_M2` as a literal in the build script; four money formatters (`units.js`, `delta.js`, `specifics.js`, `PriceCell.jsx`); HRV and water-heater size lists in both `optionMap.js` and the build script; sheathing and cladding id maps in both `wallLayers.js` and `assumedAssemblies.js`; water-heater wording in `BaselinePicker`, `baselines.js` and `specifics.js`; `designPicks` versus `selectionsToPicks`.
21. Override keys are parsed by splitting on `/`, which assumes no segment contains one.
22. `assumedAssemblies.js` imports `@scripts/compute.js` into the browser bundle to compute foundation RSI.
23. No migration path in `persist.js`; a schema bump wipes the usual house and overrides.
24. `CLAUDE.md` in this repo says "branch cost-ui" and 652 tests (fixed alongside this file).

## 12. Not built, by decision

Real prices and the Volta API; Capability 3; saving designs; any print change; French; Cost-tab
telemetry; the below-grade wall builder merge (Mark's `cost-layer` branch, bead cdb-ba4); quantified
uncertainty; a page-level Basic / Advanced switch; per-layer prices below grade; HRV ducting rows;
provenance display; pricing steel and ICF walls.

## 13. Where the history is

In the project repo `/srv/clients/BTZx/cost-DB-and-ECP/25_Working/ECP_Tool/`:

- `specs/2026-10-01-ecp-cost-ui-design.md` (revision 2), `specs/2026-10-02-ecp-cost-ui-design-rev3.md` (revision 3) and `specs/2026-10-01-ecp-cost-ui-design-review.md`: the design as planned. Kept as history; section 11 item 18 lists what in them is dead.
- `framing/2026-10-01-ecp-cost-ui-presentation.md`: the framing memo.
- `plans/archive/`: the three implementation plans, three execution ledgers (R1 to R45 and the unnumbered iteration 2 and 3 rulings) and the iteration 2 handoff. Scaffolding for the subagent runs; superseded by the code and this file.
- `cost-ui-2-pricing-digest.md`: how the stand-in prices were derived, in detail.
- `/srv/clients/BTZx/cost-DB-and-ECP/25_Working/decisions-log.md`: Mark's locked / working-assumption / placeholder record for the whole project.

Whiteboard `ecp-cost-ui-brainstorm` (https://bae.tailf67313.ts.net:9443/#ecp-cost-ui-brainstorm):
page 10 "Iteration 2 mix" (the approved revision 3 design), page 11 (palette option C), page 12
"Usual house editor options" (iteration 3).

Git: `git log main..cost-ui-2` is the build in 49 commits; iteration 1 ends at 30bdcc8, iteration 2
at 479387e, iteration 3 at a80f8a6, and e33d1f3 removes the chip.
