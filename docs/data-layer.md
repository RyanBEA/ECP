# ECP Calculator — Data Layer Reference

**File:** `src/data/ecpData.js`

Single source of truth for all ECP thresholds, category definitions, and calculation functions. No network calls, no side effects — everything is synchronous and deterministic.

## Exports Summary

| Export | Type | Description |
|--------|------|-------------|
| `categories` | Array<Category> | 8 building component categories with options and point values |
| `tiers` | Array<Tier> | Tier 2 and Tier 3 definitions with point targets |
| `wallTypes` | Array | 3 wall types: wood, steel, icf |
| `studSpacingOptions` | Array | 3 stud spacing options (16", 19", 24") |
| `cavityMaterials` | Array | 5 cavity insulation material names |
| `cavityTypes` | Array | 5 cavity insulation types (stud size + R-value) |
| `continuousInsTypes` | Array | 4 continuous insulation types (EPS, XPS, PIC, Mineral Wool) |
| `continuousInsThicknesses` | Array | 6 thickness options (None through 3") |
| `icfFormOptions` | Array | 3 ICF form thickness options |
| `framedWallRsi` | Object | Pre-computed parallel path RSI lookup (wallType → spacing → material → type) |
| `continuousInsRsi` | Object | Continuous insulation RSI lookup (type → thickness) |
| `icfRsi` | Object | ICF total RSI lookup (formThickness → RSI) |
| `wallPointsThresholds` | Array | 11 RSI-to-points lookup thresholds |
| `calculateWallRsi()` | Function | Lookup-based wall RSI calculation |
| `getWallPoints()` | Function | RSI-to-points lookup |

---

## Tiers

```js
export const tiers = [
  { id: 2, label: 'Tier 2', points: 10 },
  { id: 3, label: 'Tier 3', points: 20 }
]
```

- **Tier 2** — 10 ECP points (NS mandatory from April 1, 2026)
- **Tier 3** — 20 ECP points

---

## Category Schema

Each category object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier (React key, state key) |
| `name` | string | yes | Display name |
| `metric` | string | yes | Physical metric (e.g., `'RSI'`, `'ACH'`, `'EF'`) |
| `unit` | string | yes | Display unit (e.g., `'m²·K/W'`, `'ACH @ 50Pa'`) |
| `description` | string | yes | Plain-English explanation |
| `direction` | `'higher'` \| `'lower'` | yes | Whether higher or lower values earn more points |
| `type` | `'wallBuilder'` | no | If set, renders WallBuilder instead of CategoryCard |
| `exclusiveGroup` | string | no | Only one category per group can be selected (currently: `'dhw'`) |
| `options` | Array<Option> | yes | Selectable threshold objects |

Each option object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | number | yes | Threshold value in the category's metric |
| `points` | number | yes | ECP points awarded |
| `label` | string | no | Override display label (only used in `dhwGas`) |

---

## All Categories — Point Tables

### 1. Above Ground Walls (`aboveGroundWalls`)

Metric: RSI (m²·K/W), direction: higher, type: `wallBuilder`

| RSI | Points |
|-----|--------|
| 3.08 | 1.6 |
| 3.69 | 6.2 |
| 3.85 | 6.9 |
| 3.96 | 7.7 |
| 4.29 | 9.2 |
| 4.40 | 9.9 |
| 4.57 | 10.6 |
| 4.73 | 11.1 |
| 4.84 | 11.6 |
| 5.01 | 12.2 |
| 5.45 | 13.6 |

### 2. Air Tightness (`airTightness`)

Metric: ACH @ 50Pa, direction: lower

| ACH | Points |
|-----|--------|
| 2.5 | 0 |
| 2.0 | 3.5 |
| 1.5 | 6.9 |
| 1.0 | 10.4 |
| 0.6 | 13.3 |

### 3. Below Grade Walls (`belowGradeWalls`)

Metric: RSI (m²·K/W), direction: higher

| RSI | Points |
|-----|--------|
| 3.09 | 0.2 |
| 3.46 | 0.8 |
| 3.90 | 1.4 |

### 4. DHW Electric (`dhwElectric`)

Metric: EF (Energy Factor), direction: higher, exclusiveGroup: `dhw`

| EF | Points |
|----|--------|
| 2.35 | 3.8 |

Single threshold — effectively a heat pump water heater minimum.

### 5. DHW Non-Electric (`dhwGas`)

Metric: UEF (Uniform Energy Factor), direction: higher, exclusiveGroup: `dhw`

| UEF | Points | Label |
|-----|--------|-------|
| 0.79 | 2.4 | Commercial Storage-type |
| 0.83 | 4.9 | Residential Storage-type |
| 0.85 | 3.2 | Commercial Storage-type |
| 0.92 | 4.9 | Tankless Condensing |

Only category using the `label` field — equipment type matters, not just the metric value.

### 6. Heat Recovery Ventilation (`hrv`)

Metric: SRE (%), direction: higher

| SRE | Points |
|-----|--------|
| 65 | 0.7 |
| 75 | 2.2 |
| 84 | 3.5 |

### 7. Heated Volume (`volume`)

Metric: Volume (m³), direction: lower

| Volume (m³) | Points |
|-------------|--------|
| 390 | 1 |
| 380 | 2 |
| 370 | 3 |
| 360 | 4 |
| 350 | 5 |
| 340 | 6 |
| 330 | 7 |
| 320 | 8 |
| 310 | 9 |
| 300 | 10 |

Linear: 1 point per 10 m³ reduction.

### 8. Windows & Doors (`windowsDoors`)

Metric: U-value (W/m²·K), direction: lower

| U-value | Points |
|---------|--------|
| 1.44 | 1.6 |
| 1.22 | 6.2 |

---

## Wall Assembly Data

### Wall Types (`wallTypes`)

| ID | Label |
|----|-------|
| `wood` | Wood Frame |
| `steel` | Steel Frame |
| `icf` | ICF |

### Stud Spacing (`studSpacingOptions`)

| Label |
|-------|
| 16" |
| 19" |
| 24" |

### Cavity Insulation Materials (`cavityMaterials`)

Fiberglass Batt, Mineral Wool Batt, Loose Fill Cellulose, Dense Pack Cellulose, Loose Fill Fiberglass

### Cavity Insulation Types (`cavityTypes`)

2x4 R12, 2x4 R14, 2x6 R20, 2x6 R22, 2x6 R24

### Continuous Insulation Types (`continuousInsTypes`)

EPS, XPS, PIC, Mineral Wool

### Continuous Insulation Thicknesses (`continuousInsThicknesses`)

None, 1", 1-1/2", 2", 2-1/2", 3"

### ICF Form Options (`icfFormOptions`)

2.5", 3-1/8", 4-1/4" (per side)

---

## Lookup Tables

### Framed Wall RSI (`framedWallRsi`)

Pre-computed parallel path RSI values. Keyed by: `wallType → spacing → cavityMaterial → cavityType → RSI`.

**Seeded values (wood + Fiberglass Batt):**

| Spacing | 2x4 R12 | 2x4 R14 | 2x6 R20 | 2x6 R22 | 2x6 R24 |
|---------|---------|---------|---------|---------|---------|
| 16" | 1.56 | 1.75 | 2.36 | 2.63 | 2.81 |
| 19" | 1.59 | 1.79 | 2.42 | 2.70 | 2.89 |
| 24" | 1.64 | 1.85 | 2.51 | 2.81 | 3.01 |

These are **parallel path component only** — BASE_RSI and continuous insulation added at runtime (isothermal planes).

All other combinations (wood + non-fiberglass, steel + all, ICF) are `null` pending data from Ryan.

### Continuous Insulation RSI (`continuousInsRsi`)

| Type | None | 1" | 1-1/2" | 2" | 2-1/2" | 3" |
|------|------|-----|--------|-----|--------|-----|
| EPS | 0 | 0.65 | 0.98 | 1.30 | 1.63 | 1.95 |
| XPS | 0 | 0.88 | 1.28 | 1.68 | 2.10 | 2.52 |
| PIC | 0 | 0.97 | 1.39 | 1.80 | 2.22 | 2.64 |
| Mineral Wool | 0 | null | null | null | null | null |

### ICF RSI (`icfRsi`)

| Form Thickness | Total RSI |
|---------------|-----------|
| 2.5" | null |
| 3-1/8" | null |
| 4-1/4" | null |

All null — pending data from Ryan.

---

## `calculateWallRsi(params)`

**Parameter:** Object with fields: `{ wallType, studSpacing, cavityMaterial, cavityType, contInsType, contInsThickness, icfFormThickness }`

**Returns:** `number` (total RSI in m²·K/W) or `null` if any lookup fails.

**Algorithm:**

```
Constants:
  BASE_RSI = 0.44547  (drywall + sheathing + air films)

ICF path:
  return icfRsi[icfFormThickness]  (fully pre-computed, or null)

Wood/Steel path:
  Step 1 — Lookup parallel path RSI:
    framedRsi = framedWallRsi[wallType][spacing][material][type]

  Step 2 — If no continuous insulation:
    return framedRsi + BASE_RSI

  Step 3 — Lookup continuous insulation RSI:
    contIns = continuousInsRsi[contInsType][contInsThickness]

  Step 4 — Isothermal planes sum:
    return framedRsi + contIns + BASE_RSI
```

**Worked example** (wood, 16", Fiberglass Batt, 2x6 R20, 2" XPS):

```
framedRsi   = framedWallRsi.wood['16"']['Fiberglass Batt']['2x6 R20'] = 2.36
contIns     = continuousInsRsi['XPS']['2"'] = 1.68
totalRsi    = 2.36 + 1.68 + 0.445 = 4.485 → 4.49 displayed → 9.9 ECP points
```

### `getWallPoints(rsi)`

**Parameter:** `number | falsy` — calculated wall RSI.

**Returns:** `number` — ECP points (0 if RSI is below 3.08 or falsy).

**Algorithm:** Sorts `wallPointsThresholds` descending by `minRsi`, returns points for the first threshold where `rsi >= threshold.minRsi`. Returns the best (highest) threshold met.

### Wall Points Thresholds (`wallPointsThresholds`)

| Min RSI | Points |
|---------|--------|
| 3.08 | 1.6 |
| 3.69 | 6.2 |
| 3.85 | 6.9 |
| 3.96 | 7.7 |
| 4.29 | 9.2 |
| 4.40 | 9.9 |
| 4.57 | 10.6 |
| 4.73 | 11.1 |
| 4.84 | 11.6 |
| 5.01 | 12.2 |
| 5.45 | 13.6 |

Identical to `aboveGroundWalls.options` — dual representation for builder mode vs. simple mode.

---

## Maximum Achievable Points

| Category | Max Points |
|----------|-----------|
| Above Ground Walls | 13.6 |
| Air Tightness | 13.3 |
| Below Grade Walls | 1.4 |
| DHW Electric | 3.8 |
| DHW Non-Electric | 4.9 |
| HRV | 3.5 |
| Volume | 10.0 |
| Windows & Doors | 6.2 |

DHW categories are mutually exclusive. Best-case total: ~52.9 (using DHW Non-Electric at 4.9).

---

## Pending Data

Ryan will provide lookup table values for:
- `framedWallRsi.wood` — all materials except Fiberglass Batt
- `framedWallRsi.steel` — all combinations
- `continuousInsRsi['Mineral Wool']` — all thicknesses
- `icfRsi` — all form thicknesses
- `continuousInsRsi` 2-1/2" and 3" values for EPS, XPS, PIC (currently extrapolated linearly — verify)

---

## CSV Reference Files

CSV files in the project root are **not loaded at runtime**. They are source documentation for the threshold values in `ecpData.js`. When updating thresholds, both the CSV and the JS must be updated manually.

| File | Content |
|------|---------|
| `aboveGroundWalls.csv` | RSI thresholds |
| `airTightness.csv` | ACH thresholds (contains extra rows not in JS — possible Tier 3 data) |
| `belowGradeWalls.csv` | Below-grade RSI thresholds |
| `DHW.csv` | Electric DHW thresholds |
| `DHWgas.csv` | Gas/propane DHW thresholds |
| `HRV.csv` | HRV efficiency thresholds |
| `windowsAndDoors.csv` | U-value thresholds |
| `Volume.csv` | Heated volume thresholds |
| `wallcalc/*.csv` | Wall assembly calculation inputs (framing, insulation) |
