# Wall Builder Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add steel frame and ICF wall types, split cavity/continuous insulation into separate material+type/thickness fields, and move all RSI calculations to pre-computed lookup tables.

**Architecture:** Layered lookup approach — parallel path RSI pre-computed in a lookup table keyed by wallType/spacing/material/type, continuous insulation RSI in a separate type/thickness table, summed at runtime (isothermal planes). ICF uses a single form-thickness lookup. Progressive disclosure UI reveals only relevant fields per wall type. Three distinct SVG renderings.

**Tech Stack:** React 18, Vite 5, Vitest (new), plain CSS, Playwright MCP (visual verification)

**Design doc:** `ecp-calculator/docs/plans/2026-02-19-wall-builder-updates-design.md`

---

### Task 1: Add Vitest

No test framework exists. Add Vitest so we can TDD the data layer.

**Files:**
- Modify: `ecp-calculator/package.json`
- Modify: `ecp-calculator/vite.config.js`

**Step 1: Install vitest**

Run: `cd ecp-calculator && npm install -D vitest`

**Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Verify vitest runs**

Run: `cd ecp-calculator && npm test`
Expected: "No test files found" (not an error — confirms vitest is configured)

**Step 4: Commit**

```bash
git add ecp-calculator/package.json ecp-calculator/package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

### Task 2: Refactor data layer — new exports and lookup structure

Replace the current calculated approach with lookup tables. Seed the wood/fiberglass batt lookup values by running the existing `calculateWallRsi()` formula for all 15 combinations (3 spacings x 5 cavity types). All other combinations get placeholder value `null` (Ryan provides real data later).

**Files:**
- Modify: `ecp-calculator/src/data/ecpData.js`

**Step 1: Add new option arrays**

Add these new exports at the top of `ecpData.js`, before the existing `studSpacingOptions`:

```js
// Wall type options
export const wallTypes = [
  { id: 'wood', label: 'Wood Frame' },
  { id: 'steel', label: 'Steel Frame' },
  { id: 'icf', label: 'ICF' }
]

// Cavity insulation materials
export const cavityMaterials = [
  'Fiberglass Batt',
  'Mineral Wool Batt',
  'Loose Fill Cellulose',
  'Dense Pack Cellulose',
  'Loose Fill Fiberglass'
]

// Cavity insulation types (stud size + nominal R-value)
export const cavityTypes = [
  '2x4 R12', '2x4 R14', '2x6 R20', '2x6 R22', '2x6 R24'
]

// Continuous insulation types
export const continuousInsTypes = ['EPS', 'XPS', 'PIC', 'Mineral Wool']

// Continuous insulation thicknesses
export const continuousInsThicknesses = [
  'None', '1"', '1-1/2"', '2"', '2-1/2"', '3"'
]

// ICF form thickness options (per side)
export const icfFormOptions = ['2.5"', '3-1/8"', '4-1/4"']
```

**Step 2: Add lookup tables**

Add these lookup tables after the new option arrays. Use the existing `calculateWallRsi()` to pre-compute wood/fiberglass values. The existing cavity RSI data maps to fiberglass batt:

```js
// Parallel path pre-computed RSI lookup
// wallType -> spacing -> cavityMaterial -> cavityType -> RSI
// Values for wood + Fiberglass Batt computed from existing parallel path formula.
// All other combinations are null (pending data from Ryan).
export const framedWallRsi = {
  wood: {
    '16"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.56, '2x4 R14': 1.75, '2x6 R20': 2.36,
        '2x6 R22': 2.63, '2x6 R24': 2.81
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '19"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.59, '2x4 R14': 1.79, '2x6 R20': 2.42,
        '2x6 R22': 2.70, '2x6 R24': 2.89
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '24"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.64, '2x4 R14': 1.85, '2x6 R20': 2.51,
        '2x6 R22': 2.81, '2x6 R24': 3.01
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    }
  },
  steel: {
    '16"': {
      'Fiberglass Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '19"': {
      'Fiberglass Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '24"': {
      'Fiberglass Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    }
  }
}

// Continuous insulation RSI lookup: type -> thickness -> RSI
export const continuousInsRsi = {
  'EPS': {
    'None': 0, '1"': 0.65, '1-1/2"': 0.98, '2"': 1.30, '2-1/2"': 1.63, '3"': 1.95
  },
  'XPS': {
    'None': 0, '1"': 0.88, '1-1/2"': 1.28, '2"': 1.68, '2-1/2"': 2.10, '3"': 2.52
  },
  'PIC': {
    'None': 0, '1"': 0.97, '1-1/2"': 1.39, '2"': 1.80, '2-1/2"': 2.22, '3"': 2.64
  },
  'Mineral Wool': {
    'None': 0, '1"': null, '1-1/2"': null, '2"': null, '2-1/2"': null, '3"': null
  }
}

