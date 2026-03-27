# ECP Calculator — Architecture

## Overview

ECP Calculator is a React web app for calculating Energy Conservation Points (ECP) under NBC 2020. It helps builders and building officials determine if a residential design meets Tier 2 (10 pts) or Tier 3 (20 pts) energy performance thresholds.

**Stack:** React 18 + Vite 5 + Vitest, plain CSS (no framework).

## Quick Start

```bash
cd ecp-calculator
npm install
npm run dev      # Dev server at localhost:5173
npm run build    # Production build to dist/
npm run start    # Serve production build (production server uses this)
npm test         # Run unit tests (Vitest)
npm run test:watch  # Watch mode
npm run generate     # Regenerate JSON from YAML materials
npm run generate:audit    # Generate + produce audit Excel workbook
npm run generate:validate # Generate + validate against existing JSON
```

## Project Structure

```
ecp-calculator/
├── data/
│   └── materials/               # YAML source of truth (NBC-verified values)
│       ├── framing.yaml
│       ├── cavity-insulation.yaml
│       ├── continuous-insulation.yaml
│       ├── sheathing-cladding.yaml
│       └── icf.yaml
├── scripts/
│   ├── generate.js              # Build pipeline: YAML → JSON + audit workbook
│   ├── compute.js               # Runtime RSI formulas (shared with React via alias)
│   ├── loadMaterials.js         # YAML file loader for generate.js
│   ├── compute.test.js          # Unit tests for compute functions
│   ├── loadMaterials.test.js    # Unit tests for YAML loading
│   └── validate.test.js         # Validation tests for generated JSON
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker (network-first)
│   ├── logolightmode.png        # Logo (light theme)
│   └── logodarkmode.png         # Logo (dark theme)
├── src/
│   ├── main.jsx                 # Entry point, service worker registration
│   ├── App.jsx                  # Root component, all state management
│   ├── App.css                  # All styles, CSS variables, theming
│   ├── WallSectionDemo.jsx      # Standalone demo page for WallSection testing
│   ├── data/
│   │   ├── ecpData.js           # API layer: imports generated JSON + compute module
│   │   ├── ecpData.test.js      # Unit tests for wall RSI and points
│   │   └── generated/           # JSON from build pipeline (committed)
│   │       ├── wall-data.json
│   │       ├── continuous-ins.json
│   │       ├── icf-data.json
│   │       ├── boundary-options.json
│   │       ├── thresholds.json
│   │       └── double-stud-data.json
│   ├── utils/
│   │   ├── resolveWallData.js       # Extracts all intermediate RSI values from selection
│   │   ├── resolveWallData.test.js  # Unit tests for resolveWallData
│   │   ├── buildWallSheet.js        # Builds Excel sheet with live formulas
│   │   ├── buildWallSheet.test.js   # Unit tests for buildWallSheet
│   │   ├── exportWallAssembly.js    # Orchestrator: resolve → sheet → PNG → download
│   │   └── svgToPng.js              # SVG DOM element → base64 PNG via canvas
│   └── components/
│       ├── CategoryCard.jsx     # Standard category selection UI
│       ├── OptionButton.jsx     # Individual option button
│       ├── WallBuilder.jsx      # Wall assembly builder (simple + builder modes)
│       ├── WallSection.jsx      # SVG wall cross-section diagram (wood/steel/ICF)
│       ├── FieldGroup.jsx       # Numbered card wrapper for field groups
│       ├── FieldGroup.test.jsx  # Unit tests for FieldGroup
│       ├── PointsCounter.jsx    # ECP points progress display
│       ├── PrintSummary.jsx     # Print-only ECP summary table
│       └── PrintSummary.test.jsx # Unit tests for PrintSummary
├── index.html
├── vite.config.js
└── package.json
```

## Data Flow

```
YAML materials → generate.js → generated/*.json → ecpData.js + compute.js
     │
     ▼
App.jsx (state: selections, wallSelection, selectedTierId, darkMode)
     │
     ├── WallBuilder ──► WallSection (SVG diagram: wood/steel/ICF/doubleStud/serviceWall)
     │     │
     │     ├── Wall type selector → progressive disclosure
     │     │   ├── Wood: assembly type (single/double stud), service wall toggle
     │     │   ├── Wood/Steel: framing + continuous insulation + exterior fields
     │     │   └── ICF: form thickness field
     │     │
     │     ├── Uses: calculateWallRsi(selection), getWallPoints()
     │     │
     │     └── Export to Excel (below diagram, when RSI valid)
     │           └── exportWallAssembly(selection, svgElement)
     │                 ├── resolveWallData → all intermediate RSI values
     │                 ├── buildWallSheet → ExcelJS workbook with live formulas
     │                 └── svgToPng → wall section image embedded in sheet
     │
     ├── CategoryCard ──► OptionButton (one per threshold)
     │
     ├── PointsCounter (totalPoints vs targetPoints)
     │
     └── PrintSummary (hidden on screen, visible in @media print)
           └── Summary table of selected categories + wall details
```

## State Management

All state lives in `App.jsx` — no context providers, no external state libraries.

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `darkMode` | boolean | system preference | Theme toggle; applies `.dark` class to `<body>` |
| `selectedTierId` | number | `2` | Tier 2 (10 pts) or Tier 3 (20 pts) |
| `selections` | `{ [categoryId]: optionIndex }` | `{}` | Selected option index per standard category |
| `wallSelection` | object | `{}` | Wall builder state (see below) |

