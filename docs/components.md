# ECP Calculator — Components Reference

All components live in `src/components/` except `App.jsx` (root) and `WallSectionDemo.jsx` (dev harness).

---

## App (`src/App.jsx`)

Root component. Owns all application state. No props.

### State

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `darkMode` | boolean | `window.matchMedia('(prefers-color-scheme: dark)').matches` | Toggles `.dark` class on `<body>` via useEffect |
| `selectedTierId` | number | `2` | Tier selector value |
| `selections` | `{ [categoryId]: number }` | `{}` | Option index per standard category |
| `wallSelection` | object | `{}` | Wall builder state (see WallBuilder) |

### Derived (useMemo)

- **`wallPoints`** — From `wallSelection`: if `simpleIndex` is set, reads `categories[wall].options[simpleIndex].points`. Otherwise calls `calculateWallRsi(wallSelection)` → `getWallPoints()`.
- **`totalPoints`** — Sum of all `selections` option points + `wallPoints`.

### Key Functions

- **`handleSelect(categoryId, optionIndex)`** — Sets option for a category. If the category belongs to an `exclusiveGroup`, clears all other group members first. Pass `optionIndex: null` to clear.
- **`isDisabled(category)`** — Returns `true` if another category in the same exclusive group has a selection.

### Rendering

Iterates `categories` array. If `category.type === 'wallBuilder'`, renders `<WallBuilder>`. Otherwise renders `<CategoryCard>`.

---

## OptionButton (`src/components/OptionButton.jsx`)

Stateless button for a single selectable threshold option.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `option` | `{ value, points, label? }` | yes | Option data |
| `direction` | `'higher'` \| `'lower'` | yes | Determines `≥` or `≤` prefix on value |
| `metric` | string | yes | Accepted but not rendered (reserved for future use) |
| `isSelected` | boolean | yes | Controls `.selected` CSS class |
| `onClick` | `() => void` | yes | Click handler (no arguments passed) |

### Rendering

```
[option.label]     ← only when label is truthy (adds .has-label class)
≥ 3.08             ← or ≤ for direction: 'lower'
+1.6 pts
```

---

## CategoryCard (`src/components/CategoryCard.jsx`)

Stateless card for a standard (non-wall) category. Renders category info + an OptionButton grid.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `category` | Category object | yes | Full category definition from ecpData |
| `selectedOption` | `number \| null` | yes | Index into `category.options`, or `null` |
| `onSelect` | `(categoryId, optionIndex \| null) => void` | yes | Selection callback |
| `disabled` | boolean | yes | Disables all interaction (DHW mutual exclusion) |

### Behaviors

- **Disabled state:** When `disabled` is true, adds `.disabled` CSS class and guards all click handlers.
- **Clear button:** Visible only when `selectedOption !== null`. Calls `onSelect(category.id, null)`.
- **Option click:** Calls `onSelect(category.id, index)`.

### Communication

Purely controlled — no internal state. Parent (App.jsx) handles exclusive group logic; CategoryCard has no awareness of groups.

---

## WallBuilder (`src/components/WallBuilder.jsx`)

Dual-mode wall assembly input: "Build Assembly" (builder) or "Select RSI" (simple). Builder mode uses progressive disclosure based on wall type selection.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selection` | object | yes | Wall state from App.jsx (may be `{}`) |
| `onSelect` | `(newSelection) => void` | yes | Replaces entire wall selection in App.jsx |

### Wall Selection Object Shape

```js
// Builder mode — single wall (wood/steel):
{
  wallType: 'wood',
  assemblyType: 'single',          // default
  studSpacing: '16"',
  cavityMaterial: 'Fiberglass Batt',
  cavityType: '2x6 R20',
  contInsType: 'XPS',
  contInsThickness: '2"',
  claddingId: 'vinyl_siding',      // optional (default per wall type)
  sheathingId: 'osb_11',           // optional (wood only, default OSB)
}

// Builder mode — double stud (wood only):
{
  wallType: 'wood',
  assemblyType: 'doubleStud',
  studSpacing: '16"',
  outerStud: '2x4',
  innerStud: '2x4',
  plate: '2x10',
  doubleStudMaterial: 'Dense Pack Cellulose',
}

