# ECP Calculator — Components Reference

All components live in `src/components/` except `App.jsx` (root).

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
| `belowGradeSelection` | object | `{}` | Below-grade wall builder state (see BelowGradeWallBuilder) |

### Derived (useMemo)

- **`wallPoints`** — From `wallSelection`: if `simpleIndex` is set, reads `categories[wall].options[simpleIndex].points`. Otherwise calls `calculateWallRsi(wallSelection)` → `getWallPoints()`.
- **`belowGradePoints`** - Same pattern from `belowGradeSelection`: if `simpleIndex` is set, reads `categories[belowGradeWalls].options[simpleIndex].points`. Otherwise calls `calculateBelowGradeRsi(belowGradeSelection)` then `getBelowGradePoints()` (0 when the assembly is incomplete).
- **`totalPoints`** — Sum of all `selections` option points + `wallPoints` + `belowGradePoints`.

### Key Functions

- **`handleSelect(categoryId, optionIndex)`** — Sets option for a category. If the category belongs to an `exclusiveGroup`, clears all other group members first. Pass `optionIndex: null` to clear.
- **`isDisabled(category)`** — Returns `true` if another category in the same exclusive group has a selection.

### Rendering

Iterates `categories` array. If `category.type === 'wallBuilder'`, renders `<WallBuilder>`; if `category.type === 'belowGradeBuilder'`, renders `<BelowGradeWallBuilder>`. Otherwise renders `<CategoryCard>`.

Footer contains an optional **Project details** block (three text inputs: Project / Address, Permit Number, Applicant) held in `projectInfo` state, plus a "Save / Print" button that calls `window.print()`, disabled when `totalPoints === 0`. The project fields are never required; whatever is entered is printed on the summary. A disclaimer (`src/data/disclaimer.js`, shared with `PrintSummary`) states the output is not an official compliance document and is subject to AHJ approval. A short usage notice (`USAGE_NOTICE`) sits directly under the Save / Print button. After the footer, renders a hidden `<PrintSummary>` component (visible only in `@media print`).

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
  claddingId: 'vinyl_siding',
  sheathingId: 'osb_11',
}