The `wallSelection` object shape varies by mode and wall type. See [Components Reference — WallBuilder](components.md#wallbuilder-srccomponentswallbuilderjsx) for the full shape. Key fields include `wallType`, `assemblyType`, `studSpacing`, framing fields, `hasServiceWall`, service wall fields, `interiorLayerMaterial`, and `simpleIndex` (simple mode).

### Derived Values (useMemo)

- **`wallPoints`** — Resolves wall points from either simple mode (`simpleIndex`) or builder mode (`calculateWallRsi(wallSelection)` → `getWallPoints`).
- **`totalPoints`** — Sum of all category option points + wall points.

### Points Calculation

```
totalPoints = Σ(category.options[selectedIndex].points) + wallPoints

Compliance: totalPoints >= selectedTier.points
```

## Component Tree

```
App
├── <header>
│   ├── Logo (light/dark variant)
│   ├── Tier Selector dropdown
│   ├── Dark/Light toggle button
│   └── PointsCounter
│
├── <section class="app-intro">
│   └── Prescriptive Tier 2 intro text + assumptions disclaimer
│
├── <main>
│   ├── WallBuilder (for category.type === 'wallBuilder')
│   │   ├── Mode toggle (Build Assembly / Select RSI)
│   │   ├── Builder mode:
│   │   │   ├── FieldGroup cards (numbered, visually grouped)
│   │   │   │   ├── Wall Configuration (type, assembly toggle, service wall checkbox)
│   │   │   │   ├── Service Wall (conditional — wood only, when toggled)
│   │   │   │   ├── Main Wall (framing, cont. insulation, exterior)
│   │   │   │   ├── Interior Layer (conditional — when service wall active)
│   │   │   │   └── Assumptions (footnote variant, read-only)
│   │   │   ├── Wall result (RSI + points, or sub-code warning)
│   │   │   ├── WallSection SVG (wood/steel/ICF/double stud/service wall)
│   │   │   └── Export to Excel button (visible when RSI valid)
│   │   └── Simple mode: OptionButton grid
│   │
│   └── CategoryCard × 7 (standard categories)
│       └── OptionButton × N per category
│
├── <footer>
│   ├── Status message (points remaining or "Target met!")
│   └── Save / Print button (calls window.print(), disabled when no selections)
│
└── PrintSummary (display: none on screen, visible in @media print)
    └── Summary table: header, selected categories, wall details, total, pass/fail
```

## Key Design Decisions

1. **YAML-driven data pipeline** — Material properties live in `data/materials/*.yaml` (NBC-verified). A build script (`scripts/generate.js`) produces JSON lookups committed to `src/data/generated/`. `ecpData.js` imports JSON and a lightweight compute module for runtime RSI assembly.

2. **Hybrid lookup + compute** — JSON stores the hard lookups (cavity RSI, framing factors). A thin compute module (`scripts/compute.js`, ~260 lines) does runtime math for variable boundary layers and the steel modified zone method (NBC K-values depend on spacing and insulating sheathing). An auditable Excel workbook is generated alongside the JSON.

3. **Progressive disclosure** — Wall builder shows only relevant fields based on wall type. Wood/Steel shows framing + continuous insulation dropdowns. ICF shows only form thickness. Cavity size options are further filtered by the selected insulation material and wall type (e.g., wood uses 2x4 studs, steel uses 2x3-5/8 studs; batt materials offer sizes with R-values; loose fill/dense pack offer stud size only). Reduces cognitive load.

4. **No routing** — Single-page, single-view app. No React Router needed.

5. **CSS variables for theming** — Dark mode inverts the gray scale via CSS custom properties. All components adapt automatically.

6. **Exclusive groups** — DHW Electric and DHW Non-Electric use `exclusiveGroup: 'dhw'` so only one can be selected. Enforced at both the data level (App.jsx clears siblings) and UI level (CategoryCard disables siblings).

7. **Dual wall input modes** — The wall category supports both direct RSI selection (simple mode) and assembly-based calculation (builder mode). Mode switching clears state completely.

8. **PWA support** — Service worker + manifest for offline use and "Add to Home Screen" on mobile.

9. **Wall assembly Excel export** — The "Export to Excel" button generates a `.xlsx` workbook entirely client-side using ExcelJS (dynamically imported, code-split into its own chunk). The workbook contains live Excel formulas replicating the parallel-path RSI calculation, a source column with NBC table references, and an embedded PNG of the wall section diagram. Three sheet layouts: universal wood template (single/double/service wall), steel K-factor method, and ICF series sum.

10. **Print/PDF export** — A "Save / Print" button in the footer calls `window.print()`. A hidden `PrintSummary` component renders a clean one-page summary table (selected categories, points, wall builder details when applicable). `@media print` CSS hides the interactive UI and shows only the summary. Forces light mode in print. Zero additional dependencies.

## Cross-References

- [Data Layer Reference](data-layer.md) — ecpData.js exports, lookup tables, calculation formulas, point tables
- [Data Pipeline](data-pipeline.md) — YAML-to-JSON build pipeline, adding materials, updating thresholds
- [Common Tasks](common-tasks.md) — Operational runbook: deploy, update text, bust cache, run tests
- [Components Reference](components.md) — Props, state, behaviors for each component
- [Styling Reference](styling.md) — CSS variables, theming, responsive breakpoints
- [Infrastructure](infrastructure.md) — Vite config, PWA, deployment
