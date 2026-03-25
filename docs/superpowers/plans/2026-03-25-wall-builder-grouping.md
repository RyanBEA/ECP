# Wall Builder UI Grouping & Auto-Defaults Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Wall Builder's Build Assembly UI into visually distinct numbered field groups with auto-populated defaults, so the wall section diagram renders immediately on wall type selection.

**Architecture:** Extract a `FieldGroup` presentational component for numbered card wrappers. Restructure `WallBuilder.jsx` to compose groups in the new order (Wall Config > Service Wall > Main Wall > Interior Layer > Assumptions). Add auto-default cascades to `handleFieldChange` and toggle handlers. Move cladding/sheathing into Main Wall group; replace Boundary Layers with read-only Assumptions.

**Tech Stack:** React (Vite), vanilla CSS, Vitest for tests

**Spec:** `docs/superpowers/specs/2026-03-25-wall-builder-grouping-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/components/FieldGroup.jsx` | Numbered card wrapper (number badge, title, variant styling) |
| Modify | `src/components/WallBuilder.jsx` | Restructure groups, add auto-defaults, move cladding/sheathing |
| Modify | `src/App.css` | Add field-group styles, sub-label, assumptions; clean up old styles |
| Create | `src/components/FieldGroup.test.jsx` | Unit tests for FieldGroup rendering |
| Modify | `src/data/ecpData.test.js` | Add tests for auto-default value availability |

All paths relative to `ecp-calculator/`.

---

## Chunk 1: FieldGroup Component + CSS

### Task 1: Create FieldGroup component with tests

**Files:**
- Create: `src/components/FieldGroup.jsx`
- Create: `src/components/FieldGroup.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/FieldGroup.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FieldGroup from './FieldGroup'

describe('FieldGroup', () => {
  it('renders number badge and title', () => {
    render(<FieldGroup number={1} title="Wall Configuration">content</FieldGroup>)
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('Wall Configuration')).toBeTruthy()
  })

  it('renders children', () => {
    render(<FieldGroup number={2} title="Test"><p>child content</p></FieldGroup>)
    expect(screen.getByText('child content')).toBeTruthy()
  })

  it('applies footnote variant class', () => {
    const { container } = render(
      <FieldGroup number={3} title="Assumptions" variant="footnote">info</FieldGroup>
    )
    expect(container.querySelector('.field-group.footnote')).toBeTruthy()
  })

  it('applies default variant class', () => {
    const { container } = render(
      <FieldGroup number={1} title="Test">content</FieldGroup>
    )
    expect(container.querySelector('.field-group')).toBeTruthy()
    expect(container.querySelector('.field-group.footnote')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/FieldGroup.test.jsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write FieldGroup component**

Create `src/components/FieldGroup.jsx`:

```jsx
import React from 'react'

export default function FieldGroup({ number, title, variant = 'default', children }) {
  const className = `field-group${variant === 'footnote' ? ' footnote' : ''}`
  return (
    <div className={className}>
      <div className="field-group-head">
        <div className="field-group-num">{number}</div>
        <div className="field-group-title">{title}</div>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/FieldGroup.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/FieldGroup.jsx src/components/FieldGroup.test.jsx
git commit -m "feat: add FieldGroup numbered card component with tests"
```

### Task 2: Add CSS for field groups, sub-labels, and assumptions

**Files:**
- Modify: `src/App.css:9-30` (add CSS variable `--primary-light`)
- Modify: `src/App.css:399-453` (replace old wall-selectors-group styles, add new styles)

- [ ] **Step 1: Add `--primary-light` CSS variable**

In `src/App.css`, add to `:root` block (after line 11 `--primary-dark`):

```css
  --primary-light: #e8e0f0;
```

And to `.dark` block (after `--primary-dark`):

```css
  --primary-light: #3d2f4d;
```

- [ ] **Step 2: Add field-group card styles**

Add after the existing `.wall-selector select:focus` block (after line 453):

```css
/* Field Group Cards */
.field-group {
  border: 2px solid var(--gray-200);
  border-radius: 10px;
  padding: 0.75rem 0.85rem;
  margin-bottom: 0.75rem;
  background: rgba(79, 61, 99, 0.02);
  border-color: var(--primary-light);
}

.field-group-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.field-group-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.field-group-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--gray-700);
}

/* Footnote variant (Assumptions) */
.field-group.footnote {
  border: 1px dashed var(--gray-300);
  background: transparent;
  padding: 0.5rem 0.75rem;
}

.field-group.footnote .field-group-num {
  background: var(--gray-400);
  width: 16px;
  height: 16px;
  font-size: 0.55rem;
}