// Builder mode — service wall (wood only, single or double stud primary):
{
  wallType: 'wood',
  assemblyType: 'single',
  studSpacing: '16"',
  cavityMaterial: 'Fiberglass Batt',
  cavityType: '2x6 R20',
  hasServiceWall: true,
  serviceSpacing: '16"',
  serviceCavityMaterial: 'Fiberglass Batt',
  serviceCavityType: '2x4 R12',
  interiorLayerMaterial: 'osb_11',       // sheathing or rigid insulation
  interiorLayerThickness: undefined,     // only for rigid insulation
  claddingId: 'vinyl_siding',
  sheathingId: 'osb_11',
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

### Builder Mode — FieldGroup Cards

Group numbers are dynamic (no gaps). Groups appear/disappear based on wall type and toggles:

1. **Wall Configuration** (always visible) — Wall Type selector (Wood Frame, Steel Frame, ICF). Wood adds: Assembly Type toggle (Single Stud / Double Stud), Service Wall checkbox.
2. **Service Wall** (conditional: wood + `hasServiceWall`) — Stud Spacing, Cavity Insulation (material), Cavity Size.
3. **Main Wall** (conditional: `wallType` set) — content varies by wall type and assembly:
   - **Wood/Steel single:** Framing sub-label (Stud Spacing, Cavity Insulation, Cavity Size — deep cavities for blown-in), Continuous Insulation sub-label (Type, Thickness — hidden when service wall), Exterior sub-label (Sheathing dropdown for wood, Cladding dropdown).
   - **Wood double stud:** Framing sub-label (Stud Spacing, Outer Studs, Inner Studs, Plate Width — auto-filtered, Insulation — blown-in only), Exterior sub-label.
   - **ICF:** EPS Form Thickness (per side) only.
4. **Interior Layer** (conditional: `hasServiceWall`) — Material (sheathing or rigid insulation), Thickness (rigid insulation only).
5. **Assumptions** (footnote variant, conditional: `wallType` set) — read-only display of assumed drywall and air film values.

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
| `getStudDepth(cavityType)` | `'2x6 R20'` | `'2x6'` | Extract stud size for WallSection. Maps `2x4` and `2x3-5/8` prefixes to `'2x4'` (steel uses 2x3-5/8 studs). Supports deep cavities: `2x8`, `2x10`, `2x12`. |
| `getStudSpacingNum(studSpacing)` | `'16"'` | `16` | Convert to number for WallSection |
| `getContInsThicknessNum(thickness)` | `'1-1/2"'` | `1.5` | Extract thickness for WallSection (handles fractions) |
| `getAvailableCavityTypes(wallType, spacing, material)` | strings | Array | Returns `cavityTypesByMaterial[material]` filtered to non-null lookup values |

### WallSection Wiring

```jsx
// Wood single/double stud (with optional service wall, boundary labels):
<WallSection
  wallType={wallType}                               // 'wood'
  studDepth={getStudDepth(cavityType)}              // '2x4' | '2x6'
  studSpacing={getStudSpacingNum(studSpacing)}      // 16 | 19 | 24
  continuousIns={...}                               // 0–3 (0 when service wall)
  cavityInsLabel={cavityType}                       // e.g. '2x6 R20'
  continuousInsLabel={...}                          // e.g. '2" XPS' or null
  claddingLabel={...}                               // e.g. 'Vinyl Siding'
  sheathingLabel={...}                              // e.g. '7/16" OSB'
  assemblyType={assemblyType}                       // 'single' | 'doubleStud'
  hasServiceWall={hasServiceWall}                   // boolean
  outerStudDepth={outerStud}                        // double stud: '2x4' | '2x6'
  innerStudDepth={innerStud}                        // double stud: '2x4' | '2x6'
  gapInches={dsGapInches}                           // double stud: gap in inches
  serviceStudDepth={getStudDepth(serviceCavityType)} // service wall stud size
  serviceSpacingInches={getStudSpacingNum(serviceSpacing)}
  serviceCavityLabel={serviceCavityType}
  interiorLayerLabel={intLayerLabelText}
  interiorLayerThicknessInches={intLayerVisualThick}
/>

// Steel (shown when studSpacing && cavityType are set):
<WallSection
  wallType="steel"
  studDepth={getStudDepth(cavityType)}
  studSpacing={getStudSpacingNum(studSpacing)}
  continuousIns={getContInsThicknessNum(contInsThickness)}
  cavityInsLabel={cavityType}
  continuousInsLabel={...}
  claddingLabel={...}
/>

// ICF (shown when icfFormThickness is set):
<WallSection
  wallType="icf"
  icfFormThickness={getContInsThicknessNum(icfFormThickness)}  // inches per side
/>
```

---

## BelowGradeWallBuilder (`src/components/BelowGradeWallBuilder.jsx`)

Dual-mode input for the Below Grade Walls category, mirroring WallBuilder: "Build Assembly" (builder, the default) or "Select RSI" (simple). Builder mode uses progressive disclosure based on the foundation type. The card heading is "Below Grade Walls".

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selection` | object | yes | Below-grade state from App.jsx (may be `{}`) |
| `onSelect` | `(newSelection) => void` | yes | Replaces the entire below-grade selection in App.jsx |

### Selection Object Shape

```js
// Builder mode -- poured concrete (defaults when "Poured Concrete" is chosen):
{
  foundationType: 'concrete',
  concreteThickness: '200',        // '200' | '250'
  extInsType: undefined,           // 'XPS' | 'EPS' | 'Mineral Wool (Rock Wool)' | 'Mineral Wool (Glass Fibre)'
  extInsThickness: 'None',         // 'None' | '1"' | '1-1/2"' | '2"' | '2-1/2"' | '3"' | '3-1/2"' | '4"'
  intInsType: undefined,           // 'XPS' | 'EPS' | 'Polyiso' | 'Closed-Cell Spray Foam'
  intInsThickness: 'None',         // same list as extInsThickness
  hasStudWall: true,
  studSpacing: '16"',              // '16"' | '19"' | '24"'
  cavityMaterial: 'Fiberglass Batt',   // any cavity material, or 'None (empty)'
  cavityType: '2x6 R22',           // 2x4 / 2x6 batts only; absent for blown-in or empty
  studDepth: undefined,            // '2x4' | '2x6', used instead of cavityType for blown-in or empty cavities
  studOffset: undefined,           // boolean, only meaningful for cavityType '2x6 R20'
  finish: 'gypsum',                // 'gypsum' | 'none'
}

// Builder mode -- concrete block: as concrete, but `blockType: 'normal_empty'` (an id from
// foundation.yaml block.options) replaces `concreteThickness`.

// Builder mode -- ICF:
{ foundationType: 'icf', icfFormThickness: '2-1/2"', finish: 'gypsum' }   // icfFormThickness starts empty

// Builder mode -- permanent wood foundation (defaults):
{
  foundationType: 'pwf',
  pwfStud: '2x8',                  // '2x6' | '2x8' | '2x10'
  pwfSpacing: '16"',               // '8"' | '12"' | '16"'
  pwfCavityMaterial: 'Fiberglass Batt',
  pwfCavityType: '2x8 R28',        // cavity entries of that material whose stud matches pwfStud
  finish: 'gypsum',
}

// Simple mode:
{ simpleIndex: 1 }                 // index 0 is the 2.98 / 0-point floor, 1..3 the point levels

// Empty (initial):
{}
```

Builder fields and `simpleIndex` are mutually exclusive. Mode switching calls `onSelect({})`. Choosing a foundation type replaces the whole selection with that type's entry in the exported `FOUNDATION_DEFAULTS`, so no field from another type survives. Changing `cavityMaterial` clears `cavityType` and `studOffset` and sets `studDepth` to `'2x6'` when the material is blown-in or `'None (empty)'`. Changing `cavityType` away from `2x6 R20` clears `studOffset`. Changing `pwfStud` or `pwfCavityMaterial` clears `pwfCavityType`. Setting an interior insulation thickness forces `finish` to `'gypsum'`. Unticking the stud wall sets `hasStudWall: false` and clears the five stud-wall fields; ticking it restores the stud-wall defaults (16", Fiberglass Batt, 2x6 R22).

### Internal State

| State | Type | Default |
|-------|------|---------|
| `mode` | `'builder'` \| `'simple'` | `'builder'` |
| `exporting` | boolean | `false` |

### Refs

| Ref | Target | Purpose |
|-----|--------|---------|
| `svgRef` | `.wall-section-container` div | SVG element for the Excel export PNG |

### Builder Mode -- FieldGroup Cards

Group numbers are dynamic (no gaps). Groups 2 to 4 appear only for poured concrete and concrete block; 5 and 6 appear once a foundation type is chosen.

1. **Foundation** (always visible) -- Foundation Type select (Poured Concrete, Concrete Block, ICF, Permanent Wood Foundation). Concrete adds Wall Thickness; block adds Block Type (14 options); ICF adds EPS Form Thickness (per side); PWF adds a second row of Stud Size, Stud Spacing, Cavity Insulation, Cavity Size.
2. **Exterior Insulation** -- Type (XPS, EPS, two mineral wools; no polyiso) and Thickness (None to 4").
3. **Interior Insulation** -- Type (XPS, EPS, Polyiso, Closed-Cell Spray Foam) and Thickness (None to 4").
4. **Interior Stud Wall** -- checkbox (on by default). When on: Stud Spacing, Cavity Insulation (the cavity materials plus "None (empty)"), then Cavity Size for batts or Stud Size for blown-in and empty cavities. A "Stud wall held off the concrete" checkbox appears only when the cavity is `2x6 R20`.
5. **Interior Finish** -- Finish select (1/2" gypsum board, None (unfinished)) with no blank option. Disabled and shown as gypsum for ICF and whenever interior insulation has a thickness, with the line "Gypsum board required over foam, 9.10.17.10".
6. **Assumptions** (footnote variant) -- interior air film 0.12; exterior air film and soil not counted; concrete 0.0004 RSI/mm; basement framing 16% / 14.5% / 13% at 16" / 19" (19.2" o.c.) / 24"; ICF plastic ties.

Below the groups, a `.wall-disclaimer` block repeats the moisture disclaimer and LEEP link from WallBuilder and adds three code notes as a bulleted list (`data-testid="bg-code-notes"`): the lowest foundation wall assembly sets the points (9.36.8.7.(4)), insulation covers the full wall height (9.25.2.3.(4)), and a wall whose top is 600 mm or more above grade must meet the above-ground wall RSI over that portion (9.36.8.5.(4)).

### Result Box

When `calculateBelowGradeAssembly(selection)` returns an assembly:

- Effective RSI with the R-value, then either **Points** (`getBelowGradePoints`) or, when the RSI rounded to 2 decimals is under `MIN_BELOW_GRADE_RSI` (2.98), the minimum and a red "Does not meet code" warning giving the shortfall against 2.98, worded and marked like the WallBuilder warning (a warning sign and an em dash).
- **Hint** (`data-testid="bg-hint"`): shown only when the wall is below the minimum and is concrete or block with a stud wall at `16"` and cavity `2x6 R20` (exterior or interior foam can carry R20 @ 16" past the minimum, and then the hint stays hidden): "R20 at 16" o.c. does not reach the 2.98 minimum on its own; R22, 24" spacing, or exterior insulation does."
- **How it adds up** (`data-testid="bg-layers"`): one line per layer of the assembly, outside to inside, with its RSI to 2 decimals. This is the same layer list the export prices.