// ICF total RSI lookup: formThickness -> total RSI (fully pre-computed)
export const icfRsi = {
  '2.5"': null,
  '3-1/8"': null,
  '4-1/4"': null
}
```

**Note on pre-computed wood values:** The values above (e.g., wood/16"/Fiberglass Batt/2x6 R20 = 2.36) are the **parallel path component only** (the result of the `1 / (fraction/framingRSI + (1-fraction)/cavityRSI)` calculation). They do NOT include BASE_RSI or continuous insulation — those are added at runtime (isothermal planes). Verify by running the existing formula:
- 16" spacing (fraction=0.23), 2x6 R20 (cavity=3.34, framing=1.18745):
- `1 / (0.23/1.18745 + 0.77/3.34) = 1 / (0.1937 + 0.2305) = 2.357` → rounds to 2.36

**Step 3: Rewrite `calculateWallRsi()`**

Replace the existing function with a lookup-based version:

```js
// Base RSI constant (interior + exterior air films, drywall, sheathing)
const BASE_RSI = 0.44547

// Calculate wall RSI from selections (lookup-based)
export function calculateWallRsi({ wallType, studSpacing, cavityMaterial, cavityType, contInsType, contInsThickness, icfFormThickness }) {
  // ICF path — single lookup, fully pre-computed
  if (wallType === 'icf') {
    return icfRsi[icfFormThickness] ?? null
  }

  // Wood/Steel path — parallel path lookup + isothermal planes sum
  const framed = framedWallRsi[wallType]?.[studSpacing]?.[cavityMaterial]?.[cavityType]
  if (framed == null) return null

  // If no continuous insulation selected, just framed + base
  if (!contInsType || contInsThickness === 'None') {
    return framed + BASE_RSI
  }

  const contIns = continuousInsRsi[contInsType]?.[contInsThickness]
  if (contIns == null) return null

  return framed + contIns + BASE_RSI
}
```

**Step 4: Remove old exports that are no longer needed**

Remove (or comment out) these old exports:
- `studSpacingOptions` — framing fractions no longer used (pre-computed). **Keep the array but remove the `fraction` field** since the UI still needs the labels.
- `cavityInsulationOptions` — replaced by `cavityMaterials` + `cavityTypes`
- `continuousInsulationOptions` — replaced by `continuousInsTypes` + `continuousInsThicknesses`

Replace `studSpacingOptions` with:
```js
export const studSpacingOptions = [
  { label: '16"' },
  { label: '19"' },
  { label: '24"' }
]
```

**Step 5: Commit**

```bash
git add ecp-calculator/src/data/ecpData.js
git commit -m "refactor: replace wall RSI calculation with lookup tables

Parallel path results pre-computed in framedWallRsi lookup.
Continuous insulation RSI in separate type/thickness lookup.
ICF uses single form-thickness lookup.
Runtime does isothermal planes sum only.
Wood/Fiberglass Batt values seeded from existing formula.
All other combinations null pending data from Ryan."
```

---

### Task 3: Test the new data layer

Write tests for `calculateWallRsi()` and `getWallPoints()` against the lookup tables.

**Files:**
- Create: `ecp-calculator/src/data/ecpData.test.js`

**Step 1: Write tests**

```js
import { describe, it, expect } from 'vitest'
import { calculateWallRsi, getWallPoints } from './ecpData'