.field-group.footnote .field-group-title {
  font-size: 0.65rem;
  color: var(--gray-500);
}

/* Sub-labels within Main Wall group */
.sub-label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--gray-400);
  margin-bottom: 0.3rem;
  margin-top: 0.5rem;
}

.sub-label:first-child {
  margin-top: 0;
}

/* Assumptions read-only items */
.assumptions-list {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.assumption-item {
  font-size: 0.7rem;
  color: var(--gray-500);
}

.assumption-label {
  font-weight: 600;
  color: var(--gray-600);
}
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Open browser, go to Build Assembly. The old styles still apply (haven't changed JSX yet). Just verify the dev server starts without CSS errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "style: add field-group card, sub-label, and assumptions CSS"
```

---

## Chunk 2: Auto-Default Logic

### Task 3: Add auto-default constants and cascade logic to WallBuilder

This is the core behavioral change. When wall type, assembly type, or service wall is toggled, downstream fields auto-fill.

**Files:**
- Modify: `src/components/WallBuilder.jsx:88-132` (handleFieldChange, toggle handlers)

- [ ] **Step 1: Add default constants**

At the top of `WallBuilder.jsx`, after the `blownInMaterials` constant (line 65), add:

```js
// Auto-defaults: populate when wall type / assembly / toggles change
// ICF has no auto-defaults beyond wallType; EPS form thickness is selected manually
const DEFAULTS = {
  singleStud: {
    studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
  },
  doubleStud: {
    studSpacing: '16"', outerStud: '2x4', innerStud: '2x4',
    plate: '2x10', doubleStudMaterial: 'Loose Fill Cellulose',
  },
  serviceWall: {
    serviceSpacing: '16"', serviceCavityMaterial: 'Fiberglass Batt', serviceCavityType: '2x4 R12',
  },
  interiorLayer: {
    interiorLayerMaterial: 'osb_11',
  },
  // Exterior defaults are wall-type-aware (from boundary-options.json)
  exterior: (wallType) => ({
    claddingId: boundaryOpts.cladding.defaults[wallType],
    ...(boundaryOpts.sheathing.applies_to.includes(wallType)
      ? { sheathingId: boundaryOpts.sheathing.default }
      : {}),
  }),
}
```

- [ ] **Step 2: Rewrite wallType handler to auto-fill**

Replace the `handleFieldChange` wallType branch (lines 94-98) with:

```js
    if (field === 'wallType') {
      if (!value) {
        onSelect({})
        return
      }
      // Wood defaults to single stud with full framing + exterior defaults
      if (value === 'wood') {
        onSelect({
          wallType: value,
          assemblyType: 'single',
          ...DEFAULTS.singleStud,
          ...DEFAULTS.exterior(value),
        })
        return
      }
      // Steel defaults to single stud framing + exterior defaults
      if (value === 'steel') {
        onSelect({
          wallType: value,
          ...DEFAULTS.singleStud,
          ...DEFAULTS.exterior(value),
        })
        return
      }
      // ICF — no auto-defaults; EPS form thickness selected manually
      onSelect({ wallType: value })
      return
    }
```

- [ ] **Step 3: Rewrite assembly type handler**

Replace the inline `onClick` for assembly type buttons (line 241):

```jsx
onClick={() => onSelect({ wallType, assemblyType: at.id })}
```

with:

```jsx
onClick={() => {
  const base = { wallType, assemblyType: at.id }
  if (at.id === 'single') {
    onSelect({ ...base, ...DEFAULTS.singleStud, ...DEFAULTS.exterior('wood') })
  } else {
    onSelect({ ...base, ...DEFAULTS.doubleStud, ...DEFAULTS.exterior('wood') })
  }
}}
```

- [ ] **Step 4: Rewrite service wall toggle handler**

Replace the service wall toggle `onChange` handler (lines 259-278) with:

```jsx
onChange={e => {
  if (e.target.checked) {
    onSelect({
      ...selection,
      hasServiceWall: true,
      ...DEFAULTS.serviceWall,
      ...DEFAULTS.interiorLayer,
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
```

- [ ] **Step 5: Verify auto-defaults work**

Run: `npm run dev`
Open browser. Select "Wood Frame" — should auto-fill 16" o.c., Fiberglass Batt, 2x6 R20. RSI should calculate immediately. Toggle to Double Stud — should auto-fill 2x4/2x4/2x10/Loose Fill Cellulose. Toggle service wall on — should auto-fill 16"/FG Batt/2x4 R12 + 7/16" OSB interior layer. Diagram should render in all cases.

- [ ] **Step 6: Commit**

```bash
git add src/components/WallBuilder.jsx
git commit -m "feat: auto-populate default values on wall type and toggle changes"
```

---

## Chunk 3: Restructure JSX Groups

### Task 4: Restructure WallBuilder JSX into FieldGroup cards

This is the main refactor — reorganize all the dropdowns into the new group structure. This task replaces the entire builder mode JSX (lines 204-728).

**Files:**
- Modify: `src/components/WallBuilder.jsx:1-733` (imports, full builder JSX)

- [ ] **Step 1: Add FieldGroup import**

At line 19 (after `import OptionButton`), add:

```js
import FieldGroup from './FieldGroup'
```

- [ ] **Step 2: Add group number counter logic**

Inside the component, after the `availablePlates` computation (line 150), add:

```js
  // Dynamic group numbering — no gaps
  let groupNum = 0
  const nextGroup = () => ++groupNum
```

- [ ] **Step 3: Replace builder mode JSX**

Replace the entire builder mode section (lines 204-728, from the `<>` after `mode === 'simple'` ternary through the closing `</>`) with the restructured version. The new structure is:

**Group 1: Wall Configuration** — wall type dropdown + assembly type pills (wood only) + service wall toggle (wood only), all inside one `<FieldGroup>`.

**Group 2: Service Wall** (conditional) — `{hasServiceWall && <FieldGroup>...</FieldGroup>}` with the 3 service wall dropdowns.

**Group 3: Main Wall** — adapts based on single/double stud and wall type:
- Sub-label "Framing" + framing dropdowns
- Sub-label "Continuous Insulation" (single stud, no service wall only) + type/thickness dropdowns
- Sub-label "Exterior" + exterior sheathing (wood only) + cladding
- For ICF: just the EPS form thickness dropdown
- For double stud: the 5 double-stud dropdowns under "Framing"

**Group 4: Interior Layer** (conditional) — `{hasServiceWall && <FieldGroup>...</FieldGroup>}` with material + thickness.

**Group 5: Assumptions** — `<FieldGroup variant="footnote">` with read-only text showing drywall and air film values from `boundaryOpts`.

The complete JSX structure (abbreviated for key structural changes):

```jsx
<>
  <p className="category-description">
    Build your wall assembly to calculate effective RSI and points
  </p>

  {/* Group 1: Wall Configuration */}
  <FieldGroup number={nextGroup()} title="Wall Configuration">
    <div className="wall-selectors" style={{ marginBottom: wallType === 'wood' ? '0.5rem' : 0 }}>
      <div className="wall-selector">
        <label htmlFor="wallType">Wall Type</label>
        <select ...>...</select>
      </div>
    </div>
    {/* Assembly type pills — wood only */}
    {wallType === 'wood' && (
      <>
        <div className="option-group" style={{ marginBottom: '0.5rem' }}>
          {[single, doubleStud].map(at => <button .../>)}
        </div>
        <label className="service-wall-toggle">
          <input type="checkbox" ... /> Interior Service Wall
        </label>
      </>
    )}
  </FieldGroup>

  {/* Group 2: Service Wall (conditional) */}
  {hasServiceWall && (
    <FieldGroup number={nextGroup()} title="Service Wall">
      <div className="wall-selectors">
        {/* serviceSpacing, serviceCavityMaterial, serviceCavityType dropdowns */}
      </div>
    </FieldGroup>
  )}

  {/* Group 3: Main Wall */}
  {wallType && (
    <FieldGroup number={nextGroup()} title={isDoubleStud ? 'Main Wall — Double Stud' : 'Main Wall'}>
      {isFramedWall && (
        <>
          <div className="sub-label">Framing</div>
          <div className="wall-selectors">
            {/* Single stud: studSpacing, cavityMaterial, cavityType */}
            {/* Double stud: studSpacing, outerStud, innerStud, plate, doubleStudMaterial */}
          </div>
        </>
      )}

      {/* Continuous insulation — single stud, no service wall only */}
      {isFramedWall && isSingleWall && !hasServiceWall && (
        <>
          <div className="sub-label">Continuous Insulation</div>
          <div className="wall-selectors">
            {/* contInsType, contInsThickness */}
          </div>
        </>
      )}

      {/* Exterior — framed walls */}
      {isFramedWall && (
        <>
          <div className="sub-label">Exterior</div>
          <div className="wall-selectors">
            {boundaryOpts.sheathing.applies_to.includes(wallType) && (
              <div className="wall-selector">
                <label htmlFor="sheathingId">Exterior Sheathing</label>
                <select ...>...</select>
              </div>
            )}
            <div className="wall-selector">
              <label htmlFor="claddingId">Cladding</label>
              <select ...>...</select>
            </div>
          </div>
        </>
      )}

      {/* ICF — just EPS form thickness */}
      {isIcf && (
        <div className="wall-selectors">
          <div className="wall-selector">
            <label htmlFor="icfFormThickness">EPS Form Thickness (per side)</label>
            <select ...>...</select>
          </div>
        </div>
      )}
    </FieldGroup>
  )}

  {/* Group 4: Interior Layer (conditional) */}
  {hasServiceWall && (
    <FieldGroup number={nextGroup()} title="Interior Layer">
      <div className="wall-selectors">
        {/* interiorLayerMaterial, interiorLayerThickness (if rigid) */}
      </div>
    </FieldGroup>
  )}

  {/* Group 5: Assumptions */}
  {wallType && (
    <FieldGroup number={nextGroup()} title="Assumptions" variant="footnote">
      <div className="assumptions-list">
        <div className="assumption-item">
          <span className="assumption-label">Drywall: </span>1/2" gypsum
        </div>
        <div className="assumption-item">
          <span className="assumption-label">Interior air film: </span>
          {boundaryOpts.air_films.inside} RSI
        </div>
        <div className="assumption-item">
          <span className="assumption-label">Exterior air film: </span>
          {boundaryOpts.air_films.outside} RSI
        </div>
      </div>
    </FieldGroup>
  )}

  {/* Results + Diagram + Clear — unchanged */}
  <div className="wall-result">...</div>
  {/* Wall section diagrams — unchanged */}
  {/* Clear button — unchanged */}
</>
```

**Important:** The actual dropdown `<select>` elements, their `value`, `onChange`, and `<option>` children remain exactly the same as current code. Only their grouping wrapper changes. The label for the old "Sheathing" dropdown changes to "Exterior Sheathing".

- [ ] **Step 4: Verify all scenarios in browser**

Run: `npm run dev`
Test each scenario:
1. Select Wood Frame → single stud defaults auto-fill, groups 1-2-3 visible (Config, Main Wall, Assumptions), diagram renders
2. Toggle service wall on → groups 1-2-3-4-5 (Config, Service Wall, Main Wall, Interior Layer, Assumptions), all defaulted
3. Switch to Double Stud → group 3 title changes to "Main Wall — Double Stud", 5 framing fields appear, no continuous insulation
4. Select Steel Frame → groups 1-2-3 (Config, Main Wall, Assumptions), no assembly type pills, no service wall toggle, cladding but no sheathing
5. Select ICF → groups 1-2-3 (Config, Main Wall, Assumptions), just EPS form thickness in Main Wall
6. Clear button resets everything

- [ ] **Step 5: Commit**

```bash
git add src/components/WallBuilder.jsx
git commit -m "refactor: restructure wall builder into numbered FieldGroup cards

Groups: Wall Configuration > Service Wall > Main Wall > Interior Layer > Assumptions.
Cladding and exterior sheathing moved into Main Wall group.
Boundary Layers replaced with read-only Assumptions section.
Dynamic group numbering with no gaps for conditional groups."
```

---

## Chunk 4: CSS Cleanup + Documentation

### Task 5: Remove deprecated CSS and update docs

**Files:**
- Modify: `src/App.css:399-411` (remove old `.wall-selectors-group` / `.wall-selectors-group-label` if unused)
- Modify: `docs/components.md` (document FieldGroup component)
- Modify: `docs/architecture.md` (update Wall Builder section if it exists)

- [ ] **Step 1: Check if old classes are still used**

Search for `wall-selectors-group` in all `.jsx` files. If no references remain, remove the CSS rules at lines 399-411 (`.wall-selectors-group` and `.wall-selectors-group-label`). Also remove `.wall-builder-disclaimer` (lines 388-397) if no longer referenced.

Keep `.wall-selectors`, `.wall-selector`, `.option-group`, and all other styles that are still used inside the new FieldGroup children.

- [ ] **Step 2: Update component docs**

Add FieldGroup to `docs/components.md`:

```markdown
### FieldGroup

**File:** `src/components/FieldGroup.jsx`

Presentational wrapper that renders a numbered card with a header badge and title. Used by WallBuilder to visually group related fields.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `number` | `number` | required | Group sequence number (displayed in badge) |
| `title` | `string` | required | Group heading text |
| `variant` | `'default' \| 'footnote'` | `'default'` | Visual variant — footnote uses dashed border, smaller text |
| `children` | `ReactNode` | required | Group content (dropdowns, toggles, text) |
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All existing tests pass. No regressions in ecpData or compute tests.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: clean up deprecated CSS, update component docs for FieldGroup"
```