When the assembly is `null` the box shows a prompt instead: "Select a foundation type to begin", "Select form thickness to calculate RSI" (ICF), "Select stud wall options to calculate RSI" (stud wall or PWF fields missing), "Select an insulation type" (an exterior or interior thickness chosen before its type), else "No data for this combination".

Default poured concrete shows 3.12 and +0.2; ICF 2-1/2" shows 3.56 and +0.8; PWF default shows 3.98 and +1.4.

### Cross-Section and Export

When the assembly is valid the card renders `<WallSection wallType="foundation" foundationLayers={...} />` inside `.wall-section-container`, followed by an "Export to Excel" button and a Clear button. The exported `buildFoundationLayers(selection, assembly)` builds the drawing's layer list (outside to inside) from the selection and the calculated assembly's labels: a 2" soil band marked "soil (not counted)", then the structural and insulation layers with drawing thicknesses in inches (concrete 8 or 10, block 7.5, ICF core 6, foam per its label, studs per `STUD_INCHES`, gypsum and PWF plywood 0.5). When the frame label says the stud wall is held off the concrete, a 1" band marked "air gap (not counted)" (`kind: 'air_gap'`) goes between the concrete side and the frame; it is drawing only and adds no RSI. It returns `[]` when the assembly is missing.

`handleExport()` mirrors WallBuilder: sets `exporting`, finds the SVG in `svgRef`, calls `exportFoundationAssembly(selection, svgElement)` from `src/utils/exportFoundationAssembly.js`, and resets `exporting` when done or on error.

