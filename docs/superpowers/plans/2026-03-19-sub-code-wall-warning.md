# Sub-Code Wall Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a warning in the Wall Builder when a configured wall assembly falls below the NBC minimum RSI of 2.97.

**Architecture:** Add a `MIN_WALL_RSI` constant to the data layer. WallBuilder conditionally renders a warning state when `rsi < MIN_WALL_RSI`. CSS provides the danger color.

**Tech Stack:** React, Vitest, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-19-sub-code-wall-warning-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/data/ecpData.js` | Modify | Add `MIN_WALL_RSI` constant |
| `src/data/ecpData.test.js` | Modify | Add test for `MIN_WALL_RSI` export |
| `src/components/WallBuilder.jsx` | Modify | Conditional warning rendering |
| `src/App.css` | Modify | `--danger` variable and warning styles |

---

### Task 1: Add MIN_WALL_RSI constant and test

**Files:**
- Modify: `src/data/ecpData.js` (after `icfRsi` block, ~line 185)
- Modify: `src/data/ecpData.test.js`

- [ ] **Step 1: Write the test**

Add to `src/data/ecpData.test.js`:

```js
import { calculateWallRsi, getWallPoints, MIN_WALL_RSI } from './ecpData'

describe('MIN_WALL_RSI', () => {
  it('is 2.97', () => {
    expect(MIN_WALL_RSI).toBe(2.97)
  })

  it('boundary: wood/24"/Loose Fill Cellulose/2x6 equals exactly MIN_WALL_RSI', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '24"',
      cavityMaterial: 'Loose Fill Cellulose',
      cavityType: '2x6'
    })
    expect(rsi).toBe(MIN_WALL_RSI)
  })
})
```

Also update the existing import line at top of file to include `MIN_WALL_RSI`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ecp-calculator && npm test -- --run`
Expected: FAIL — `MIN_WALL_RSI` is not exported from ecpData

- [ ] **Step 3: Add the constant**

In `src/data/ecpData.js`, after the `icfRsi` block (~line 185), add:

```js
// NBC 2020 Table 9.36.2.6.-B minimum wall RSI (with HRV, Zone 5/6)
export const MIN_WALL_RSI = 2.97
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ecp-calculator && npm test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd ecp-calculator
git add src/data/ecpData.js src/data/ecpData.test.js
git commit -m "Add MIN_WALL_RSI constant (2.97) from NBC Table 9.36.2.6.-B"
```

---

### Task 2: Add CSS danger variable and warning styles

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add `--danger` to `:root`**

In `src/App.css`, inside the `:root` block (~line 9-29), after the `--success-light` line, add:

```css
  --danger: #dc2626;
```

- [ ] **Step 2: Add `--danger` to `.dark`**

In the `.dark` block (~line 31-50), after the `--success-light` line, add:

```css
  --danger: #f87171;
```

- [ ] **Step 3: Add warning styles**

After the `.wall-points.has-points .value` rule (~line 472), add:

```css
.wall-rsi.below-code .value {
  color: var(--danger);
}

.wall-warning {
  width: 100%;
  color: var(--danger);
  font-size: 0.8rem;
  font-weight: 500;
}
```

- [ ] **Step 4: Verify build succeeds**

Run: `cd ecp-calculator && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
cd ecp-calculator
git add src/App.css
git commit -m "Add --danger CSS variable and wall warning styles"
```

---

### Task 3: Add conditional warning rendering to WallBuilder

**Files:**
- Modify: `src/components/WallBuilder.jsx`

- [ ] **Step 1: Add import**

Update the import block at the top of `WallBuilder.jsx` (line 2-13) to include `MIN_WALL_RSI`:

```js
import {
  categories,
  wallTypes,
  studSpacingOptions,
  cavityMaterials,
  cavityTypesByMaterial,
  continuousInsTypes,
  continuousInsThicknesses,
  icfFormOptions,
  framedWallRsi,
  calculateWallRsi,
  getWallPoints,
  MIN_WALL_RSI
} from '../data/ecpData'
```

- [ ] **Step 2: Add belowCode flag**

After the `builderPoints` calculation (line 64), add:

```js
const belowCode = rsi !== null && rsi < MIN_WALL_RSI
```

- [ ] **Step 3: Replace result area conditional**

Replace the result area block (lines 288-315, including the `{/* Results */}` comment) with:

```jsx
{/* Results */}
<div className="wall-result">
  {rsi ? (
    <>
      <div className={`wall-rsi ${belowCode ? 'below-code' : ''}`}>
        <span className="label">Effective RSI:</span>
        <span className="value">{rsi.toFixed(2)}</span>
      </div>
      {belowCode ? (
        <>
          <div className="wall-rsi">
            <span className="label">Min. RSI:</span>
            <span className="value">{MIN_WALL_RSI}</span>
          </div>
          <div className="wall-warning">
            ⚠ Does not meet code — {(MIN_WALL_RSI - rsi).toFixed(2)} below minimum
          </div>
        </>
      ) : (
        <div className={`wall-points ${builderPoints > 0 ? 'has-points' : ''}`}>
          <span className="label">Points:</span>
          <span className="value">+{builderPoints}</span>
        </div>
      )}
    </>
  ) : wallType ? (
    <div className="wall-prompt">
      {rsi === null && wallType && (isFramedWall
        ? (studSpacing && cavityMaterial && cavityType
          ? 'No data for this combination'
          : 'Select framing options to calculate RSI')
        : 'Select form thickness to calculate RSI'
      )}
    </div>
  ) : (
    <div className="wall-prompt">
      Select a wall type to begin
    </div>
  )}
</div>
```

- [ ] **Step 4: Run tests**

Run: `cd ecp-calculator && npm test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Manual verification**

Run: `cd ecp-calculator && npm run dev`

Test these cases in the browser:
1. **Below code**: Wood Frame → 16" → Fiberglass Batt → 2x4 R12 → no continuous insulation. Should show RSI 1.94 in red, "Min. RSI: 2.97", and "⚠ Does not meet code — 1.03 below minimum"
2. **Boundary (meets code)**: Wood Frame → 24" → Loose Fill Cellulose → 2x6 → no continuous insulation. Should show RSI 2.97 in normal color, "Points: +0" in gray. No warning.
3. **Meets code with points**: Wood Frame → 16" → Fiberglass Batt → 2x6 R20 → 1" XPS. Should show RSI 3.46 in normal color, "Points: +1.6" in green. No warning.
4. **Dark mode**: Toggle dark mode and verify warning colors look correct in all states.

- [ ] **Step 6: Commit**

```bash
cd ecp-calculator
git add src/components/WallBuilder.jsx
git commit -m "Show warning when wall assembly RSI is below code minimum (2.97)"
```

---

### Task 4: Update docs

**Files:**
- Modify: `docs/components.md`
- Modify: `docs/data-layer.md`

- [ ] **Step 1: Update data-layer.md**

Add `MIN_WALL_RSI` to the documented exports in `docs/data-layer.md`.

- [ ] **Step 2: Update components.md**

Document the new `belowCode` conditional behavior in the WallBuilder section of `docs/components.md`.

- [ ] **Step 3: Commit**

```bash
cd ecp-calculator
git add docs/
git commit -m "Document MIN_WALL_RSI and sub-code wall warning behavior"
```
