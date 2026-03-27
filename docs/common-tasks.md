# Common Tasks

Step-by-step recipes for the most frequent maintenance tasks. Each section is self-contained — jump to whichever one you need.

## 1. Update a Point Threshold

Point thresholds determine how many Energy Conservation Points a wall assembly earns at each RSI level. They live in `scripts/generate.js` inside the `generateThresholds()` function, not in a YAML file.

1. Open `scripts/generate.js` and search for `generateThresholds`.
2. Edit the `walls` array. Each entry has `minRsi` (the minimum wall RSI to qualify) and `points` (the ECP awarded). Keep them sorted lowest to highest.
3. Regenerate the JSON:
   ```
   npm run generate
   ```
4. Confirm the change in `src/data/generated/thresholds.json`.
5. Run tests:
   ```
   npm test
   ```
6. Commit both `scripts/generate.js` and the regenerated `thresholds.json`.

For a detailed walkthrough and annotated code listing, see [Data Pipeline Guide](data-pipeline.md), section "How to Update ECP Point Thresholds."

## 2. Add a New Insulation Product

Adding an insulation material means editing a YAML source file and regenerating the JSON.

1. For **cavity insulation** (batts, blown-in): edit `data/materials/cavity-insulation.yaml`.
2. For **continuous (rigid) insulation**: edit `data/materials/continuous-insulation.yaml`.
3. Run `npm run generate`, then `npm test`.

The [Data Pipeline Guide](data-pipeline.md), section "How to Add a New Insulation Material," has a complete worked example including the YAML format for both batt and blown-in materials.

## 3. Change UI Text or Labels

These changes are plain code edits — no pipeline regeneration needed. Edit the file, rebuild, and deploy.

### Category names and descriptions

**File:** `src/data/ecpData.js`, in the `categories` array (starts around line 355).

Each category object has a `name` (displayed as the card heading) and a `description` (shown below it). Search for the category `id` to find the right entry.

Example — renaming "Air Tightness" to "Airtightness Test":

```javascript
// Before
{ id: 'airTightness', name: 'Air Tightness', ... }

// After
{ id: 'airTightness', name: 'Airtightness Test', ... }
```

Only change the `name` string. Leave the `id` unchanged — other code references it.

### Tier labels

**File:** `src/data/ecpData.js`, in the `tiers` array (near line 466).

```javascript
export const tiers = [
  { id: 2, label: 'Tier 2', points: 10 },
  { id: 3, label: 'Tier 3', points: 20 },
]
```

The `label` string appears in the header dropdown and the footer message. The `points` value is the target threshold for that tier.

### App intro text

**File:** `src/App.jsx`, in the `<section className="app-intro">` block (around line 124).

This is the paragraph below the header that explains what the calculator does. Edit the JSX text directly.

### Footer text

**File:** `src/App.jsx`, in the `<footer className="app-footer">` section (around line 161).

The footer contains:
- A dynamic status message (points met / points remaining) — this is generated from state, not a static string.
- A version string: `v1.0 — Updated 2026-03-26` on line 169. Update this when you ship a change.
- An "Excel source" link.

### After editing

No pipeline regeneration is needed for any of these. Just rebuild and deploy:

```
npm run build
```

## 4. Deploy a Change

### Development workflow

1. Make your edits.
2. Test locally:
   ```
   npm test
   npm run dev
   ```
3. Commit and push:
   ```
   git add <changed files>
   git commit -m "Description of change"
   git push
   ```

### For auto-deploy hosting (Railway, Render, etc.)

If the hosting service is configured to auto-deploy from a branch, pushing to that branch triggers a build and deploy automatically. No manual steps beyond `git push`.

### For static hosting

The app is a single-page application. To produce a deployable bundle:

```
npm run build
```

This runs Vite's production build. It compiles all React components, bundles the JavaScript, optimizes assets, and writes everything to the `dist/` folder. The contents of `dist/` are a complete static site — upload the entire folder to any web server or CDN.

To preview the production build locally before deploying:

```
npm run preview
```

### What `npm run start` does

```
npm run start
```

This runs `serve dist -s -l $PORT` — a lightweight static file server that serves the `dist/` folder. The `-s` flag enables single-page app mode (all routes fall back to `index.html`). The `$PORT` variable is set by the hosting platform. This command is used by cloud platforms (Railway, Render) as the production start command; you would not normally run it locally.

## 5. Bust the PWA Cache After a Deploy

The app registers a service worker that caches pages for offline use. After a deploy, returning users may still see the old version until the cache updates. Incrementing the cache version forces all clients to re-download.

1. Open `public/sw.js`.
2. Find the cache name on line 1:
   ```javascript
   const CACHE_NAME = 'ecp-calculator-v1';
   ```
3. Increment the version number:
   ```javascript
   const CACHE_NAME = 'ecp-calculator-v2';
   ```
4. Rebuild and deploy:
   ```
   npm run build
   ```

The service worker uses a network-first strategy, so most users will get the new version on their next visit. However, some users may need to **hard-refresh** (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac) or close all tabs of the app and reopen it.

Increment the cache version with every deploy that changes user-facing behavior. You don't need to increment it for documentation-only or test-only changes.

## 6. Run Tests and Interpret Results

### Running the suite

```
npm test
```

### What to expect

A passing run looks like this:

```
 ✓ scripts/compute.test.js (22 tests)
 ✓ scripts/loadMaterials.test.js (9 tests)
 ✓ scripts/validate.test.js (274 tests)
 ✓ src/data/ecpData.test.js (35 tests)
 ✓ src/utils/resolveWallData.test.js (24 tests)
 ✓ src/utils/buildWallSheet.test.js (16 tests)
 ✓ src/components/FieldGroup.test.jsx (4 tests)
 ✓ src/components/PrintSummary.test.jsx (7 tests)

 Test Files  8 passed (8)
       Tests  391 passed (391)
```

### What each test file covers

| Test file | What it checks |
|-----------|---------------|
| `compute.test.js` | Core thermal math: parallel-path RSI, wood/steel/ICF/double-stud wall calculations |
| `loadMaterials.test.js` | YAML loading: ensures all material files parse correctly and have required fields |
| `validate.test.js` | Round-trip validation: re-computes every entry in the generated JSON from YAML sources (274 tests covering all wood, steel, double stud, continuous insulation, ICF, boundary, and threshold entries) |
| `ecpData.test.js` | Data layer API: verifies exports, lookup functions, threshold lookups, and category definitions |
| `resolveWallData.test.js` | Wall data resolution: ensures the Excel export utility can extract correct intermediate RSI values |
| `buildWallSheet.test.js` | Excel sheet builder: validates that the wall assembly export produces correct formulas and structure |
| `PrintSummary.test.jsx` | Print summary: empty state, category rows, wall builder details (single/double stud), pass/fail status |
| `FieldGroup.test.jsx` | UI component: tests the numbered card wrapper renders correctly |

### Common failure pattern

If tests fail with messages like "expected X but received Y" in `validate.test.js` or `ecpData.test.js`, the most likely cause is that the generated JSON is out of sync with the YAML source files. Fix:

```
npm run generate
npm test
```

If tests still fail after regenerating, the YAML edit itself may have introduced an error (missing field, wrong indentation, duplicate key). Check the test output for the specific file and value that failed.

## 7. Run the Development Server

### Prerequisites

- **Node.js 18 or later.** Check with `node --version`.
- **Dependencies installed.** Run this once after cloning or pulling:
  ```
  npm install
  ```

### Start the server

```
npm run dev
```

Vite starts a local development server, typically at:

```
http://localhost:5173
```

If port 5173 is in use, Vite picks the next available port (5174, 5175, etc.) and prints the URL in the terminal.

### Hot reload

Changes to source files (`src/`, `public/`) appear in the browser instantly without a manual refresh. This includes JavaScript, CSS, and JSX changes.

### Stop the server

Press **Ctrl+C** in the terminal.