### Simple Mode

Renders `OptionButton`s from the Below Grade Walls category options (2.98 / 0 pts, 3.09 / 0.2, 3.46 / 0.8, 3.90 / 1.4) plus a Clear button when one is selected. Selection is `simpleIndex` in the parent state.

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

Stateless SVG component rendering a top-down cross-section of the wall assembly. Supports four rendering modes based on `wallType`: wood, steel, ICF, and foundation (below-grade, driven by a layer list).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `wallType` | `'wood'` \| `'steel'` \| `'icf'` \| `'foundation'` | `'wood'` | Determines rendering mode |
| `studDepth` | `'2x4'` \| `'2x6'` \| `'2x8'` \| `'2x10'` \| `'2x12'` | `'2x6'` | Stud size → cavity depth (3.5" to 11.25") |
| `studSpacing` | number | `16` | On-center spacing in inches |
| `continuousIns` | number | `0` | Continuous insulation thickness (0–3 inches) |
| `cavityInsLabel` | string \| null | `null` | Overrides generic cavity label in diagram |
| `continuousInsLabel` | string \| null | `null` | Overrides generic continuous insulation label |
| `icfFormThickness` | number | `0` | ICF only: EPS form thickness per side (inches) |
| `claddingLabel` | string \| null | `null` | Override label for cladding layer |
| `sheathingLabel` | string \| null | `null` | Override label for sheathing layer |
| `assemblyType` | `'single'` \| `'doubleStud'` | `'single'` | Assembly mode (wood only) |
| `hasServiceWall` | boolean | `false` | Whether to render a service wall |
| `outerStudDepth` | `'2x4'` \| `'2x6'` | `'2x4'` | Double stud: outer wall stud size |
| `innerStudDepth` | `'2x4'` \| `'2x6'` | `'2x4'` | Double stud: inner wall stud size |
| `gapInches` | number | `0` | Double stud: gap between walls (inches) |
| `serviceStudDepth` | `'2x4'` \| `'2x6'` | `'2x4'` | Service wall stud size |
| `serviceSpacingInches` | number | `16` | Service wall stud spacing (inches) |
| `serviceCavityLabel` | string \| null | `null` | Label for service wall cavity |
| `interiorLayerLabel` | string \| null | `null` | Label for interior layer (between service and primary) |
| `interiorLayerThicknessInches` | number | `0` | Thickness of interior layer (inches) |
| `foundationLayers` | array \| null | `null` | Foundation mode only: layer list, outside to inside (see below) |
| `width` | number | `600` | Accepted but unused (SVG uses `width="100%"` with viewBox) |