// Builder mode — ICF:
{ wallType: 'icf', icfFormThickness: '3-1/8"' }

// Simple mode:
{ simpleIndex: 3 }

// Empty (initial):
{}
```

Builder fields and `simpleIndex` are mutually exclusive. Mode switching calls `onSelect({})` to wipe everything. Changing `wallType` clears all downstream fields. Changing `cavityMaterial` clears `cavityType` (available cavity sizes differ per material). Changing `assemblyType` clears framing/cavity fields.

### Internal State

| State | Type | Default |
|-------|------|---------|
| `mode` | `'builder'` \| `'simple'` | `'builder'` |
| `exporting` | boolean | `false` |

### Refs

| Ref | Target | Purpose |
|-----|--------|---------|
| `wallSectionRef` | `.wall-section-container` div | Provides SVG element access for Excel export PNG embedding |

### Builder Mode — Progressive Disclosure

1. **Wall Type selector** — always visible (Wood Frame, Steel Frame, ICF)
2. **Assembly Type toggle** — shown for wood walls: Single Wall / Double Stud
3. **Boundary Layers group** — shown for wood/steel:
   - **Cladding** dropdown: 8 options from `boundary-options.json` (vinyl, brick, fibre cement, etc.)
   - **Sheathing** dropdown (wood only): 7 options (OSB, plywood, gypsum)
4. **Single wall fields** (default) — shown for wood/steel when `assemblyType === 'single'`:
   - **Framing group**: Stud Spacing, Cavity Insulation (material), Cavity Size (type)
   - Cavity Size now includes deep cavities (2x8, 2x10, 2x12) for blown-in materials
   - **Continuous Insulation group**: Type, Thickness
5. **Double stud fields** — shown for wood when `assemblyType === 'doubleStud'`:
   - Stud Spacing, Outer Studs (2x4/2x6), Inner Studs (2x4/2x6), Plate Width (2x8-2x12, auto-filtered), Insulation (blown-in only)
6. **ICF field** — shown when `wallType` is `'icf'`:
   - EPS Form Thickness (per side)

When all required fields are populated:
- Calculates RSI via `calculateWallRsi(selection)`
- Displays RSI value and points via `getWallPoints()`
- Renders `WallSection` SVG diagram
- Shows "Export to Excel" button below the diagram

### Export to Excel

When the user clicks "Export to Excel" (visible only when RSI is valid):
1. `handleExport()` sets `exporting` state to `true` (button shows "Exporting...")
2. Queries `wallSectionRef.current.querySelector('svg')` for the SVG element
3. Calls `exportWallAssembly(selection, svgElement)` from `src/utils/exportWallAssembly.js`
4. The orchestrator dynamically imports ExcelJS, resolves intermediate values, builds the sheet with live formulas, converts SVG to PNG, and triggers a browser download
5. On completion (or error), `exporting` resets to `false`

The export is entirely client-side — no server component. ExcelJS is code-split into its own chunk (~938KB) and only loaded on first export click.

#### Sub-Code Warning

If the calculated RSI is below `MIN_WALL_RSI` (2.97):
- The result area displays the RSI value in red (`--danger` CSS variable)
- Shows the NBC 2020 minimum RSI requirement (2.97 m²·K/W)
- Displays a warning message alerting the user the assembly does not meet code minimum
- The user can still proceed to calculate points, but the visual warning makes the code violation clear

When RSI >= 2.97, the result displays normally in the standard point color.

### Simple Mode

Renders `OptionButton` grid from `wallCategory.options`. Selection tracked by `simpleIndex` in the parent state.

### Helper Functions (module-level, not exported)

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `getStudDepth(cavityType)` | `'2x6 R20'` | `'2x6'` | Extract stud size for WallSection. Maps both `2x4` and `2x3-5/8` prefixes to `'2x4'` (steel uses 2x3-5/8 studs). |
| `getStudSpacingNum(studSpacing)` | `'16"'` | `16` | Convert to number for WallSection |
| `getContInsThicknessNum(thickness)` | `'1-1/2"'` | `1.5` | Extract thickness for WallSection (handles fractions) |
| `getAvailableCavityTypes(wallType, spacing, material)` | strings | Array | Returns `cavityTypesByMaterial[material]` filtered to non-null lookup values |

### WallSection Wiring

```jsx
// Wood/Steel (shown when studSpacing && cavityType are set):
<WallSection
  wallType={wallType}                               // 'wood' | 'steel'
  studDepth={getStudDepth(cavityType)}              // '2x4' | '2x6'
  studSpacing={getStudSpacingNum(studSpacing)}      // 16 | 19 | 24
  continuousIns={getContInsThicknessNum(contInsThickness)}  // 0–3
  cavityInsLabel={cavityType}                       // e.g. '2x6 R20'
  continuousInsLabel={...}                          // e.g. '2" XPS' or null