describe('calculateWallRsi', () => {
  it('returns correct RSI for wood / 16" / Fiberglass Batt / 2x6 R20 / no cont ins', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: null,
      contInsThickness: 'None'
    })
    // framedWallRsi (2.36) + BASE_RSI (0.44547) = 2.805
    expect(rsi).toBeCloseTo(2.81, 1)
  })

  it('returns correct RSI for wood / 16" / Fiberglass Batt / 2x6 R20 / 2" XPS', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'XPS',
      contInsThickness: '2"'
    })
    // framedWallRsi (2.36) + contIns (1.68) + BASE_RSI (0.44547) = 4.485
    expect(rsi).toBeCloseTo(4.49, 1)
  })

  it('returns null for missing lookup combo (steel placeholder)', () => {
    const rsi = calculateWallRsi({
      wallType: 'steel',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'XPS',
      contInsThickness: '2"'
    })
    expect(rsi).toBeNull()
  })

  it('returns null for ICF placeholder', () => {
    const rsi = calculateWallRsi({
      wallType: 'icf',
      icfFormThickness: '3-1/8"'
    })
    expect(rsi).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    expect(calculateWallRsi({})).toBeNull()
    expect(calculateWallRsi({ wallType: 'wood' })).toBeNull()
  })

  it('returns correct RSI for wood / 24" / Fiberglass Batt / 2x6 R24 / 3" PIC', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '24"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R24',
      contInsType: 'PIC',
      contInsThickness: '3"'
    })
    // framedWallRsi (3.01) + contIns (2.64) + BASE_RSI (0.44547) = 6.095
    expect(rsi).toBeCloseTo(6.10, 1)
  })

  it('handles cont ins type selected but thickness None', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'XPS',
      contInsThickness: 'None'
    })
    // No continuous insulation added
    expect(rsi).toBeCloseTo(2.81, 1)
  })

  it('returns null for null continuous insulation RSI (Mineral Wool placeholder)', () => {
    const rsi = calculateWallRsi({
      wallType: 'wood',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: 'Mineral Wool',
      contInsThickness: '2"'
    })
    expect(rsi).toBeNull()
  })
})

describe('getWallPoints', () => {
  it('returns 0 for RSI below minimum threshold', () => {
    expect(getWallPoints(2.5)).toBe(0)
  })

  it('returns 1.6 for RSI exactly at 3.08', () => {
    expect(getWallPoints(3.08)).toBe(1.6)
  })

  it('returns 9.9 for RSI of 4.48 (between 4.40 and 4.57)', () => {
    expect(getWallPoints(4.48)).toBe(9.9)
  })

  it('returns 13.6 for RSI above highest threshold', () => {
    expect(getWallPoints(6.0)).toBe(13.6)
  })

  it('returns 0 for null/undefined', () => {
    expect(getWallPoints(null)).toBe(0)
    expect(getWallPoints(undefined)).toBe(0)
  })
})
```

**Step 2: Run tests**

Run: `cd ecp-calculator && npm test`
Expected: All tests pass. If framed wall RSI values need adjustment (rounding), fix the lookup table values to match.

**Step 3: Commit**

```bash
git add ecp-calculator/src/data/ecpData.test.js
git commit -m "test: add unit tests for wall RSI lookup and points calculation"
```

---

### Task 4: Update WallBuilder — wall type selector and progressive disclosure

Add the wall type dropdown, make fields appear/disappear based on selection, wire up the new cavity and continuous insulation split fields.

**Files:**
- Modify: `ecp-calculator/src/components/WallBuilder.jsx`

**Step 1: Update imports**

Replace existing imports from ecpData with:
```js
import {
  categories,
  wallTypes,
  studSpacingOptions,
  cavityMaterials,
  cavityTypes,
  continuousInsTypes,
  continuousInsThicknesses,
  icfFormOptions,
  framedWallRsi,
  calculateWallRsi,
  getWallPoints
} from '../data/ecpData'
```

**Step 2: Update helper functions**

Replace `getStudDepth`, `getStudSpacingNum`, `getContinuousInsThickness` with versions that work with the new field names:

```js
// Extract stud depth from cavity type label (e.g., "2x6 R20" -> "2x6")
const getStudDepth = (cavityType) => {
  if (!cavityType) return '2x6'
  return cavityType.startsWith('2x4') ? '2x4' : '2x6'
}

// Extract stud spacing as number (e.g., '16"' -> 16)
const getStudSpacingNum = (studSpacing) => {
  if (!studSpacing) return 16
  return parseInt(studSpacing.replace('"', ''), 10)
}

// Get continuous insulation thickness in inches from thickness label
const getContInsThicknessNum = (thickness) => {
  if (!thickness || thickness === 'None') return 0
  // Handle fractions: '1-1/2"' -> 1.5, '2-1/2"' -> 2.5
  const cleaned = thickness.replace('"', '')
  if (cleaned.includes('-')) {
    const [whole, frac] = cleaned.split('-')
    const [num, den] = frac.split('/')
    return parseInt(whole) + parseInt(num) / parseInt(den)
  }
  return parseFloat(cleaned)
}

