# ECP Calculator

Energy Conservation Points calculator for NBC 2020 Tier 2/3 building code compliance in Nova Scotia. Helps builders and building officials determine if a residential design meets prescriptive energy performance thresholds.

**Version:** 1.0
**Stack:** React 18 + Vite 5 + Vitest, plain CSS, ExcelJS (dynamic import)

## Getting Started

Prerequisites: [Node.js](https://nodejs.org/) 18 or later.

```bash
npm install              # Install dependencies
npm run generate         # Rebuild JSON data from YAML sources (ensures data is current)
npm run dev              # Start dev server at localhost:5173
npm test                 # Verify everything works (391 tests)
```

## Architecture

```
YAML materials        Build pipeline         Outputs              App
data/materials/  -->  scripts/generate.js  -->  *.json + audit  -->  React frontend
                                                  |
                                            src/data/generated/
```

### Data Pipeline

Material properties are defined in human-editable YAML files (`data/materials/`). A Node.js build script enumerates all valid wall combinations, computes RSI values using the formulas in `scripts/compute.js`, and writes JSON lookup tables to `src/data/generated/`. The React app imports these JSON files — no thermal math happens at runtime except when boundary layers differ from defaults. See [data-pipeline.md](docs/data-pipeline.md) for the full pipeline reference.

```
data/materials/
  cavity-insulation.yaml    # Batt and blown-in RSI values (NBC Table D)
  continuous-insulation.yaml # Rigid foam RSI values
  framing.yaml              # Stud depths, cavity %, K-values
  icf.yaml                  # ICF form/core properties
  sheathing-cladding.yaml   # Boundary layer RSI values

scripts/
  generate.js               # Build pipeline: YAML -> JSON
  compute.js                # Shared formulas (parallel path, steel K-factor, ICF)
  loadMaterials.js           # YAML loader

src/data/generated/          # Committed JSON outputs
  wall-data.json             # Framed wall lookup (wood + steel)
  double-stud-data.json      # Double stud pre-computed values
  continuous-ins.json         # Continuous insulation RSI by type/thickness
  icf-data.json              # ICF form data
  boundary-options.json       # Cladding, sheathing, air films
  thresholds.json            # ECP point thresholds
```

### Wall Types

| Type | Description | Calculation |
|------|-------------|-------------|
| **Single stud** | Traditional 2x4 through 2x12. Optional continuous exterior insulation. | Parallel path + series boundary layers |
| **Double stud** | Two stud rows on wider plate (2x4/2x6 studs, 2x8-2x12 plate). Blown-in insulation fills everything. | Parallel path per stud layer + isothermal gap |
| **Interior service wall** | Toggle on single or double stud. Adds interior 2x4 service cavity + optional partition material (sheathing or rigid foam). | Primary wall PP + interior layer + service wall PP |
| **Steel frame** | Steel studs with K-factor weighted method per NBC Table A-9.36.2.4.(1)-B. | K1 x RSI_T1 + K2 x RSI_T3 |
| **ICF** | Insulated concrete forms. Pure series sum. | EPS form (x2) + concrete core + boundary |

### Excel Export

The wall builder includes an "Export to Excel" button that generates a `.xlsx` workbook entirely client-side:

- **Live formulas** — change an input value, the total RSI recalculates
- **Layer-by-layer breakdown** — every material, RSI contribution, and intermediate value
- **NBC source citations** — column E references the specific NBC 2020 table for each value
- **Wall section diagram** — embedded PNG of the SVG cross-section

ExcelJS is dynamically imported (code-split, ~938KB chunk loaded only on export click).

```
src/utils/
  resolveWallData.js       # Extracts all intermediate RSI values from selection
  buildWallSheet.js        # Builds Excel sheet with live formulas (wood/steel/ICF)
  exportWallAssembly.js    # Orchestrator: resolve -> sheet -> PNG -> download
  svgToPng.js              # SVG DOM element -> base64 PNG via canvas
```

## Project Structure

```
ecp-calculator/
  CLAUDE.md                 # Project context for AI-assisted development
  index.html                # Entry point
  package.json
  vite.config.js
  public/
    logodarkmode.png        # BEA logo (dark theme)
    logolightmode.png       # BEA logo (light theme)
    manifest.json           # PWA manifest
    sw.js                   # Service worker (offline caching)
  src/
    main.jsx                # React entry point
    App.jsx                 # Root component, all state management
    App.css                 # Styles, CSS variables, dark/light theming
    data/
      ecpData.js            # API layer: imports JSON + compute module
      ecpData.test.js
      generated/            # JSON from build pipeline (committed)
    components/
      WallBuilder.jsx       # Wall assembly builder (simple + builder modes)
      WallSection.jsx       # SVG wall cross-section diagram
      FieldGroup.jsx        # Numbered card wrapper for field groups
      FieldGroup.test.jsx
      CategoryCard.jsx      # Standard category selection UI
      OptionButton.jsx      # Individual option button
      PointsCounter.jsx     # ECP points progress display
    utils/
      resolveWallData.js    # Extracts intermediate RSI values
      resolveWallData.test.js
      buildWallSheet.js     # Builds Excel sheet with live formulas
      buildWallSheet.test.js
      exportWallAssembly.js # Orchestrator: resolve -> sheet -> PNG -> download
      svgToPng.js           # SVG DOM element -> base64 PNG via canvas
  scripts/
    generate.js             # Build pipeline: YAML -> JSON
    compute.js              # Shared formulas (parallel path, steel K-factor, ICF)
    compute.test.js
    loadMaterials.js        # YAML loader
    loadMaterials.test.js
    validate.test.js
  data/materials/           # YAML source of truth
  docs/                     # Developer documentation (see table below)
```

## ECP Points System

Each building component earns points based on performance thresholds. Points are summed to meet tier targets:

| Tier | Points Required |
|------|----------------|
| Tier 2 | 10 points |
| Tier 3 | 20 points |

Categories: Above-Ground Walls, Below Grade Walls, Windows/Doors, Airtightness, Hot Water (Electric), Hot Water (Non-Electric), Ventilation (HRV/ERV), Heated Volume.

## Development

```bash
npm run dev              # Dev server with HMR
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run generate         # Rebuild JSON from YAML sources
npm run generate:audit   # Generate + write audit workbook
npm run generate:validate # Validate generated data
npm run build            # Production build to dist/
npm run preview          # Preview production build locally
npm run start            # Serve production build (requires PORT env var)
```

### Key Design Decisions

- **All state in App.jsx** — no context providers, no external state libraries
- **YAML-driven pipeline** — material properties version-controlled, JSON derived
- **Progressive disclosure** — wall builder shows only relevant fields per wall type
- **CSS variables for theming** — dark mode via custom properties
- **Dual wall input modes** — direct RSI selection or assembly-based calculation
- **Client-side Excel export** — no server component, ExcelJS dynamically imported

## Deployment

`npm run build` produces a `dist/` folder containing a fully static site. Serve it with any static file server.

For auto-deploy platforms (Railway, Vercel, Netlify, etc.):
- **Build command:** `npm run build`
- **Start command:** `npx serve dist -s` (or use the platform's static file serving)
- **Output directory:** `dist`

When deploying changes, update the cache version string in `public/sw.js` (currently `ecp-calculator-v1`) to ensure users receive the latest version. The service worker caches the app shell for offline use; a stale cache name means returning visitors may see an old version until the new service worker activates.

## Documentation

| Doc | Content |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | Project context for AI-assisted development |
| [architecture.md](docs/architecture.md) | Project overview, data flow, component tree, state management |
| [data-layer.md](docs/data-layer.md) | ecpData.js API reference, lookup tables, calculation formulas |
| [data-pipeline.md](docs/data-pipeline.md) | YAML-to-JSON build pipeline, adding materials, updating thresholds |
| [common-tasks.md](docs/common-tasks.md) | Operational runbook: deploy, update text, bust cache, add categories |
| [components.md](docs/components.md) | All React components, props, state, behaviors |
| [styling.md](docs/styling.md) | CSS variables, theming, responsive breakpoints |
| [infrastructure.md](docs/infrastructure.md) | Vite config, PWA setup, service worker, deployment |

## License

Proprietary. Developed by [Baseline Energy Analytics](https://baselineenergy.ca) for Building to Zero Exchange (BTZx).