/>

// ICF (shown when icfFormThickness is set):
<WallSection
  wallType="icf"
  icfFormThickness={getContInsThicknessNum(icfFormThickness)}  // inches per side
/>
```

---

## FieldGroup (`src/components/FieldGroup.jsx`)

Presentational wrapper that renders a numbered card with a header badge and title. Used by WallBuilder to visually group related fields.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `number` | `number` | required | Group sequence number (displayed in badge) |
| `title` | `string` | required | Group heading text |
| `variant` | `'default' \| 'footnote'` | `'default'` | Visual variant — footnote uses dashed border, smaller text |
| `children` | `ReactNode` | required | Group content (dropdowns, toggles, text) |

---

## WallSection (`src/components/WallSection.jsx`)

Stateless SVG component rendering a top-down cross-section of the wall assembly. Supports three rendering modes based on `wallType`.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `wallType` | `'wood'` \| `'steel'` \| `'icf'` | `'wood'` | Determines rendering mode |
| `studDepth` | `'2x4'` \| `'2x6'` | `'2x6'` | Stud size → cavity depth (3.5" or 5.5") |
| `studSpacing` | number | `16` | On-center spacing in inches |
| `continuousIns` | number | `0` | Continuous insulation thickness (0–3 inches) |
| `cavityInsLabel` | string \| null | `null` | Overrides generic cavity label in diagram |
| `continuousInsLabel` | string \| null | `null` | Overrides generic continuous insulation label |
| `icfFormThickness` | number | `0` | ICF only: EPS form thickness per side (inches) |
| `width` | number | `600` | Accepted but unused (SVG uses `width="100%"` with viewBox) |

### Rendering Modes

#### Wood Frame (`wallType === 'wood'`)

| Layer | Thickness | Color | Pattern |
|-------|-----------|-------|---------|
| Drywall | 0.5" fixed | gray `#e5e7eb` | solid fill |
| Stud cavity | 3.5" or 5.5" | pink `#fce7f3` | batt insulation (semicircles + diagonal lines) |
| Studs | 1.5" wide at spacing | brown `#d4a574` | X cross pattern |
| Sheathing | 7/16" fixed | gray `#d1d5db` | solid fill |
| Continuous insulation | 0–3" dynamic | pink `#fce7f3` | staggered vertical lines |
| Cladding | 0.5" fixed | dark gray `#9ca3af` | solid fill |

Includes stud spacing dimension line at bottom.

#### Steel Frame (`wallType === 'steel'`)

Same layer structure as wood frame, but studs render as **C-channels** instead of solid rectangles:
- Top flange (full stud width, 1.5px thick)
- Bottom flange (full stud width, 1.5px thick)
- Web on one side (1.5px wide, full stud height)
- Color: slate gray `#94a3b8` with `#475569` stroke

The C-channel is hollow — insulation fills the bays between studs, not inside the channel.

#### ICF (`wallType === 'icf'`)

Completely different layer structure (no studs, no stud spacing):

| Layer | Thickness | Color | Pattern |
|-------|-----------|-------|---------|
| Drywall | 0.5" fixed | gray `#e5e7eb` | solid fill |
| EPS (interior) | per `icfFormThickness` | pink `#fce7f3` | staggered vertical lines |
| Concrete core | 8" fixed | gray `#6b7280` | solid fill + deterministic speckle aggregate |
| EPS (exterior) | per `icfFormThickness` | pink `#fce7f3` | staggered vertical lines |
| Cladding | 0.5" fixed | dark gray `#9ca3af` | solid fill |