### Rendering Modes

#### Wood Frame (`wallType === 'wood'`)

| Layer | Thickness | Color | Pattern |
|-------|-----------|-------|---------|
| Drywall | 0.5" fixed | gray `#e5e7eb` | solid fill |
| Stud cavity | 3.5"–11.25" (per studDepth) | pink `#fce7f3` | batt insulation (semicircles + diagonal lines) |
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

Insulation fills both the bays between studs and the interior of the C-channel itself.

#### ICF (`wallType === 'icf'`)

Completely different layer structure (no studs, no stud spacing):

| Layer | Thickness | Color | Pattern |
|-------|-----------|-------|---------|
| Drywall | 0.5" fixed | gray `#e5e7eb` | solid fill |
| EPS (interior) | per `icfFormThickness` | pink `#fce7f3` | staggered vertical lines |
| Concrete core | 6" fixed | gray `#6b7280` | solid fill + deterministic speckle aggregate |
| EPS (exterior) | per `icfFormThickness` | pink `#fce7f3` | staggered vertical lines |
| Cladding | 0.5" fixed | dark gray `#9ca3af` | solid fill |

Fixed 24" display width. Max SVG height 250px. No stud spacing dimension.

#### Double Stud (`wallType === 'wood'`, `assemblyType === 'doubleStud'`)

Two wood stud walls (outer and inner) on a wider plate, with an insulation-filled gap between them. Each stud row renders with the same wood frame pattern. The gap renders as a continuous insulation layer. Outer/inner stud depths and gap width are driven by props.

#### Service Wall (`wallType === 'wood'`, `hasServiceWall === true`)

Adds an interior service cavity on the conditioned side. Layers from outside to inside: cladding, sheathing, primary stud cavity, interior layer (sheathing or rigid insulation), service stud cavity, drywall. Works with both single and double stud primary walls.

#### Foundation (`wallType === 'foundation'`)

Draws whatever `foundationLayers` says, so the SVG and the "How it adds up" list always agree. Each entry is:

```js
{ id, kind, label, thicknessInches,
  studDepth, studSpacing, cavityLabel }   // frame layers only
```

