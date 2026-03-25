# Wall Assembly RSI Export to Excel

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Client-side ExcelJS with live formulas, universal wood template + dedicated steel/ICF layouts

## Problem

The ECP Calculator computes wall assembly RSI values from user selections, but the calculation is a black box. Builders, building officials, and energy advisors need to inspect, verify, and document the full layer-by-layer RSI calculation for permit applications, compliance verification, and reporting. There is no way to export the calculation breakdown.

## Design

### Feature Summary

An "Export to Excel" button below the wall section diagram generates a `.xlsx` workbook containing:
1. A layer-by-layer RSI calculation with **live Excel formulas**
2. A **PNG snapshot** of the wall section SVG diagram

The workbook is generated entirely client-side using ExcelJS (already installed). No server component.

### Button Placement & Visibility

- Below the `<WallSection>` SVG diagram
- Only visible when a valid wall is configured (RSI is not null)
- Triggers dynamic import of ExcelJS on first click (not bundled upfront)

### Sheet Structure

One sheet called "Wall Assembly RSI" with three sections: Header, Layer Stack (with live formulas), and embedded wall section image.

#### Header (rows 1-5)

| Row | A | B |
|-----|---|---|
| 1 | **Wall Assembly RSI Calculation** | |
| 2 | Wall Type | Wood Frame / Steel Frame / ICF |
| 3 | Assembly | Single Stud / Double Stud (wood only) |
| 4 | Stud Spacing | 16" o.c. (where applicable) |
| 5 | ECP Points | value |

#### Wood Template — Universal Layer Stack

All wood wall variants (single stud, double stud, with/without service wall) use the same row layout. Unused layers have RSI = 0 and are lightly grayed. The total formula is always `=SUM(series layers)` — zeros don't affect it.

| Row | A (Layer) | B (Material) | C (Detail) | D (RSI) |
|-----|-----------|--------------|------------|---------|
| 7 | **Layer** | **Material** | **Detail** | **RSI (m2-K/W)** |
| 8 | Outside Air Film | — | — | 0.03 |
| 9 | Cladding | e.g. Vinyl Siding | — | value |
| 10 | Continuous Insulation | e.g. XPS | e.g. 1" | value or 0 |
| 11 | Exterior Sheathing | e.g. 7/16" OSB | — | value or 0 |
| 12 | **Main Wall (parallel path)** | | | `=100/((100-D14)/D13+D14/D15)` |
| 13 | — Stud RSI | SPF | depth x 0.0085 | `=D16*0.0085` |
| 14 | — Cavity % | | e.g. 77% | value |
| 15 | — Cavity Insulation RSI | e.g. Fiberglass Batt | e.g. 2x6 R20 | value |
| 16 | — Stud Depth (mm) | | e.g. 140 | value |
| 17 | Gap Insulation | — | gap_mm x rsi_per_mm | value or 0 |
| 18 | **Inner Stud Row (PP)** | | | `=100/((100-D14)/D19+D14/D20)` or 0 |
| 19 | — Inner Stud RSI | | depth x 0.0085 | `=D16*0.0085` or 0 |
| 20 | — Inner Cavity RSI | | depth x rsi_per_mm | value or 0 |
| 21 | Interior Layer | e.g. 7/16" OSB | — | value or 0 |
| 22 | **Service Wall (PP)** | | | `=100/((100-D24)/D23+D24/D25)` or 0 |
| 23 | — Service Stud RSI | SPF | depth x 0.0085 | `=D26*0.0085` or 0 |
| 24 | — Service Cavity % | | e.g. 77% | value or 0 |
| 25 | — Service Cavity RSI | e.g. Fiberglass Batt | e.g. 2x4 R12 | value or 0 |
| 26 | — Service Stud Depth (mm) | | e.g. 89 | value or 0 |
| 27 | Drywall | 1/2" gypsum | — | 0.08 |
| 28 | Inside Air Film | — | — | 0.12 |
| 29 | | | | |
| 30 | **Total Effective RSI** | | | `=D8+D9+D10+D11+D12+D17+D18+D21+D22+D27+D28` |

**Single stud:** Rows 12-16 populated (main wall PP). Rows 17-20 = 0 (no double stud). Rows 21-26 = 0 (no service wall). Row 10 may have continuous insulation.

**Double stud:** Rows 12-16 become outer stud row. Rows 17-20 populated (gap + inner stud PP). Inner stud PP reuses cavity % from D14 (same stud spacing applies to both rows). Row 10 = 0 (no continuous insulation with double stud).

**Service wall (single or double stud primary):** Rows 21-26 populated (service wall PP + interior layer). Row 10 = 0 (no continuous insulation with service wall). Interior layer RSI (row 21) resolves via sheathing ID lookup or continuous insulation type+thickness lookup — same dual-path logic as `getInteriorLayerRsi()` in ecpData.js.

**Double stud + service wall:** Rows 12-20 (outer + gap + inner stud) AND rows 21-26 (interior layer + service wall PP) all populated. This is a valid combination that must be tested.