Fixed 24" display width. Max SVG height 250px. No stud spacing dimension.

### Geometry

- **Scale:** 10px per inch (uniform both axes)
- **Wall length (wood/steel):** `studSpacing * 1.5` inches (shows ~2.5 studs)
- **Wall length (ICF):** 24" fixed
- **Label system:** Fixed-spacing labels on the right with leader lines pointing to each layer mid-point.
- **Responsive:** `width="100%"` on SVG with `viewBox` and `preserveAspectRatio="xMidYMid meet"`.

### Pattern Generation

- **`generateCavityPattern()`** — Interlocking semicircle arcs at top/bottom of cavity with diagonal lines. Uses SVG `<clipPath>` per cavity. Unique clip IDs based on coordinates.
- **`generateContInsPattern()`** — Staggered vertical lines: even lines run top→mid, odd lines run bottom→mid. Spaced 8px apart. Used for both framed wall continuous insulation and ICF EPS layers.

---

## PointsCounter (`src/components/PointsCounter.jsx`)

Stateless display component for current ECP progress.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `total` | number | yes | Current accumulated ECP points |
| `target` | number | yes | Points needed for selected tier (10 or 20) |

### Rendering

```
{total.toFixed(1)} / {target} ECP
```

When `total >= target`, adds `.complete` class (switches to green styling).

---

## WallSectionDemo (`src/WallSectionDemo.jsx`)

Development/testing harness for WallSection. Not connected to the main app.

### State

| State | Default |
|-------|---------|
| `studDepth` | `'2x6'` |
| `studSpacing` | `16` |
| `continuousIns` | `1` |

Three `<select>` controls for interactive testing. Does NOT pass `cavityInsLabel` or `continuousInsLabel` — tests fallback label behavior. The 19" spacing option is omitted here (only 16" and 24").

---

## Export Utilities (`src/utils/`)

### resolveWallData (`src/utils/resolveWallData.js`)

`resolveWallData(selection)` — mirrors `calculateWallRsi()` but returns a structured object with all intermediate values instead of just the total RSI. Used by the Excel export to populate every cell.

**Input:** Wall builder `selection` object (same as passed to `calculateWallRsi`).

**Output:** `{ wallType, wallTypeLabel, assemblyType, studSpacing, boundary, contIns, mainWall, doubleStud, steel, icf, serviceWall, interiorLayer, totalRsi, points }` — null sections for inapplicable wall type paths.

Covers all paths: wood single stud, wood double stud, wood + service wall, steel (K-factor method), ICF. Boundary layers include RSI values, labels, and NBC source citations.

### buildWallSheet (`src/utils/buildWallSheet.js`)

`buildWallSheet(workbook, data)` — takes an ExcelJS workbook and a resolved data object, adds a "Wall Assembly RSI" worksheet with live Excel formulas.

Three internal layouts:
- **Wood** — universal template (rows 7–31). Unused rows (double stud, service wall) zeroed. Parallel-path formulas, stud RSI from depth, total as sum of series layers.
- **Steel** — K-factor weighted method. Cavity % and K1 as live formulas (IF conditions for spacing/insulating sheathing). Total = K1×T1 + K2×T3.
- **ICF** — pure series sum with EPS form and concrete core formulas.

All layouts include a Source column (E) with NBC table references.

### svgToPng (`src/utils/svgToPng.js`)

`svgToPng(svgElement, scale=2)` — converts an SVG DOM element to a PNG via native browser Canvas API. Returns `{ base64, width, height }`. Handles SVGs using viewBox without explicit width/height.

### exportWallAssembly (`src/utils/exportWallAssembly.js`)

`exportWallAssembly(selection, svgElement)` — orchestrator. Dynamically imports ExcelJS, calls resolveWallData, buildWallSheet, svgToPng (with graceful degradation), and triggers a browser file download. Filename: `Wall-Assembly-RSI-{type}-{date}.xlsx`.