// Get available cavity types for current selection (filters by lookup table)
const getAvailableCavityTypes = (wallType, studSpacing, cavityMaterial) => {
  if (!wallType || wallType === 'icf' || !studSpacing || !cavityMaterial) return cavityTypes
  const lookup = framedWallRsi[wallType]?.[studSpacing]?.[cavityMaterial]
  if (!lookup) return []
  return cavityTypes.filter(ct => lookup[ct] != null)
}
```

**Step 3: Rewrite the component body**

Replace the entire `WallBuilder` function body with the progressive disclosure version. Key changes:
- Destructure new fields from `selection`: `wallType`, `cavityMaterial`, `cavityType`, `contInsType`, `contInsThickness`, `icfFormThickness`
- Call `calculateWallRsi()` with object argument
- `handleBuilderChange` sets individual fields; only `wallType` change clears downstream
- Wall type selector always visible
- Wood/Steel fields shown conditionally
- ICF field shown conditionally

```jsx
export default function WallBuilder({ selection, onSelect }) {
  const [mode, setMode] = useState('builder')

  const {
    wallType, studSpacing, cavityMaterial, cavityType,
    contInsType, contInsThickness, icfFormThickness, simpleIndex
  } = selection || {}

  const rsi = calculateWallRsi(selection || {})
  const builderPoints = getWallPoints(rsi)

  const simplePoints = simpleIndex !== undefined && simpleIndex !== null
    ? wallCategory.options[simpleIndex].points
    : 0

  const handleModeChange = (newMode) => {
    setMode(newMode)
    onSelect({})
  }

  const handleFieldChange = (field, value) => {
    if (field === 'wallType') {
      // Wall type change clears everything
      onSelect({ wallType: value || undefined })
      return
    }
    onSelect({
      ...selection,
      simpleIndex: undefined,
      [field]: value || undefined
    })
  }

  const handleSimpleSelect = (index) => {
    onSelect({ simpleIndex: index })
  }

  const isFramedWall = wallType === 'wood' || wallType === 'steel'
  const isIcf = wallType === 'icf'
  const availableCavityTypes = getAvailableCavityTypes(wallType, studSpacing, cavityMaterial)

  return (
    <div className="category-card wall-builder">
      <div className="category-header">
        <h2 className="category-name">Above Ground Walls</h2>
        <span className="category-metric">RSI (m²·K/W)</span>
      </div>

      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === 'simple' ? 'active' : ''}`}
          onClick={() => handleModeChange('simple')}
        >
          Select RSI
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'builder' ? 'active' : ''}`}
          onClick={() => handleModeChange('builder')}
        >
          Build Assembly
        </button>
      </div>

      {mode === 'simple' ? (
        <>
          <p className="category-description">
            Select target RSI value for above-grade walls
          </p>
          <div className="options-grid">
            {wallCategory.options.map((option, index) => (
              <OptionButton
                key={index}
                option={option}
                direction="higher"
                metric="RSI"
                isSelected={simpleIndex === index}
                onClick={() => handleSimpleSelect(index)}
              />
            ))}
            {simpleIndex !== undefined && simpleIndex !== null && (
              <button
                className="option-button clear-button"
                onClick={() => onSelect({})}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="category-description">
            Build your wall assembly to calculate effective RSI and points
          </p>

          {/* Wall Type Selector — always visible */}
          <div className="wall-selectors">
            <div className="wall-selector">
              <label htmlFor="wallType">Wall Type</label>
              <select
                id="wallType"
                value={wallType || ''}
                onChange={e => handleFieldChange('wallType', e.target.value)}
              >
                <option value="">Select...</option>
                {wallTypes.map(wt => (
                  <option key={wt.id} value={wt.id}>{wt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Wood/Steel framing fields */}
          {isFramedWall && (
            <>
              <p className="wall-builder-disclaimer">
                Assumes 1/2" drywall, 7/16" OSB sheathing, and vinyl cladding.
              </p>

              <div className="wall-selectors-group">
                <label className="wall-selectors-group-label">Framing</label>
                <div className="wall-selectors">
                  <div className="wall-selector">
                    <label htmlFor="studSpacing">Stud Spacing</label>
                    <select
                      id="studSpacing"
                      value={studSpacing || ''}
                      onChange={e => handleFieldChange('studSpacing', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {studSpacingOptions.map(opt => (
                        <option key={opt.label} value={opt.label}>{opt.label} o.c.</option>
                      ))}
                    </select>
                  </div>

                  <div className="wall-selector">
                    <label htmlFor="cavityMaterial">Cavity Insulation</label>
                    <select
                      id="cavityMaterial"
                      value={cavityMaterial || ''}
                      onChange={e => handleFieldChange('cavityMaterial', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {cavityMaterials.map(mat => (
                        <option key={mat} value={mat}>{mat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="wall-selector">
                    <label htmlFor="cavityType">Cavity Size</label>
                    <select
                      id="cavityType"
                      value={cavityType || ''}
                      onChange={e => handleFieldChange('cavityType', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {availableCavityTypes.map(ct => (
                        <option key={ct} value={ct}>{ct}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="wall-selectors-group">
                <label className="wall-selectors-group-label">Continuous Insulation</label>
                <div className="wall-selectors">
                  <div className="wall-selector">
                    <label htmlFor="contInsType">Type</label>
                    <select
                      id="contInsType"
                      value={contInsType || ''}
                      onChange={e => handleFieldChange('contInsType', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {continuousInsTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="wall-selector">
                    <label htmlFor="contInsThickness">Thickness</label>
                    <select
                      id="contInsThickness"
                      value={contInsThickness || ''}
                      onChange={e => handleFieldChange('contInsThickness', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {continuousInsThicknesses.map(th => (
                        <option key={th} value={th}>{th}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ICF field */}
          {isIcf && (
            <div className="wall-selectors">
              <div className="wall-selector">
                <label htmlFor="icfFormThickness">EPS Form Thickness (per side)</label>
                <select
                  id="icfFormThickness"
                  value={icfFormThickness || ''}
                  onChange={e => handleFieldChange('icfFormThickness', e.target.value)}
                >
                  <option value="">Select...</option>
                  {icfFormOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="wall-result">
            {rsi ? (
              <>
                <div className="wall-rsi">
                  <span className="label">Effective RSI:</span>
                  <span className="value">{rsi.toFixed(2)}</span>
                </div>
                <div className={`wall-points ${builderPoints > 0 ? 'has-points' : ''}`}>
                  <span className="label">Points:</span>
                  <span className="value">+{builderPoints}</span>
                </div>
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

          {/* Wall Section Diagram — only when we have enough info */}
          {isFramedWall && studSpacing && cavityType && (
            <div className="wall-section-container">
              <WallSection
                wallType={wallType}
                studDepth={getStudDepth(cavityType)}
                studSpacing={getStudSpacingNum(studSpacing)}
                continuousIns={getContInsThicknessNum(contInsThickness)}
                cavityInsLabel={cavityType}
                continuousInsLabel={contInsType && contInsThickness !== 'None' ? `${contInsThickness} ${contInsType}` : null}
              />
            </div>
          )}

          {isIcf && icfFormThickness && (
            <div className="wall-section-container">
              <WallSection
                wallType="icf"
                icfFormThickness={getContInsThicknessNum(icfFormThickness)}
              />
            </div>
          )}

          {/* Clear button */}
          {wallType && (
            <button
              className="option-button clear-button"
              onClick={() => onSelect({})}
              type="button"
            >
              Clear
            </button>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 4: Verify the app builds**

Run: `cd ecp-calculator && npm run build`
Expected: Build succeeds (may have warnings about unused WallSection props — addressed in Task 6/7)

**Step 5: Commit**

```bash
git add ecp-calculator/src/components/WallBuilder.jsx
git commit -m "feat: add wall type selector with progressive disclosure

Wood/Steel shows framing + continuous insulation dropdowns.
ICF shows form thickness only.
Cavity insulation split into material + type.
Continuous insulation split into type + thickness."
```

---

### Task 5: Update App.jsx — wallPoints derivation

Update the `wallPoints` useMemo to pass the full selection object to the new `calculateWallRsi()`.

**Files:**
- Modify: `ecp-calculator/src/App.jsx`

**Step 1: Update wallPoints useMemo**

Replace the existing `wallPoints` useMemo block:

```js
const wallPoints = useMemo(() => {
  const { simpleIndex } = wallSelection

  // Simple mode - direct option selection
  if (simpleIndex !== undefined && simpleIndex !== null) {
    const wallCategory = categories.find(c => c.id === 'aboveGroundWalls')
    return wallCategory.options[simpleIndex].points
  }

  // Builder mode - lookup from assembly
  const rsi = calculateWallRsi(wallSelection)
  return getWallPoints(rsi)
}, [wallSelection])
```

**Step 2: Verify build**

Run: `cd ecp-calculator && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add ecp-calculator/src/App.jsx
git commit -m "refactor: update wallPoints to use new calculateWallRsi signature"
```

---

### Task 6: CSS — grouped selectors layout

Add CSS for the new `.wall-selectors-group` wrapper that groups "Framing" and "Continuous Insulation" sections.

**Files:**
- Modify: `ecp-calculator/src/App.css`

**Step 1: Add group styles**

Add after the existing `.wall-selectors` block (after line ~384):

```css
.wall-selectors-group {
  margin-bottom: 1rem;
}

.wall-selectors-group-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}
```

**Step 2: Verify dev server renders correctly**

Run: `cd ecp-calculator && npm run dev`
Open browser to localhost:5173, select "Build Assembly", pick Wood Frame. Verify two groups of dropdowns appear with "Framing" and "Continuous Insulation" labels.

**Step 3: Commit**

```bash
git add ecp-calculator/src/App.css
git commit -m "style: add wall selector group labels for framing/continuous insulation"
```

---

### Task 7: WallSection — add `wallType` prop and steel C-channel rendering

Update WallSection to accept `wallType` and render steel studs as hollow C-channels.

**Files:**
- Modify: `ecp-calculator/src/components/WallSection.jsx`

**Step 1: Add wallType prop**

Update the function signature:
```jsx
export default function WallSection({
  wallType = 'wood',           // 'wood', 'steel', or 'icf'
  studDepth = '2x6',
  studSpacing = 16,
  continuousIns = 0,
  cavityInsLabel = null,
  continuousInsLabel = null,
  icfFormThickness = 0,        // ICF only: inches per side
  width = 600,
}) {
```

**Step 2: Add steel stud color**

In the `colors` object, add:
```js
steelStud: '#94a3b8',  // Slate gray for steel
```

**Step 3: Replace the stud rendering block**

Replace the stud `{Array.from({ length: numStuds }).map(...)}` block with a version that checks `wallType`:

For `wallType === 'wood'`: keep existing solid rectangle + X pattern (current code unchanged).

For `wallType === 'steel'`: render C-channel as three thin lines forming an open U-shape:
```jsx
{wallType === 'steel' && actualW >= studW - 1 && (() => {
  const flangeW = studW  // full stud width
  const webThickness = 1.5  // pixels
  const flangeThickness = 1.5  // pixels
  return (
    <>
      {/* Top flange */}
      <rect x={studX} y={studCavityY} width={flangeW} height={flangeThickness}
        fill={colors.steelStud} stroke="#475569" strokeWidth="0.5" />
      {/* Bottom flange */}
      <rect x={studX} y={studCavityY + studH - flangeThickness} width={flangeW} height={flangeThickness}
        fill={colors.steelStud} stroke="#475569" strokeWidth="0.5" />
      {/* Web (one side — left edge) */}
      <rect x={studX} y={studCavityY} width={webThickness} height={studH}
        fill={colors.steelStud} stroke="#475569" strokeWidth="0.5" />
    </>
  )
})()}
```

This renders a C-shape: top flange, bottom flange, and a web on one side. The open side faces into the cavity. The C-channel is hollow — insulation fills the bays between studs, not inside the channel.

**Step 4: Run dev server, visually verify**

Run: `cd ecp-calculator && npm run dev`
Use Playwright MCP to navigate to the dev server, select Steel Frame, pick some options, screenshot the SVG. The C-channels should be clearly visible as thin gray U-shapes between pink insulation bays.

**Iterate if needed:** If the C-channel is too small or unclear at the rendered scale, adjust `webThickness`, `flangeThickness`, or stud width. Take screenshots between iterations.

**Step 5: Commit**

```bash
git add ecp-calculator/src/components/WallSection.jsx
git commit -m "feat: add steel C-channel stud rendering to WallSection"
```

---

### Task 8: WallSection — add ICF rendering

Add the ICF rendering path: drywall -> EPS foam -> concrete -> EPS foam -> cladding.

**Files:**
- Modify: `ecp-calculator/src/components/WallSection.jsx`

**Step 1: Add ICF branch**

Before the existing SVG return, add an early return for ICF:

```jsx
if (wallType === 'icf') {
  const epsThickness = icfFormThickness  // inches per side
  const concreteThickness = 8  // inches, fixed
  const icfTotalThickness = drywallThickness + epsThickness + concreteThickness + epsThickness + claddingThickness
  const icfWallLength = 24  // fixed display width in inches (no stud spacing)
  const icfWallWidthPx = icfWallLength * scale
  const icfSvgWidth = icfWallWidthPx + 180
  const icfSvgHeight = icfTotalThickness * scale + 80

  const icfStartY = 30
  const icfDrywallY = icfStartY
  const icfEpsIntY = icfStartY + drywallThickness * scale
  const icfConcreteY = icfEpsIntY + epsThickness * scale
  const icfEpsExtY = icfConcreteY + concreteThickness * scale
  const icfCladdingY = icfEpsExtY + epsThickness * scale

  const icfLayers = [
    { name: '1/2" drywall', midY: icfDrywallY + drywallThickness * scale / 2 },
    { name: `${icfFormThickness}" EPS (interior)`, midY: icfEpsIntY + epsThickness * scale / 2 },
    { name: '8" concrete', midY: icfConcreteY + concreteThickness * scale / 2 },
    { name: `${icfFormThickness}" EPS (exterior)`, midY: icfEpsExtY + epsThickness * scale / 2 },
    { name: '1/2" cladding', midY: icfCladdingY + claddingThickness * scale / 2 },
  ]

  return (
    <div className="wall-section" style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${icfSvgWidth} ${icfSvgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', maxHeight: '250px' }}
      >
        <text x={icfSvgWidth / 2} y="18" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
          INTERIOR
        </text>

        <g transform="translate(20, 0)">
          {/* Drywall */}
          <rect x={0} y={icfDrywallY} width={icfWallWidthPx}
            height={drywallThickness * scale} fill={colors.drywall} stroke="#9ca3af" strokeWidth="1" />

          {/* EPS interior */}
          <rect x={0} y={icfEpsIntY} width={icfWallWidthPx}
            height={epsThickness * scale} fill="#fce7f3" stroke="#db2777" strokeWidth="1" />
          {generateContInsPattern(0, icfWallWidthPx, icfEpsIntY, epsThickness * scale)}

          {/* Concrete core */}
          <rect x={0} y={icfConcreteY} width={icfWallWidthPx}
            height={concreteThickness * scale} fill="#6b7280" stroke="#374151" strokeWidth="1" />
          {/* Aggregate speckle pattern */}
          {Array.from({ length: 40 }).map((_, i) => (
            <circle
              key={`speckle-${i}`}
              cx={Math.random() * icfWallWidthPx}
              cy={icfConcreteY + Math.random() * concreteThickness * scale}
              r={1.5}
              fill="#9ca3af"
              opacity={0.5}
            />
          ))}

          {/* EPS exterior */}
          <rect x={0} y={icfEpsExtY} width={icfWallWidthPx}
            height={epsThickness * scale} fill="#fce7f3" stroke="#db2777" strokeWidth="1" />
          {generateContInsPattern(0, icfWallWidthPx, icfEpsExtY, epsThickness * scale)}

          {/* Cladding */}
          <rect x={0} y={icfCladdingY} width={icfWallWidthPx}
            height={claddingThickness * scale} fill={colors.cladding} stroke="#4b5563" strokeWidth="1" />

          {/* Labels */}
          {(() => {
            const labelSpacing = 14
            const labelStartY = icfStartY + 5
            const labelX = icfWallWidthPx + 80

            return (
              <g>
                {icfLayers.map((layer, i) => {
                  const labelY = labelStartY + i * labelSpacing
                  return (
                    <g key={layer.name}>
                      <path
                        d={`M ${icfWallWidthPx + 20} ${layer.midY}
                            L ${icfWallWidthPx + 40} ${layer.midY}
                            L ${labelX - 5} ${labelY}`}
                        fill="none" stroke="#9ca3af" strokeWidth="1" />
                      <circle cx={icfWallWidthPx + 20} cy={layer.midY} r="2" fill="#9ca3af" />
                      <text x={labelX} y={labelY + 3} fontSize="9" fill="#6b7280">{layer.name}</text>
                    </g>
                  )
                })}
              </g>
            )
          })()}
        </g>

        <text x={icfSvgWidth / 2} y={icfCladdingY + claddingThickness * scale + 25}
          textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
          EXTERIOR
        </text>
      </svg>
    </div>
  )
}
```

**Important note about the speckle pattern:** The `Math.random()` calls above will produce different speckles on each render. Replace with a deterministic pattern using fixed coordinates or a seeded approach. For example, pre-compute positions:

```js
// Deterministic speckle positions for concrete
const concreteSpeckles = Array.from({ length: 40 }).map((_, i) => ({
  x: ((i * 17 + 7) % 100) / 100,  // pseudo-random x 0-1
  y: ((i * 31 + 13) % 100) / 100   // pseudo-random y 0-1
}))
```

Then use `cx={concreteSpeckles[i].x * icfWallWidthPx}` etc.

**Step 2: Run dev server, visually verify**

Use Playwright to select ICF, pick 3-1/8" form. Screenshot the SVG. Verify: drywall (gray) -> pink EPS with pattern -> dark gray concrete with speckles -> pink EPS with pattern -> gray cladding. Labels should align.

**Step 3: Commit**

```bash
git add ecp-calculator/src/components/WallSection.jsx
git commit -m "feat: add ICF wall rendering to WallSection SVG"
```

---

### Task 9: Visual verification with Playwright

Systematically verify all three wall type renderings.

**Files:** None modified — this is verification only.

**Step 1: Start dev server**

Run: `cd ecp-calculator && npm run dev` (background)

**Step 2: Test Wood Frame**

Use Playwright MCP to:
1. Navigate to `http://localhost:5173`
2. Click "Build Assembly"
3. Select Wall Type: Wood Frame
4. Select Stud Spacing: 16"
5. Select Cavity Material: Fiberglass Batt
6. Select Cavity Size: 2x6 R20
7. Select Cont. Ins. Type: XPS
8. Select Cont. Ins. Thickness: 2"
9. Verify RSI displays ~4.49 and points display +9.9
10. Screenshot the wall section diagram
11. Verify: brown studs with X pattern, pink cavity insulation, gray sheathing, pink continuous insulation layer, gray cladding

**Step 3: Test Steel Frame**

1. Change Wall Type to Steel Frame
2. Re-select same options
3. Verify RSI shows "No data for this combination" (placeholder nulls)
4. Screenshot the SVG — verify C-channels render as thin gray U-shapes
5. If C-channels are unclear, iterate on thickness/color

**Step 4: Test ICF**

1. Change Wall Type to ICF
2. Select Form Thickness: 3-1/8"
3. Verify RSI shows "No data for this combination" (placeholder null)
4. Screenshot — verify drywall -> EPS -> concrete -> EPS -> cladding layers

**Step 5: Test Simple Mode**

1. Switch to "Select RSI" mode
2. Click an option button
3. Verify points display correctly
4. Verify no wall type selector appears

**Step 6: Test mode switching**

1. Switch back to "Build Assembly"
2. Verify all selections cleared
3. Make selections, switch wall type, verify downstream cleared

No commit — verification only.

---

### Task 10: Update documentation

Update the project docs to reflect all changes.

**Files:**
- Modify: `ecp-calculator/docs/data-layer.md`
- Modify: `ecp-calculator/docs/components.md`
- Modify: `ecp-calculator/docs/architecture.md`

**Step 1: Update data-layer.md**

Key changes:
- Add new exports table entries: `wallTypes`, `cavityMaterials`, `cavityTypes`, `continuousInsTypes`, `continuousInsThicknesses`, `icfFormOptions`, `framedWallRsi`, `continuousInsRsi`, `icfRsi`
- Update `calculateWallRsi()` documentation: now takes object argument, does lookup not calculation
- Remove old `studSpacingOptions` framing fraction details
- Remove old `cavityInsulationOptions` and `continuousInsulationOptions` sections
- Add sections for the three lookup tables

**Step 2: Update components.md**

Key changes:
- WallBuilder: update wall selection object shape, new props, new internal state, progressive disclosure behavior
- WallSection: add `wallType` and `icfFormThickness` props, document three rendering modes

**Step 3: Update architecture.md**

Key changes:
- Data flow diagram: add wall type selector
- State management table: update `wallSelection` description

**Step 4: Commit**

```bash
git add ecp-calculator/docs/
git commit -m "docs: update architecture, components, and data layer docs for wall builder changes"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Add Vitest | None |
| 2 | Refactor data layer (lookup tables) | None |
| 3 | Test data layer | Tasks 1, 2 |
| 4 | Update WallBuilder UI | Task 2 |
| 5 | Update App.jsx wallPoints | Task 2 |
| 6 | CSS for grouped selectors | Task 4 |
| 7 | WallSection steel C-channel | Task 4 |
| 8 | WallSection ICF rendering | Task 4 |
| 9 | Visual verification (Playwright) | Tasks 4, 6, 7, 8 |
| 10 | Update docs | Tasks 2-8 |

Tasks 1-2 can run in parallel. Tasks 4-5 can run in parallel. Tasks 6-8 can run in parallel after Task 4.

## Pending Data

Ryan will provide lookup table values for:
- [ ] `framedWallRsi.wood` — all materials except Fiberglass Batt
- [ ] `framedWallRsi.steel` — all combinations
- [ ] `continuousInsRsi['Mineral Wool']` — all thicknesses
- [ ] `icfRsi` — all form thicknesses
- [ ] `continuousInsRsi` 2-1/2" and 3" values for EPS, XPS, PIC (currently extrapolated linearly — verify)
