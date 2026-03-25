# Interior Service Wall Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interior service wall toggle to WallBuilder that lets users add an independent framed service cavity to any wood wall assembly (single or double stud), with an interior layer (sheathing or rigid foam) between them.

**Architecture:** The service wall is a toggle add-on in WallBuilder. When enabled, `calculateWallRsi()` in ecpData.js composes: boundary layers + primary wall parallel-path + interior layer RSI + service wall parallel-path. WallSection SVG gets new rendering modes for double stud and service wall cross-sections. No new compute.js functions — existing `parallelPath()` and `boundarySum()` are composed in ecpData.js.

**Tech Stack:** React 18, Vite 5, Vitest, vanilla CSS

**Spec:** `docs/superpowers/specs/2026-03-25-service-wall-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/data/ecpData.js` | Modify | `getInteriorLayerRsi()` helper, service wall path in `calculateWallRsi()` |
| `src/data/ecpData.test.js` | Modify | Tests for service wall calculations |
| `src/components/WallBuilder.jsx` | Modify | Service wall toggle, interior layer dropdown, service wall fields, visibility rules, SVG prop wiring |
| `src/components/WallSection.jsx` | Modify | Deep stud fix, double stud rendering, service wall rendering, dynamic boundary labels |

---

## Chunk 1: Data Layer (ecpData.js)

### Task 1: `getInteriorLayerRsi()` helper — test

**Files:**
- Modify: `src/data/ecpData.test.js`

- [ ] **Step 1: Write failing tests for the new helper**

Add to `ecpData.test.js` after the existing `variable boundary layers` describe block:

```js
describe('getInteriorLayerRsi', () => {
  it('returns RSI for a sheathing ID', () => {
    // 7/16" OSB = 0.108
    expect(getInteriorLayerRsi('osb_11')).toBeCloseTo(0.108, 3)
  })

  it('returns RSI for a plywood sheathing ID', () => {
    // 1/2" softwood plywood = 0.109
    expect(getInteriorLayerRsi('plywood_sw_12_5')).toBeCloseTo(0.109, 3)
  })

  it('returns RSI for rigid foam type + thickness', () => {
    // 2" XPS = 1.68
    expect(getInteriorLayerRsi('XPS', '2"')).toBeCloseTo(1.68, 2)
  })

  it('returns RSI for Polyiso 1-1/2"', () => {
    expect(getInteriorLayerRsi('Polyiso', '1-1/2"')).toBeCloseTo(1.385, 2)
  })

  it('returns 0 for null/undefined', () => {
    expect(getInteriorLayerRsi(null)).toBe(0)
    expect(getInteriorLayerRsi(undefined)).toBe(0)
  })

  it('returns 0 for unknown material', () => {
    expect(getInteriorLayerRsi('nonexistent')).toBe(0)
  })
})
```

Also add `getInteriorLayerRsi` to the import at the top of the file:

```js
import {
  calculateWallRsi, getWallPoints, MIN_WALL_RSI,
  getBoundaryOptions, getDefaultBoundary, getContinuousInsRsi,
  getInteriorLayerRsi,
  wallTypes, studSpacingOptions, cavityMaterials, continuousInsTypes,
  categories, tiers, framedWallRsi, icfRsi,
} from './ecpData'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/ecpData.test.js`
Expected: FAIL — `getInteriorLayerRsi` is not exported

### Task 2: `getInteriorLayerRsi()` helper — implement

**Files:**
- Modify: `src/data/ecpData.js`

- [ ] **Step 1: Add the helper function**

Add after the existing `getContinuousInsRsi()` function (after line 204):