`kind` picks the fill: `soil` (beige with a 45-degree hatch), `ext_ins` / `int_ins` / `icf_foam` (pink with the continuous-insulation pattern), `concrete` (gray with the ICF speckle, count scaled to the area), `block` (16" units with a 3/8" joint and two cores each; the cores take the insulation fill when the label mentions perlite, vermiculite or EPS), `frame` (the wood stud/cavity drawing; when `cavityLabel` is `'empty cavity'` there is no batt pattern and the cavity is a pale fill), `air_gap` (white with a dashed outline), `sheathing`, `gypsum`; anything else draws a plain gray band. Frame and block clip ids carry an `fd-` prefix so a foundation drawing and an above-ground drawing on the same page do not share ids.

The list arrives outside to inside (soil first) and is reversed so the interior finish is at the top under an "INTERIOR" caption and the soil at the bottom, the same orientation as the ICF drawing. Wall length is `studSpacing * 1.5` inches when a frame layer is present, 24" otherwise; the SVG height follows the total thickness (max display height 300px) and the width adds a label column sized from the longest label (about 4.8px per character, never under 200px) so long block and held-off labels stay inside the viewBox. A stud-spacing dimension line is drawn at the bottom when a frame is present. A missing or non-array `foundationLayers` renders an empty drawing, not an error.

### Geometry

- **Scale:** 10px per inch (uniform both axes)
- **Wall length (wood/steel):** `studSpacing * 1.5` inches (shows ~2.5 studs)
- **Wall length (ICF):** 24" fixed
- **Wall length (foundation):** `studSpacing * 1.5` inches with a stud wall or PWF frame, 24" otherwise
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

## PrintSummary (`src/components/PrintSummary.jsx`)

Hidden print-only component that renders a clean one-page summary of the user's ECP selections for `window.print()` / Save as PDF.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selections` | `{ [categoryId]: number }` | yes | Option index per standard category (from App.jsx state) |
| `wallSelection` | object | yes | Wall builder state (from App.jsx state) |
| `wallPoints` | number | yes | Points earned from wall category |
| `belowGradeSelection` | object | no | Below-grade builder state (from App.jsx state); defaults to `{}` |
| `belowGradePoints` | number | no | Points earned from the Below Grade Walls category; defaults to `0` |
| `totalPoints` | number | yes | Total accumulated ECP points |
| `selectedTier` | `{ id, label, points }` | yes | Currently selected tier object |
| `projectInfo` | `{ project, permit, applicant }` | no | Optional project details from the footer inputs; defaults to `{}` |

### Rendering

Hidden on screen (`display: none`). Visible only in `@media print`.

**Layout:**
1. **Header** — "NBC 2020 {Tier} Compliance — ECP Summary" + date
2. **Project details** — three labelled lines (Project / Address, Permit Number, Applicant). Filled values print as text; empty values print as a blank underlined line (`.print-blank`) so they can be completed by hand. Added for AHJ record keeping so permit submissions can be tied to a specific building.
3. **Results table** — one row per selected category (name, selection label, points)
4. **Wall details** — indented sub-rows when wall builder mode was used:
   - Wall Type (e.g., "Wood Frame, Single Stud" or "Wood Frame, Double Stud")
   - Framing details — varies by assembly type:
     - Single stud: `Stud Spacing: 16" | Cavity: Fiberglass Batt, 2x6 R20`
     - Double stud: `Stud Spacing: 16" | Studs: 2x4 + 2x4 | Plate: 2x10 | Fill: Loose Fill Cellulose`
   - Service wall details (when `hasServiceWall` is true)
   - Continuous insulation (when present and not "None")
   - Total Assembly RSI
   - **Below Grade Walls row** - printed right after the above-ground wall rows whenever `belowGradePoints > 0`, a `foundationType` is set, or `simpleIndex` is defined. Simple mode prints the option as `>= RSI x.xx` (a real greater-than-or-equal sign on the page, as in the other rows); builder mode prints `RSI x.xx` (or `Incomplete`) followed by indented detail lines: Foundation Type; Wall Thickness / Block Type / EPS Form Thickness / `Studs: 2x8 @ 16" | Cavity: ...` per type; Exterior Ins and Interior Ins when a thickness is set; `Stud Wall: none` or `Stud Spacing: 16" | Cavity: Fiberglass Batt, 2x6 R22` (the cavity reads `2x6 empty` for an empty cavity, and `held off concrete` is appended when `studOffset`); Finish; Total Assembly RSI.
