# Wall Builder Updates — Design Document

Date: 2026-02-19

## Overview

Add two new wall types (Steel Frame, ICF) to the ECP Calculator's wall builder, split continuous insulation into type + thickness fields, split cavity insulation into material + type fields, and move all RSI calculations to pre-computed lookup tables.

## Requirements

Source: `wallbuilderupdates.md`

1. Three wall types: Wood Frame (existing), Steel Frame (new), ICF (new)
2. Steel framing: C-channel studs, same spacing options as wood (16", 19", 24"), different RSI due to thermal bridging
3. ICF: EPS foam form + 8" concrete core, form thicknesses 2.5", 3-1/8", 4-1/4" per side. No stud cavity, no continuous insulation.
4. Continuous insulation split into Type (EPS, XPS, PIC, Mineral Wool) + Thickness (None, 1", 1-1/2", 2", 2-1/2", 3")
5. Cavity insulation split into Material (Fiberglass Batt, Mineral Wool Batt, Loose Fill Cellulose, Dense Pack Cellulose, Loose Fill Fiberglass) + Type (2x4 R12, 2x4 R14, 2x6 R20, 2x6 R22, 2x6 R24)
6. All RSI calculations via pre-computed lookup tables (no live parallel path calculation)
7. SVG cross-section diagrams for all three wall types
8. Data-driven UI: adding materials/types/wall types requires only data changes, no UI code changes

## Design Decisions

### Approach: Layered Lookup (Parallel Path + Isothermal Planes)

Two lookup layers mirror the physics:

- **Parallel path lookup** — Pre-computed RSI for the framed wall portion. Keyed by wallType x spacing x cavityMaterial x cavityType. This replaces the live `calculateWallRsi()` parallel path calculation. Ryan provides all values.
- **Isothermal planes** — Simple series addition at runtime: `framedWallRsi + continuousInsRsi + BASE_RSI`. The continuous insulation RSI is a separate lookup by type x thickness.
- **ICF** — Fully pre-computed RSI per form thickness (pure isothermal planes: EPS + concrete + EPS). Single lookup.

Why not a single flat table with all combinations? The continuous insulation RSI is independent of the framed wall (it's added in series), so separating them keeps the data compact (~30 framed wall entries + ~20 continuous ins entries vs ~600+ flat entries) and easier to maintain.

### All Lookup Tables (No Live Calculation)

The current `calculateWallRsi()` does live parallel path math for wood framing. Steel framing thermal bridging is more complex and not well served by a simple formula. Moving everything to lookup tables:
- Ensures consistency (Ryan verifies all values)
- Handles steel's complex thermal bridging without formula complexity
- Makes the code simpler (lookup vs. calculation)

### Progressive Disclosure UI

Wall Type selector is always visible. Selecting a type reveals only the relevant fields:
- Wood/Steel: Stud Spacing, Cavity Material, Cavity Type, Cont. Ins. Type, Cont. Ins. Thickness
- ICF: EPS Form Thickness only

### Preserve Downstream Selections

Changing an upstream field (e.g., stud spacing) does NOT clear downstream selections. Instead, selections are preserved and RSI is recalculated. If the combination doesn't exist in the lookup table, a "no data" message is shown. Exception: changing Wall Type clears everything (fundamentally different wall construction).

## Data Layer (`ecpData.js`)

### New Exports

```js
export const wallTypes = [
  { id: 'wood',  label: 'Wood Frame' },
  { id: 'steel', label: 'Steel Frame' },
  { id: 'icf',   label: 'ICF' }
]

export const cavityMaterials = [
  'Fiberglass Batt',
  'Mineral Wool Batt',
  'Loose Fill Cellulose',
  'Dense Pack Cellulose',
  'Loose Fill Fiberglass'
]

export const cavityTypes = [
  '2x4 R12', '2x4 R14', '2x6 R20', '2x6 R22', '2x6 R24'
]

export const continuousInsTypes = ['EPS', 'XPS', 'PIC', 'Mineral Wool']

export const continuousInsThicknesses = [
  'None', '1"', '1-1/2"', '2"', '2-1/2"', '3"'
]

export const icfFormOptions = ['2.5"', '3-1/8"', '4-1/4"']
```

### Lookup Tables

```js
// Parallel path pre-computed RSI: wallType -> spacing -> cavityMaterial -> cavityType -> RSI
export const framedWallRsi = {
  wood: {
    '16"': {
      'Fiberglass Batt': { '2x4 R12': ??, '2x4 R14': ??, '2x6 R20': ??, '2x6 R22': ??, '2x6 R24': ?? },
      'Mineral Wool Batt': { ... },
      // ... other materials
    },
    '19"': { ... },
    '24"': { ... }
  },
  steel: {
    '16"': { ... },
    '19"': { ... },
    '24"': { ... }
  }
}

// Continuous insulation RSI: type -> thickness -> RSI
export const continuousInsRsi = {
  'EPS':          { 'None': 0, '1"': 0.65, '1-1/2"': 0.98, '2"': 1.30, '2-1/2"': ??, '3"': ?? },
  'XPS':          { 'None': 0, '1"': 0.88, '1-1/2"': 1.28, '2"': 1.68, '2-1/2"': ??, '3"': ?? },
  'PIC':          { 'None': 0, '1"': 0.97, '1-1/2"': 1.39, '2"': 1.80, '2-1/2"': ??, '3"': ?? },
  'Mineral Wool': { 'None': 0, '1"': ??,   '1-1/2"': ??,   '2"': ??,   '2-1/2"': ??, '3"': ?? }
}

// ICF total RSI (fully pre-computed): formThickness -> RSI
export const icfRsi = {
  '2.5"':   ??,
  '3-1/8"': ??,
  '4-1/4"': ??
}
```

### Revised `calculateWallRsi()`

```js
export function calculateWallRsi(wallType, studSpacing, cavityMaterial, cavityType, contInsType, contInsThickness) {
  // ICF path
  if (wallType === 'icf') {
    return icfRsi[arguments...] ?? null
  }

  // Wood/Steel path: parallel path lookup + isothermal planes sum
  const framed = framedWallRsi[wallType]?.[studSpacing]?.[cavityMaterial]?.[cavityType]
  const contIns = continuousInsRsi[contInsType]?.[contInsThickness]
  if (framed == null || contIns == null) return null

  return framed + contIns + BASE_RSI
}
```

`getWallPoints(rsi)` unchanged.

### Removed Exports

- `cavityInsulationOptions` — replaced by `cavityMaterials` + `cavityTypes`
- `continuousInsulationOptions` — replaced by `continuousInsTypes` + `continuousInsThicknesses`
- `studSpacingOptions` framing fractions no longer needed (pre-computed in lookup)

## UI Flow (WallBuilder)

### Progressive Disclosure

```
Always visible:
  [Wall Type ▼]

If Wood or Steel:
  Framing:
    [Stud Spacing ▼] [Cavity Material ▼] [Cavity Type ▼]
  Continuous Insulation:
    [Type ▼] [Thickness ▼]

If ICF:
  [EPS Form Thickness ▼]
```

### Dropdown Filtering

Cavity Type dropdown only shows options that exist in the lookup table for the selected wallType + spacing + material. If the current combination has no entries, the dropdown is empty/disabled.

### Cascade Behavior

- Changing Wall Type: clears all downstream fields
- Changing any other field: preserves all selections, recalculates RSI
- If a combination is missing from the lookup: show "No data for this combination" instead of RSI/points

### Simple Mode

Unchanged. Direct RSI option buttons, no wall type selection needed.

## SVG Diagrams (WallSection)

### Shared

All three types share: label system with leader lines, INTERIOR/EXTERIOR labels, responsive viewBox sizing.

### Wood Frame (existing, unchanged)

Layers: drywall -> stud cavity (brown studs with X-pattern, batt insulation between) -> sheathing -> continuous insulation (if any) -> cladding.

### Steel Frame (new)

Same layer structure as wood. Differences:
- Studs rendered as C-channel outline (thin-walled open rectangle) instead of filled rectangle with X
- C-channel is hollow (not filled with insulation) — cavity insulation fills bays between studs only
- Steel gray color (#94a3b8) instead of brown
- Implementation note: C-channel rendering at small SVG scale needs visual iteration. Use Playwright to screenshot and refine until it reads clearly.

### ICF (new)

Layers: drywall -> EPS foam (variable, per-side thickness) -> 8" concrete core -> EPS foam (variable) -> cladding.
- No studs, no sheathing, no stud spacing dimension line
- Concrete: dark gray (#6b7280) with speckle/aggregate pattern
- EPS: pink with same insulation pattern as continuous insulation
- Wall much thicker than framed walls (13"-16.5" total)

### WallSection Props Update

```jsx
<WallSection
  wallType="wood"              // NEW: 'wood' | 'steel' | 'icf'
  studDepth="2x6"              // wood/steel only
  studSpacing={16}             // wood/steel only
  continuousIns={2}            // wood/steel only (inches)
  cavityInsLabel="2x6 R20"    // wood/steel only
  continuousInsLabel="2\" XPS" // wood/steel only
  icfFormThickness={3.125}     // ICF only (inches per side)
/>
```

## State Management

### wallSelection Shape

```js
// Wood/Steel:
{
  wallType: 'wood',
  studSpacing: '16"',
  cavityMaterial: 'Fiberglass Batt',
  cavityType: '2x6 R20',
  contInsType: 'XPS',
  contInsThickness: '2"'
}

// ICF:
{
  wallType: 'icf',
  icfFormThickness: '3-1/8"'
}

// Simple mode (unchanged):
{ simpleIndex: 3 }

// Empty (unchanged):
{}
```

### wallPoints Derivation (App.jsx)

Updated to pass new fields to revised `calculateWallRsi()`. Logic otherwise unchanged: lookup RSI, then `getWallPoints(rsi)`.

## Data Provision

Ryan will provide all `??` values:
- `framedWallRsi`: RSI for every valid wallType x spacing x cavityMaterial x cavityType combination
- `continuousInsRsi`: RSI for new thicknesses (2-1/2", 3") and Mineral Wool
- `icfRsi`: Total RSI for 2.5", 3-1/8", 4-1/4" form thicknesses