The parallel-path formula is always: `=100/((100-cavityPct)/studRsi + cavityPct/cavityRsi)`

#### Steel Layout

Replaces the simple series sum with NBC K-factor weighted method per Table A-9.36.2.4.(1)-B.

Boundary layers listed same as wood except: **no sheathing** (steel walls have an air space instead), and air space RSI (0.18) is included in the boundary sum.

Boundary sum = outside air + cladding + air space + continuous insulation + drywall + inside air.

**K-factor lookup (from NBC Table A-9.36.2.4.(1)-B):**

| Condition | K1 | K2 |
|-----------|-----|-----|
| Spacing >= 24" (600mm) | 0.50 | 0.50 |
| Spacing < 24" with insulating sheathing (cont ins > 0) | 0.40 | 0.60 |
| Spacing < 24" without insulating sheathing | 0.33 | 0.67 |

Excel formula: `=IF(spacing>=24, 0.5, IF(contInsRsi>0, 0.4, 0.33))` for K1, `=1-K1` for K2.

Calculation section:

| Row | Label | Formula |
|-----|-------|---------|
| | Cavity % | `=(spacing_in - 0.125) * 100 / spacing_in` |
| | Framing % | `=100 - cavityPct` |
| | Stud RSI | `=depth_mm * 0.0000161` (steel conductivity) |
| | K1 | `=IF(spacing>=24, 0.5, IF(contInsRsi>0, 0.4, 0.33))` |
| | K2 | `=1-K1` |
| | Boundary Sum | `=SUM(outside_air, cladding, air_space, cont_ins, drywall, inside_air)` |
| | RSI_T1 (full assembly PP) | `=100/(framingPct/(bSum+studRsi) + cavityPct/(bSum+cavityRsi))` |
| | RSI_T2 (stud-cavity PP) | `=100/(framingPct/studRsi + cavityPct/cavityRsi)` |
| | RSI_T3 | `=RSI_T2 + bSum` |
| | **Total** | `=K1*RSI_T1 + K2*RSI_T3` |

#### ICF Layout

Pure series sum, no parallel path.

| Row | Layer | RSI Formula |
|-----|-------|-------------|
| | Outside Air Film | 0.03 |
| | Cladding | value |
| | EPS Form (x2 sides) | `=thickness_mm * 2 * rsi_per_mm` |
| | Concrete Core | `=core_mm * rsi_per_mm` |
| | Drywall | 0.08 |
| | Inside Air Film | 0.12 |
| | **Total** | `=SUM(...)` |

### SVG to PNG Conversion

No extra library required. Uses native browser APIs:

1. `new XMLSerializer().serializeToString(svgElement)` — serialize inline SVG
2. Create `data:image/svg+xml` URL
3. Draw to offscreen `<canvas>` via `new Image()` + `canvas.drawImage()`
4. `canvas.toDataURL('image/png')` — extract base64 PNG
5. Strip data URL prefix, pass to ExcelJS `workbook.addImage()`

Image embedded below the calculation table, spanning columns A-D.

### Component Architecture

**New: `src/utils/exportWallAssembly.js`**
- `exportWallAssembly(selection, svgElement)` — main export function
- Dynamically imports `exceljs` on first call
- Mirrors the data resolution logic in `calculateWallRsi()`: reads `wallData`, `boundaryOptions`, `continuousInsData`, `icfData`, `doubleStudData` from ecpData imports to resolve all intermediate values (stud depths, cavity RSI, cavity %, boundary RSI values, K-factors for steel, etc.)
- Builds the appropriate sheet layout based on `selection.wallType`
- Converts SVG to PNG, embeds as image (graceful degradation: if SVG-to-PNG fails, export the spreadsheet without the image rather than failing entirely)
- Triggers browser download via `URL.createObjectURL()` + temporary anchor
- Download filename: `Wall-Assembly-RSI-{wallType}-{YYYY-MM-DD}.xlsx`

**New: `src/utils/svgToPng.js`**
- `svgToPng(svgElement)` — returns a Promise resolving to a base64 PNG string
- Isolated for testability and reuse
- Uses XMLSerializer + canvas approach

**Modified: `WallBuilder.jsx`**
- Adds "Export to Excel" button below `<WallSection>`
- Button visible only when RSI is valid (not null)
- Passes `selection` object and a ref to the SVG DOM element
- Uses a `ref` on the wall section container `<div>`, then queries `ref.current.querySelector('svg')` to get the SVG element (avoids modifying WallSection.jsx or using forwardRef)
- Shows loading state during export (ExcelJS dynamic import + image conversion)

**Modified: `App.css`**
- Button styling for the export button (consistent with existing UI)

### What Doesn't Change

- State management (all state in App.jsx, passed down via `selection` prop)
- `calculateWallRsi()` and `getWallPoints()` logic in ecpData.js
- `compute.js` formula functions
- WallSection.jsx SVG rendering (ref accessed via parent container query, no forwardRef needed)
- Simple mode ("Select RSI" tab)
- CategoryCard, PointsCounter, OptionButton components
- No new runtime dependencies (ExcelJS already installed, dynamically imported)
- No server-side component