5. **Total row** — points sum / target
6. **Status** — pass/fail message
7. **Disclaimer** — shared `DISCLAIMER` text: not an official compliance document, subject to AHJ review and approval
8. **Footer** — "Generated by ECP Calculator v1.3 — for reference only"

Unselected categories are omitted. Simple wall mode shows the option value without detail sub-rows. `aboveGroundWalls` and `belowGradeWalls` are excluded from the generic category rows (`BUILDER_CATEGORIES`) and rendered by their own blocks.

### Detection Logic

- **Builder mode:** `wallSelection.wallType` is set and `wallSelection.simpleIndex` is undefined
- **Simple mode:** `wallSelection.simpleIndex` is defined
- **Double stud:** `wallSelection.assemblyType === 'doubleStud'`
- **ICF:** `wallSelection.wallType === 'icf'` — no framing details shown
- **Below-grade builder mode:** `belowGradeSelection.foundationType` is set and `belowGradeSelection.simpleIndex` is undefined; the RSI comes from `calculateBelowGradeRsi()`

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

### resolveFoundationData (`src/utils/resolveFoundationData.js`)

`resolveFoundationData(selection)` -- wraps `calculateBelowGradeAssembly()` and adds the working the sheet needs. Returns `null` whenever the assembly is `null` (or, defensively, when the frame layer cannot be re-resolved).

**Output:** `{ foundationType, foundationTypeLabel, structure, spacing, finishLabel, finishForced, finishSelected, intInsThickness, layers, concrete, block, icf, frame, totalRsi, roundedRsi, points, minRsi, meetsMinimum }`. `concrete` is `{ mm, rsiPerMm }`, `block` is `{ id, label, thicknessMm, rsi }`, `icf` is `{ formLabel, formThicknessMm, epsRsiPerMm, concreteCoreMm, concreteRsiPerMm }`, each `null` for the other types. `frame` (basement stud wall or PWF) is `{ stud, spacing, studDepthMm, studRsi, cavityMaterial, cavityType, cavityRsi, cavityPct, framingPct, offset, ppRsi }` or `null`. `structure` is a one-line description for the sheet header (e.g. `200 mm (8") poured concrete`).

### buildFoundationSheet (`src/utils/buildFoundationSheet.js`)

`buildFoundationSheet(workbook, data)` -- adds a "Foundation Wall RSI" worksheet. One layout for all four foundation types: header block (rows 1-5: title, Foundation Type, Structure, Stud Spacing when present, ECP Points), column headers on row 7 (Layer, Material, Detail, RSI, Source), then one row per layer outside to inside. Continuous layers with a known mm x RSI/mm working (concrete, spray foam, ICF forms and core) are live formulas; the frame layer is a parallel-path formula over working rows for stud depth, stud RSI, cavity RSI, cavity % and framing %. After the layers: Total Effective RSI (sum of the layer rows), Rounded to 2 decimals, Code Minimum RSI, Meets Minimum? (an `IF`), ECP Points (nested `IF` over the `belowGrade` thresholds), and a Notes block (layers counted, basement framing %, PWF framing % when PWF, the offset batt when used, the gypsum-over-foam rule when forced, the lowest-assembly rule, the minimum and levels). Column E cites the NBC table for each value.

### exportFoundationAssembly (`src/utils/exportFoundationAssembly.js`)

`exportFoundationAssembly(selection, svgElement)` -- orchestrator with the same contract as `exportWallAssembly`: dynamic ExcelJS import, `resolveFoundationData` (throws on an incomplete assembly), `buildFoundationSheet`, `svgToPng` with graceful degradation, browser download. Filename: `Foundation-Wall-RSI-{Foundation-Type-Label}-{date}.xlsx`.