```js
// Interior layer RSI: resolves either a sheathing ID or a cont ins type+thickness
// Sheathing IDs match boundary-options.json (e.g., 'osb_11', 'plywood_sw_12_5')
// Cont ins types match continuous-ins.json (e.g., 'XPS', 'Polyiso')
export function getInteriorLayerRsi(material, thickness) {
  if (!material) return 0
  // Try sheathing lookup first
  const sheathing = boundaryOptions.sheathing.options.find(o => o.id === material)
  if (sheathing) return sheathing.rsi
  // Try continuous insulation lookup
  return getContinuousInsRsi(material, thickness)
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/data/ecpData.test.js`
Expected: All `getInteriorLayerRsi` tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/data/ecpData.js src/data/ecpData.test.js
git commit -m "feat: add getInteriorLayerRsi() helper for interior layer lookup"
```

### Task 3: Service wall path in `calculateWallRsi()` — test

**Files:**
- Modify: `src/data/ecpData.test.js`

- [ ] **Step 1: Write failing tests for service wall calculation**

Add a new describe block after the existing `calculateWallRsi` describe:

```js
describe('calculateWallRsi with service wall', () => {
  it('returns correct RSI for single wall + service wall + OSB interior layer', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
    })
    // Primary PP (~2.41) + OSB (0.108) + service PP (~1.49) + boundary (~0.40)
    // Should be significantly more than single wall alone (2.81)
    expect(rsi).toBeGreaterThan(4.0)
    expect(rsi).toBeLessThan(5.0)
  })

  it('returns correct RSI for single wall + service wall + 2" XPS interior layer', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'XPS',
      interiorLayerThickness: '2"',
    })
    // Primary PP + XPS (1.68) + service PP + boundary → much higher
    expect(rsi).toBeGreaterThan(5.5)
    expect(rsi).toBeLessThan(6.5)
  })

  it('returns correct RSI for double stud + service wall', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      assemblyType: 'doubleStud',
      studSpacing: '16"',
      outerStud: '2x4',
      innerStud: '2x4',
      plate: '2x10',
      doubleStudMaterial: 'Dense Pack Cellulose',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R14',
      interiorLayerMaterial: 'osb_11',
    })
    // Double stud PP (~3.15) + OSB (0.108) + service PP (~1.62) + boundary (~0.40)
    expect(rsi).toBeGreaterThan(5.0)
  })

  it('returns null when service wall fields incomplete', () => {
    expect(calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      // missing service wall fields
    })).toBeNull()
  })

  it('ignores contInsType/contInsThickness when service wall is enabled', () => {
    const withContIns = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
      contInsType: 'XPS',
      contInsThickness: '2"',
    })
    const withoutContIns = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      hasServiceWall: true,
      serviceSpacing: '16"',
      serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
    })
    expect(withContIns).toBeCloseTo(withoutContIns, 4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/ecpData.test.js`
Expected: FAIL — `hasServiceWall` param not handled

### Task 4: Service wall path in `calculateWallRsi()` — implement

**Files:**
- Modify: `src/data/ecpData.js`

- [ ] **Step 1: Add service wall parameters to function signature**

In `calculateWallRsi()` (line 208), update the destructured params:

```js
export function calculateWallRsi({
  wallType, studSpacing, cavityMaterial, cavityType,
  contInsType, contInsThickness, icfFormThickness,
  sheathingId, claddingId,
  assemblyType = 'single',
  outerStud, innerStud, plate, doubleStudMaterial,
  hasServiceWall = false,
  serviceSpacing, serviceCavityMaterial, serviceCavityType,
  interiorLayerMaterial, interiorLayerThickness,
} = {}) {
```

- [ ] **Step 2: Add the service wall code path**

Add after the `contInsRsi` line (line 226) and before the ICF path (line 228). This early-returns for the service wall path so the existing single/double stud paths are untouched:

```js
  // Service wall path (wood only, works with single or double stud primary)
  if (hasServiceWall && wallType === 'wood') {
    const spacing = studSpacing?.replace('"', '') || ''
    const wt = wallData.wood

    // Compute primary wall parallel-path
    let primaryPP
    if (assemblyType === 'doubleStud') {
      const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
      const dsEntry = doubleStudData[spacing]?.[key]
      if (!dsEntry) return null
      primaryPP = dsEntry.totalPpRsi
    } else {
      // Single wall primary
      if (!wt?.spacings?.[spacing]) return null
      const sp = wt.spacings[spacing]
      const entry = sp.materials[cavityMaterial]?.[cavityType]
      if (!entry) return null
      const studRsi = wt.studs[entry.stud].depth_mm * 0.0085
      primaryPP = parallelPath(studRsi, entry.cavityRsi, sp.cavity_pct)
    }

    // Compute service wall parallel-path
    const svcSpacing = serviceSpacing?.replace('"', '') || ''
    if (!wt?.spacings?.[svcSpacing]) return null
    const svcSp = wt.spacings[svcSpacing]
    const svcEntry = svcSp.materials[serviceCavityMaterial]?.[serviceCavityType]
    if (!svcEntry) return null
    const svcStudRsi = wt.studs[svcEntry.stud].depth_mm * 0.0085
    const servicePP = parallelPath(svcStudRsi, svcEntry.cavityRsi, svcSp.cavity_pct)

    // Interior layer RSI
    const intLayerRsi = getInteriorLayerRsi(interiorLayerMaterial, interiorLayerThickness)

    // Total: boundary (no cont ins) + primary + interior layer + service
    return boundarySum(boundary) + primaryPP + intLayerRsi + servicePP
  }
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/data/ecpData.test.js`
Expected: All service wall tests PASS, all existing tests still PASS

- [ ] **Step 4: Commit**

```bash
git add src/data/ecpData.js src/data/ecpData.test.js
git commit -m "feat: add service wall calculation path in calculateWallRsi()"
```

---

## Chunk 2: WallBuilder UI

### Task 5: Service wall state and toggle

**Files:**
- Modify: `src/components/WallBuilder.jsx`

- [ ] **Step 1: Add new selection fields to destructuring**

In the destructuring of `selection` (line 73-76), add the new fields:

```js
  const {
    wallType, studSpacing, cavityMaterial, cavityType,
    contInsType, contInsThickness, icfFormThickness, simpleIndex,
    assemblyType = 'single',
    outerStud, innerStud, plate, doubleStudMaterial,
    hasServiceWall = false,
    serviceSpacing, serviceCavityMaterial, serviceCavityType,
    interiorLayerMaterial, interiorLayerThickness,
  } = selection || {}
```

- [ ] **Step 2: Add the service wall toggle checkbox**

Add after the assembly type toggle block (after line 228), inside the `{wallType === 'wood' && (` condition:

```jsx
          {/* Service wall toggle (wood only) */}
          {wallType === 'wood' && (
            <div className="wall-selectors-group">
              <label className="wall-selectors-group-label service-wall-toggle">
                <input
                  type="checkbox"
                  checked={hasServiceWall}
                  onChange={e => {
                    if (e.target.checked) {
                      onSelect({
                        ...selection,
                        hasServiceWall: true,
                        interiorLayerMaterial: 'osb_11',
                        contInsType: undefined,
                        contInsThickness: undefined,
                      })
                    } else {
                      onSelect({
                        ...selection,
                        hasServiceWall: false,
                        serviceSpacing: undefined,
                        serviceCavityMaterial: undefined,
                        serviceCavityType: undefined,
                        interiorLayerMaterial: undefined,
                        interiorLayerThickness: undefined,
                      })
                    }
                  }}
                />
                {' '}Add Interior Service Wall
              </label>
            </div>
          )}
```

- [ ] **Step 3: Update continuous insulation visibility**

Change the existing continuous insulation condition (line 345: `{isFramedWall && isSingleWall && (`) to:

```jsx
          {isFramedWall && isSingleWall && !hasServiceWall && (
```

This hides continuous insulation when service wall is enabled or when double stud is selected (existing behavior).

- [ ] **Step 4: Commit**

```bash
git add src/components/WallBuilder.jsx
git commit -m "feat: add service wall toggle with cont ins visibility rules"
```

### Task 6: Interior layer dropdown

**Files:**
- Modify: `src/components/WallBuilder.jsx`

- [ ] **Step 1: Add interior layer section**

Add after the service wall toggle, conditioned on `hasServiceWall`:

```jsx
          {/* Interior layer (between primary wall and service wall) */}
          {hasServiceWall && (
            <div className="wall-selectors-group">
              <label className="wall-selectors-group-label">Interior Layer</label>
              <div className="wall-selectors">
                <div className="wall-selector">
                  <label htmlFor="interiorLayerMaterial">Material</label>
                  <select
                    id="interiorLayerMaterial"
                    value={interiorLayerMaterial || ''}
                    onChange={e => handleFieldChange('interiorLayerMaterial', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <optgroup label="Sheathing">
                      {boundaryOpts.sheathing.options.map(o => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Rigid Insulation">
                      {continuousInsTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {/* Thickness — only for rigid insulation (not sheathing IDs) */}
                {interiorLayerMaterial && !boundaryOpts.sheathing.options.find(o => o.id === interiorLayerMaterial) && (
                  <div className="wall-selector">
                    <label htmlFor="interiorLayerThickness">Thickness</label>
                    <select
                      id="interiorLayerThickness"
                      value={interiorLayerThickness || ''}
                      onChange={e => handleFieldChange('interiorLayerThickness', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {continuousInsThicknesses.filter(t => t !== 'None').map(th => (
                        <option key={th} value={th}>{th}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
```

- [ ] **Step 2: Clear thickness when switching to sheathing**

In the `handleFieldChange` function (line 90), add a case for `interiorLayerMaterial`:

```js
    if (field === 'interiorLayerMaterial') {
      // Clear thickness when switching materials (sheathing doesn't need thickness)
      onSelect({
        ...selection,
        simpleIndex: undefined,
        interiorLayerMaterial: value || undefined,
        interiorLayerThickness: undefined,
      })
      return
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WallBuilder.jsx
git commit -m "feat: add interior layer dropdown with sheathing/foam optgroups"
```

### Task 7: Service wall framing fields

**Files:**
- Modify: `src/components/WallBuilder.jsx`

- [ ] **Step 1: Compute available cavity types for service wall**

Add near the existing `availableCavityTypes` (after line 121):

```js
  const serviceAvailableCavityTypes = getAvailableCavityTypes('wood', serviceSpacing, serviceCavityMaterial)
```

- [ ] **Step 2: Add service wall framing section**

Add after the interior layer section, conditioned on `hasServiceWall`:

```jsx
          {/* Service wall framing */}
          {hasServiceWall && (
            <div className="wall-selectors-group">
              <label className="wall-selectors-group-label">Service Wall</label>
              <div className="wall-selectors">
                <div className="wall-selector">
                  <label htmlFor="serviceSpacing">Stud Spacing</label>
                  <select
                    id="serviceSpacing"
                    value={serviceSpacing || ''}
                    onChange={e => handleFieldChange('serviceSpacing', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {studSpacingOptions.map(opt => (
                      <option key={opt.label} value={opt.label}>{opt.label} o.c.</option>
                    ))}
                  </select>
                </div>
                <div className="wall-selector">
                  <label htmlFor="serviceCavityMaterial">Cavity Insulation</label>
                  <select
                    id="serviceCavityMaterial"
                    value={serviceCavityMaterial || ''}
                    onChange={e => handleFieldChange('serviceCavityMaterial', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {cavityMaterials.map(mat => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                  </select>
                </div>
                <div className="wall-selector">
                  <label htmlFor="serviceCavityType">Cavity Size</label>
                  <select
                    id="serviceCavityType"
                    value={serviceCavityType || ''}
                    onChange={e => handleFieldChange('serviceCavityType', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {serviceAvailableCavityTypes.map(ct => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
```

- [ ] **Step 3: Add `serviceCavityMaterial` case to `handleFieldChange`**

Clear service cavity type when service material changes:

```js
    if (field === 'serviceCavityMaterial') {
      onSelect({
        ...selection,
        simpleIndex: undefined,
        serviceCavityMaterial: value || undefined,
        serviceCavityType: undefined,
      })
      return
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/components/WallBuilder.jsx
git commit -m "feat: add service wall framing fields to WallBuilder"
```

### Task 8: Run full test suite and verify

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (data layer + any existing component tests)

- [ ] **Step 2: Start dev server and manually test**

Run: `npm run dev`

Test these scenarios:
1. Wood → Single Wall → check "Add Interior Service Wall" → select interior layer (OSB) → select service wall fields → verify RSI calculates
2. Wood → Single Wall → check service wall → select rigid foam (XPS 2") → verify RSI is higher
3. Wood → Double Stud → check service wall → configure all fields → verify RSI calculates
4. Wood → Single Wall → check service wall → verify Continuous Insulation section is hidden
5. Wood → Single Wall → uncheck service wall → verify Continuous Insulation section reappears
6. Steel → verify service wall toggle does NOT appear
7. ICF → verify service wall toggle does NOT appear

- [ ] **Step 3: Commit if any fixes needed**

---

## Chunk 3: WallSection SVG

### Task 9: Deep stud dimension fix — test & implement

**Files:**
- Modify: `src/components/WallSection.jsx`

- [ ] **Step 1: Replace binary stud depth lookup**

In `WallSection.jsx`, replace line 250:

```js
  const studDepthInches = studDepth === '2x4' ? 3.5 : 5.5
```

With:

```js
  const studDepthMap = {
    '2x4': 3.5, '2x6': 5.5, '2x8': 7.25, '2x10': 9.25, '2x12': 11.25,
  }
  const toStudDepthInches = (size) => studDepthMap[size] || 5.5
  const studDepthInches = toStudDepthInches(studDepth)
```

The `toStudDepthInches` helper will be reused for double stud and service wall stud sections.

- [ ] **Step 2: Verify with dev server**

Run: `npm run dev`
Select Wood → 16" → Dense Pack Cellulose → 2x10. Verify the SVG cavity depth is visually deeper than 2x6.

- [ ] **Step 3: Commit**

```bash
git add src/components/WallSection.jsx
git commit -m "fix: WallSection SVG renders correct depth for 2x8/2x10/2x12 studs"
```

### Task 10: Dynamic boundary labels

**Files:**
- Modify: `src/components/WallSection.jsx`
- Modify: `src/components/WallBuilder.jsx`

- [ ] **Step 1: Add new props to WallSection**

Update the function signature (line 11) to include:

```js
export default function WallSection({
  wallType = 'wood',
  studDepth = '2x6',
  studSpacing = 16,
  continuousIns = 0,
  cavityInsLabel = null,
  continuousInsLabel = null,
  icfFormThickness = 0,
  claddingLabel = null,
  sheathingLabel = null,
  width = 600,
}) {
```

- [ ] **Step 2: Use dynamic labels in the framed wall layer list**

Replace the hardcoded label strings in the layers array (around line 431):

```js
              { name: sheathingLabel || '7/16" sheathing', midY: sheathingY + sheathingThickness * scale / 2 },
```

And for cladding (around line 435):

```js
              { name: claddingLabel || '½" cladding', midY: claddingY + claddingThickness * scale / 2 },
```

- [ ] **Step 3: Pass labels from WallBuilder**

In `WallBuilder.jsx`, update the WallSection invocation (line 492-499). Add label props:

```jsx
              <WallSection
                wallType={wallType}
                studDepth={getStudDepth(cavityType)}
                studSpacing={getStudSpacingNum(studSpacing)}
                continuousIns={getContInsThicknessNum(contInsThickness)}
                cavityInsLabel={cavityType}
                continuousInsLabel={contInsType && contInsThickness !== 'None' ? `${contInsThickness} ${contInsType}` : null}
                claddingLabel={boundaryOpts.cladding.options.find(o => o.id === (selection?.claddingId || boundaryOpts.cladding.defaults[wallType]))?.label}
                sheathingLabel={boundaryOpts.sheathing.applies_to.includes(wallType) ? boundaryOpts.sheathing.options.find(o => o.id === (selection?.sheathingId || boundaryOpts.sheathing.default))?.label : null}
              />
```

- [ ] **Step 4: Verify with dev server**

Run: `npm run dev`
Select Wood → change cladding to "Brick Veneer" → verify label updates in SVG. Change sheathing to "1/2\" Plywood" → verify label updates.

- [ ] **Step 5: Commit**

```bash
git add src/components/WallSection.jsx src/components/WallBuilder.jsx
git commit -m "fix: WallSection SVG shows selected cladding/sheathing labels"
```

### Task 11: Double stud SVG rendering

**Files:**
- Modify: `src/components/WallSection.jsx`
- Modify: `src/components/WallBuilder.jsx`

- [ ] **Step 1: Add new props for double stud/service wall to WallSection**

Update the function signature to include all new props:

```js
export default function WallSection({
  wallType = 'wood',
  studDepth = '2x6',
  studSpacing = 16,
  continuousIns = 0,
  cavityInsLabel = null,
  continuousInsLabel = null,
  icfFormThickness = 0,
  claddingLabel = null,
  sheathingLabel = null,
  assemblyType = 'single',
  hasServiceWall = false,
  outerStudDepth = '2x4',
  innerStudDepth = '2x4',
  gapInches = 0,
  serviceStudDepth = '2x4',
  serviceSpacingInches = 16,
  serviceCavityLabel = null,
  interiorLayerLabel = null,
  interiorLayerThicknessInches = 0,
  width = 600,
}) {
```

- [ ] **Step 2: Add double stud rendering before the single-wall framed rendering**

After the ICF section (after line 245) and before the existing wood/steel section (line 247), add:

```js
  // --- Double Stud Rendering ---
  if (assemblyType === 'doubleStud' && wallType === 'wood') {
    const outerDepth = toStudDepthInches(outerStudDepth)
    const innerDepth = toStudDepthInches(innerStudDepth)
    const svcDepth = hasServiceWall ? toStudDepthInches(serviceStudDepth) : 0
    const intLayerThick = hasServiceWall ? interiorLayerThicknessInches : 0

    const totalThickness =
      drywallThickness +
      (hasServiceWall ? svcDepth + intLayerThick : 0) +
      innerDepth +
      gapInches +
      outerDepth +
      sheathingThickness +
      claddingThickness

    const wallLengthInches = studSpacing * 1.5
    const wallWidthPx = wallLengthInches * scale
    const dsSvgWidth = wallWidthPx + 220
    const dsSvgHeight = totalThickness * scale + 80
    const dsStartY = 30

    // Layer y-positions (interior → exterior, top → bottom)
    let yPos = dsStartY
    const drywallYDs = yPos; yPos += drywallThickness * scale
    const svcCavityYDs = hasServiceWall ? yPos : null
    if (hasServiceWall) yPos += svcDepth * scale
    const intLayerYDs = hasServiceWall ? yPos : null
    if (hasServiceWall) yPos += intLayerThick * scale
    const innerCavityYDs = yPos; yPos += innerDepth * scale
    const gapYDs = yPos; yPos += gapInches * scale
    const outerCavityYDs = yPos; yPos += outerDepth * scale
    const sheathingYDs = yPos; yPos += sheathingThickness * scale
    const claddingYDs = yPos

    const numStuds = Math.ceil(wallLengthInches / studSpacing) + 1
    const studWidthInches = 1.5

    // Build label list
    const dsLayers = [
      { name: '½" drywall', midY: drywallYDs + drywallThickness * scale / 2 },
    ]
    if (hasServiceWall) {
      dsLayers.push({ name: serviceCavityLabel || 'service cavity', midY: svcCavityYDs + svcDepth * scale / 2 })
      if (intLayerThick > 0) {
        dsLayers.push({ name: interiorLayerLabel || 'interior layer', midY: intLayerYDs + intLayerThick * scale / 2 })
      }
    }
    dsLayers.push({ name: cavityInsLabel ? `inner ${cavityInsLabel}` : 'inner studs', midY: innerCavityYDs + innerDepth * scale / 2 })
    if (gapInches > 0) {
      dsLayers.push({ name: 'gap (blown-in)', midY: gapYDs + gapInches * scale / 2 })
    }
    dsLayers.push({ name: 'outer studs', midY: outerCavityYDs + outerDepth * scale / 2 })
    dsLayers.push({ name: sheathingLabel || '7/16" sheathing', midY: sheathingYDs + sheathingThickness * scale / 2 })
    dsLayers.push({ name: claddingLabel || '½" cladding', midY: claddingYDs + claddingThickness * scale / 2 })

    // Helper to render a wood stud+cavity section
    const renderStudCavity = (startY, depth, spacingIn) => {
      const studH = depth * scale
      const numSt = Math.ceil(wallLengthInches / spacingIn) + 1
      return (
        <g>
          {/* Cavity background */}
          <rect x={0} y={startY} width={wallWidthPx} height={studH}
            fill={colors.cavity} stroke="#9ca3af" strokeWidth="1" />
          {/* Cavity pattern between studs */}
          {Array.from({ length: numSt - 1 }).map((_, i) => {
            const cavStartX = (i * spacingIn + studWidthInches) * scale
            const cavW = (spacingIn - studWidthInches) * scale
            if (cavStartX >= wallWidthPx) return null
            return (
              <g key={`cav-${startY}-${i}`}>
                {generateCavityPattern(cavStartX, Math.min(cavW, wallWidthPx - cavStartX), startY, studH)}
              </g>
            )
          })}
          {/* Studs */}
          {Array.from({ length: numSt }).map((_, i) => {
            const sx = i * spacingIn * scale
            const sw = studWidthInches * scale
            if (sx >= wallWidthPx) return null
            const aw = Math.min(sw, wallWidthPx - sx)
            return (
              <g key={`stud-${startY}-${i}`}>
                <rect x={sx} y={startY} width={aw} height={studH}
                  fill={colors.stud} stroke="#333" strokeWidth="1" />
                {aw >= sw - 1 && (
                  <>
                    <line x1={sx + 1} y1={startY + 1} x2={sx + sw - 1} y2={startY + studH - 1}
                      stroke="#333" strokeWidth="1" />
                    <line x1={sx + sw - 1} y1={startY + 1} x2={sx + 1} y2={startY + studH - 1}
                      stroke="#333" strokeWidth="1" />
                  </>
                )}
              </g>
            )
          })}
        </g>
      )
    }

    return (
      <div className="wall-section" style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${dsSvgWidth} ${dsSvgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', maxHeight: '300px' }}
        >
          <text x={dsSvgWidth / 2} y="18" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            INTERIOR
          </text>
          <g transform="translate(20, 0)">
            {/* Drywall */}
            <rect x={0} y={drywallYDs} width={wallWidthPx}
              height={drywallThickness * scale} fill={colors.drywall} stroke="#9ca3af" strokeWidth="1" />

            {/* Service wall (if enabled) */}
            {hasServiceWall && renderStudCavity(svcCavityYDs, svcDepth, serviceSpacingInches)}

            {/* Interior layer (if service wall enabled and has thickness) */}
            {hasServiceWall && intLayerThick > 0 && (
              <g>
                <rect x={0} y={intLayerYDs} width={wallWidthPx}
                  height={intLayerThick * scale}
                  fill={interiorLayerLabel && !interiorLayerLabel.includes('"') ? colors.sheathing : '#fce7f3'}
                  stroke={interiorLayerLabel && !interiorLayerLabel.includes('"') ? '#6b7280' : '#db2777'}
                  strokeWidth="1" />
                {/* Foam pattern if rigid insulation */}
                {interiorLayerLabel && interiorLayerLabel.match(/EPS|XPS|Polyiso|Mineral Wool/) &&
                  generateContInsPattern(0, wallWidthPx, intLayerYDs, intLayerThick * scale)}
              </g>
            )}

            {/* Inner stud row */}
            {renderStudCavity(innerCavityYDs, innerDepth, studSpacing)}

            {/* Gap (blown-in, no studs) */}
            {gapInches > 0 && (
              <g>
                <rect x={0} y={gapYDs} width={wallWidthPx}
                  height={gapInches * scale} fill={colors.cavity} stroke="#9ca3af" strokeWidth="1" />
                {generateCavityPattern(0, wallWidthPx, gapYDs, gapInches * scale)}
              </g>
            )}

            {/* Outer stud row */}
            {renderStudCavity(outerCavityYDs, outerDepth, studSpacing)}

            {/* Sheathing */}
            <rect x={0} y={sheathingYDs} width={wallWidthPx}
              height={sheathingThickness * scale} fill={colors.sheathing} stroke="#6b7280" strokeWidth="1" />

            {/* Cladding */}
            <rect x={0} y={claddingYDs} width={wallWidthPx}
              height={claddingThickness * scale} fill={colors.cladding} stroke="#4b5563" strokeWidth="1" />

            {/* Labels */}
            {(() => {
              const labelSpacing = 14
              const labelStartY = dsStartY + 5
              const labelX = wallWidthPx + 80
              return (
                <g>
                  {dsLayers.map((layer, i) => {
                    const labelY = labelStartY + i * labelSpacing
                    return (
                      <g key={layer.name}>
                        <path
                          d={`M ${wallWidthPx + 20} ${layer.midY}
                              L ${wallWidthPx + 40} ${layer.midY}
                              L ${labelX - 5} ${labelY}`}
                          fill="none" stroke="#9ca3af" strokeWidth="1" />
                        <circle cx={wallWidthPx + 20} cy={layer.midY} r="2" fill="#9ca3af" />
                        <text x={labelX} y={labelY + 3} fontSize="9" fill="#6b7280">{layer.name}</text>
                      </g>
                    )
                  })}
                </g>
              )
            })()}

            {/* Stud spacing dimension */}
            <g transform={`translate(0, ${claddingYDs + claddingThickness * scale + 15})`}>
              <line x1={0} y1="0" x2={studSpacing * scale} y2="0" stroke="#9ca3af" strokeWidth="1" />
              <line x1={0} y1="-5" x2={0} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <line x1={studSpacing * scale} y1="-5" x2={studSpacing * scale} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <text x={studSpacing * scale / 2} y="15" textAnchor="middle" fontSize="10" fill="#6b7280">
                {studSpacing}" o.c.
              </text>
            </g>
          </g>
          <text x={dsSvgWidth / 2} y={claddingYDs + claddingThickness * scale + 45}
            textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            EXTERIOR
          </text>
        </svg>
      </div>
    )
  }
```

Note: place the `toStudDepthInches` helper and `studDepthMap` at the top of the function body (from Task 9) so it's available to both the double stud and single wall sections.

- [ ] **Step 3: Commit**

```bash
git add src/components/WallSection.jsx
git commit -m "feat: WallSection SVG renders double stud and service wall cross-sections"
```

### Task 12: Single wall + service wall SVG rendering

**Files:**
- Modify: `src/components/WallSection.jsx`

- [ ] **Step 1: Add service wall rendering for single wall mode**

Before the existing wood/steel framed wall return (the `return (` around line 282), add a check for single wall with service wall. This reuses the same `renderStudCavity` helper from Task 11:

```js
  // --- Single Wall + Service Wall Rendering ---
  if (assemblyType === 'single' && hasServiceWall) {
    const primaryDepth = studDepthInches
    const svcDepth = toStudDepthInches(serviceStudDepth)
    const intLayerThick = interiorLayerThicknessInches

    const totalThickness =
      drywallThickness + svcDepth + intLayerThick + primaryDepth +
      sheathingThickness + claddingThickness

    const wallLengthInches = studSpacing * 1.5
    const wallWidthPx = wallLengthInches * scale
    const swSvgWidth = wallWidthPx + 220
    const swSvgHeight = totalThickness * scale + 80
    const swStartY = 30

    let yPos = swStartY
    const drywallYSw = yPos; yPos += drywallThickness * scale
    const svcCavityYSw = yPos; yPos += svcDepth * scale
    const intLayerYSw = yPos; yPos += intLayerThick * scale
    const primaryCavityYSw = yPos; yPos += primaryDepth * scale
    const sheathingYSw = yPos; yPos += sheathingThickness * scale
    const claddingYSw = yPos

    const swLayers = [
      { name: '½" drywall', midY: drywallYSw + drywallThickness * scale / 2 },
      { name: serviceCavityLabel || 'service cavity', midY: svcCavityYSw + svcDepth * scale / 2 },
    ]
    if (intLayerThick > 0) {
      swLayers.push({ name: interiorLayerLabel || 'interior layer', midY: intLayerYSw + intLayerThick * scale / 2 })
    }
    swLayers.push(
      { name: cavityInsLabel || `${studDepth} stud`, midY: primaryCavityYSw + primaryDepth * scale / 2 },
      { name: sheathingLabel || '7/16" sheathing', midY: sheathingYSw + sheathingThickness * scale / 2 },
      { name: claddingLabel || '½" cladding', midY: claddingYSw + claddingThickness * scale / 2 },
    )

    // Reuse renderStudCavity helper (extract to top of function scope)
    // ... same SVG structure as double stud but with:
    //   drywall → service wall → interior layer → primary wall → sheathing → cladding

    return (
      <div className="wall-section" style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${swSvgWidth} ${swSvgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', maxHeight: '250px' }}
        >
          <text x={swSvgWidth / 2} y="18" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            INTERIOR
          </text>
          <g transform="translate(20, 0)">
            <rect x={0} y={drywallYSw} width={wallWidthPx}
              height={drywallThickness * scale} fill={colors.drywall} stroke="#9ca3af" strokeWidth="1" />

            {renderStudCavity(svcCavityYSw, svcDepth, serviceSpacingInches)}

            {intLayerThick > 0 && (
              <g>
                <rect x={0} y={intLayerYSw} width={wallWidthPx}
                  height={intLayerThick * scale}
                  fill={interiorLayerLabel && interiorLayerLabel.match(/EPS|XPS|Polyiso|Mineral Wool/) ? '#fce7f3' : colors.sheathing}
                  stroke={interiorLayerLabel && interiorLayerLabel.match(/EPS|XPS|Polyiso|Mineral Wool/) ? '#db2777' : '#6b7280'}
                  strokeWidth="1" />
                {interiorLayerLabel && interiorLayerLabel.match(/EPS|XPS|Polyiso|Mineral Wool/) &&
                  generateContInsPattern(0, wallWidthPx, intLayerYSw, intLayerThick * scale)}
              </g>
            )}

            {/* Primary wall — use existing stud rendering logic */}
            {wallType === 'wood' && renderStudCavity(primaryCavityYSw, primaryDepth, studSpacing)}

            <rect x={0} y={sheathingYSw} width={wallWidthPx}
              height={sheathingThickness * scale} fill={colors.sheathing} stroke="#6b7280" strokeWidth="1" />
            <rect x={0} y={claddingYSw} width={wallWidthPx}
              height={claddingThickness * scale} fill={colors.cladding} stroke="#4b5563" strokeWidth="1" />

            {/* Labels */}
            {(() => {
              const labelSpacing = 14
              const labelStartY = swStartY + 5
              const labelX = wallWidthPx + 80
              return (
                <g>
                  {swLayers.map((layer, i) => {
                    const labelY = labelStartY + i * labelSpacing
                    return (
                      <g key={layer.name}>
                        <path
                          d={`M ${wallWidthPx + 20} ${layer.midY}
                              L ${wallWidthPx + 40} ${layer.midY}
                              L ${labelX - 5} ${labelY}`}
                          fill="none" stroke="#9ca3af" strokeWidth="1" />
                        <circle cx={wallWidthPx + 20} cy={layer.midY} r="2" fill="#9ca3af" />
                        <text x={labelX} y={labelY + 3} fontSize="9" fill="#6b7280">{layer.name}</text>
                      </g>
                    )
                  })}
                </g>
              )
            })()}

            <g transform={`translate(0, ${claddingYSw + claddingThickness * scale + 15})`}>
              <line x1={0} y1="0" x2={studSpacing * scale} y2="0" stroke="#9ca3af" strokeWidth="1" />
              <line x1={0} y1="-5" x2={0} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <line x1={studSpacing * scale} y1="-5" x2={studSpacing * scale} y2="5" stroke="#9ca3af" strokeWidth="1" />
              <text x={studSpacing * scale / 2} y="15" textAnchor="middle" fontSize="10" fill="#6b7280">
                {studSpacing}" o.c.
              </text>
            </g>
          </g>
          <text x={swSvgWidth / 2} y={claddingYSw + claddingThickness * scale + 45}
            textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
            EXTERIOR
          </text>
        </svg>
      </div>
    )
  }
```

**Important:** The `renderStudCavity` helper used in Tasks 11 and 12 must be defined once, above both rendering sections. Extract it to a shared location within the function body, after the pattern generators and before any rendering branches.

- [ ] **Step 2: Commit**

```bash
git add src/components/WallSection.jsx
git commit -m "feat: WallSection SVG renders single wall + service wall cross-section"
```

### Task 13: Wire WallBuilder SVG props for all modes

**Files:**
- Modify: `src/components/WallBuilder.jsx`

- [ ] **Step 1: Update WallSection render condition and props**

Replace the existing WallSection render block (lines 489-501) with a unified block that handles all modes:

```jsx
          {/* Wall Section Diagram */}
          {isFramedWall && wallType === 'wood' && (() => {
            // Determine if we have enough info to show diagram
            const hasPrimaryInfo = isSingleWall
              ? (studSpacing && cavityType)
              : (isDoubleStud && studSpacing && outerStud && innerStud && plate && doubleStudMaterial)
            const hasServiceInfo = !hasServiceWall || (serviceSpacing && serviceCavityType)
            if (!hasPrimaryInfo) return null

            // Compute gap for double stud (plate depth - outer - inner)
            const dsGapInches = isDoubleStud
              ? ((studDepthMm[plate] || 0) - (studDepthMm[outerStud] || 89) - (studDepthMm[innerStud] || 89)) / 25.4
              : 0

            // Interior layer thickness in inches (0 for sheathing, actual for foam)
            const isFoam = interiorLayerMaterial && !boundaryOpts.sheathing.options.find(o => o.id === interiorLayerMaterial)
            const intLayerThickInches = isFoam ? getContInsThicknessNum(interiorLayerThickness) : 0
            // Sheathing interior layer: use fixed ~0.44" (11mm) visual thickness
            const intLayerVisualThick = interiorLayerMaterial
              ? (isFoam ? intLayerThickInches : 0.44)
              : 0

            const intLayerLabelText = interiorLayerMaterial
              ? (isFoam
                ? `${interiorLayerThickness || ''} ${interiorLayerMaterial}`
                : boundaryOpts.sheathing.options.find(o => o.id === interiorLayerMaterial)?.label)
              : null

            return (
              <div className="wall-section-container">
                <WallSection
                  wallType={wallType}
                  studDepth={isSingleWall ? getStudDepth(cavityType) : '2x6'}
                  studSpacing={getStudSpacingNum(studSpacing)}
                  continuousIns={!hasServiceWall && isSingleWall ? getContInsThicknessNum(contInsThickness) : 0}
                  cavityInsLabel={isSingleWall ? cavityType : doubleStudMaterial}
                  continuousInsLabel={!hasServiceWall && isSingleWall && contInsType && contInsThickness !== 'None' ? `${contInsThickness} ${contInsType}` : null}
                  claddingLabel={boundaryOpts.cladding.options.find(o => o.id === (selection?.claddingId || boundaryOpts.cladding.defaults[wallType]))?.label}
                  sheathingLabel={boundaryOpts.sheathing.options.find(o => o.id === (selection?.sheathingId || boundaryOpts.sheathing.default))?.label}
                  assemblyType={assemblyType}
                  hasServiceWall={hasServiceWall && hasServiceInfo}
                  outerStudDepth={outerStud || '2x4'}
                  innerStudDepth={innerStud || '2x4'}
                  gapInches={dsGapInches}
                  serviceStudDepth={getStudDepth(serviceCavityType)}
                  serviceSpacingInches={getStudSpacingNum(serviceSpacing)}
                  serviceCavityLabel={serviceCavityType}
                  interiorLayerLabel={intLayerLabelText}
                  interiorLayerThicknessInches={intLayerVisualThick}
                />
              </div>
            )
          })()}

          {/* Steel single wall diagram (unchanged) */}
          {wallType === 'steel' && studSpacing && cavityType && (
            <div className="wall-section-container">
              <WallSection
                wallType="steel"
                studDepth={getStudDepth(cavityType)}
                studSpacing={getStudSpacingNum(studSpacing)}
                continuousIns={getContInsThicknessNum(contInsThickness)}
                cavityInsLabel={cavityType}
                continuousInsLabel={contInsType && contInsThickness !== 'None' ? `${contInsThickness} ${contInsType}` : null}
                claddingLabel={boundaryOpts.cladding.options.find(o => o.id === (selection?.claddingId || boundaryOpts.cladding.defaults.steel))?.label}
              />
            </div>
          )}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Verify all SVG modes with dev server**

Run: `npm run dev`

Test:
1. Wood → Single Wall → 2x6 R20 → verify single wall SVG (unchanged)
2. Wood → Single Wall → 2x10 (deep cavity) → verify deeper SVG
3. Wood → Single Wall + Service Wall → 2x6 R20 + OSB + 2x4 R12 → verify service wall SVG
4. Wood → Single Wall + Service Wall → 2x6 R20 + 2" XPS + 2x4 R14 → verify foam pattern in interior layer
5. Wood → Double Stud → configure all fields → verify double stud SVG with gap
6. Wood → Double Stud + Service Wall → verify full LEEP #4 SVG
7. Steel → single wall → verify unchanged behavior
8. Change cladding/sheathing → verify labels update

- [ ] **Step 4: Commit**

```bash
git add src/components/WallBuilder.jsx src/components/WallSection.jsx
git commit -m "feat: wire WallBuilder SVG props for all assembly modes"
```

### Task 14: Final verification and docs

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Build for production**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Update docs**

Update `docs/components.md` WallBuilder section to document:
- Service wall toggle behavior
- Interior layer dropdown
- New `calculateWallRsi()` parameters
- Updated visibility rules

Update `docs/data-layer.md` to add:
- `getInteriorLayerRsi()` to the exports table
- Service wall parameters in the `calculateWallRsi(params)` section

- [ ] **Step 4: Commit docs**

```bash
git add docs/components.md docs/data-layer.md
git commit -m "docs: update component and data layer docs for service wall feature"
```

---

## Resolved Questions

1. **Interior layer default**: Defaults to 7/16" OSB (`osb_11`) when service wall is enabled.
2. **Service wall cavity**: Must be insulated — no empty service cavity option.
