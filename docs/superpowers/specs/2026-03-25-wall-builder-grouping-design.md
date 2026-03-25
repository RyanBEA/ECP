# Wall Builder UI Grouping & Auto-Defaults

**Date:** 2026-03-25
**Status:** Approved
**Approach:** B — Extract `FieldGroup` sub-component, restructure WallBuilder groups

## Problem

The Wall Builder "Build Assembly" UI presents all dropdowns as flat, equally-styled groups with small uppercase labels as the only visual division. Users can't quickly see which fields belong together, and all fields start empty — requiring every dropdown to be touched before the wall section diagram renders.

## Design

### Group Structure

The builder organizes fields into numbered, visually distinct card groups. Groups are conditionally rendered and dynamically renumbered (no gaps). The group sequence depends on wall type and toggles:

#### Wood Frame — Single Stud (no service wall)
1. **Wall Configuration** — wall type dropdown, assembly type pills (Single/Double Stud), service wall toggle
2. **Main Wall** — sub-sections: Framing (stud spacing, cavity insulation, cavity size), Continuous Insulation (type, thickness), Exterior (exterior sheathing, cladding)
3. **Assumptions** — footnote style, read-only: 1/2" drywall, interior air film (0.12 RSI), exterior air film (0.03 RSI)

#### Wood Frame — Single Stud + Service Wall
1. **Wall Configuration** — wall type, assembly type, service wall toggle (on)
2. **Service Wall** — stud spacing, cavity insulation, cavity size
3. **Main Wall** — sub-sections: Framing (stud spacing, cavity insulation, cavity size), Exterior (exterior sheathing, cladding). No continuous insulation sub-section.
4. **Interior Layer** — material (sheathing or rigid insulation), thickness (if rigid)
5. **Assumptions** — same as above

#### Wood Frame — Double Stud (with or without service wall)
1. **Wall Configuration** — wall type, assembly type (Double Stud selected), service wall toggle
2. **Service Wall** — (conditional, if toggle on) stud spacing, cavity insulation, cavity size
3. **Main Wall — Double Stud** — sub-sections: Framing (stud spacing, outer studs, inner studs, plate width, insulation), Exterior (exterior sheathing, cladding). No continuous insulation.
4. **Interior Layer** — (conditional, if service wall on) material, thickness
5. **Assumptions** — same as above

#### Steel Frame
1. **Wall Configuration** — wall type only (no assembly type, no service wall toggle)
2. **Main Wall** — sub-sections: Framing (stud spacing, cavity insulation, cavity size), Continuous Insulation (type, thickness), Exterior (cladding only, no sheathing)
3. **Assumptions** — read-only

#### ICF
1. **Wall Configuration** — wall type only
2. **Main Wall** — EPS form thickness (per side)
3. **Assumptions** — read-only

### Auto-Defaults

When a wall type or toggle is selected, all downstream groups auto-fill with sensible defaults so the diagram renders immediately. Users adjust from defaults rather than building from scratch.

| Scenario | Defaults |
|----------|----------|
| Single stud main wall | 16" o.c., Fiberglass Batt, 2x6 R20, no continuous insulation |
| Double stud main wall | 16" o.c., 2x4 outer studs, 2x4 inner studs, 2x10 plate, Loose Fill Cellulose |
| Service wall (any) | 16" o.c., Fiberglass Batt, 2x4 R12 |
| Interior layer (when service wall on) | 7/16" OSB |
| Exterior sheathing (wood) | 7/16" OSB |
| Cladding | Vinyl Siding |

Auto-filled values are **not** visually distinguished from user-selected values. They appear as normal selected dropdown values.

### Visual Treatment

**Active groups:** Solid 2px border with light purple tint (`border-color: var(--purple-light)`, `background: rgba(79,61,99,0.03)`). Numbered circle header (purple background, white number). Bold group title.

**Assumptions group (footnote):** 1px dashed border, `var(--gray-300)`. Smaller text throughout. Gray numbered circle. Read-only text items (not dropdowns) — displays drywall thickness and air film RSI values.

**Sub-sections within Main Wall:** Lightweight sub-labels (tiny uppercase text, `var(--gray-400)`) to divide Framing / Continuous Insulation / Exterior within the Main Wall card. No additional borders — just label + fields.

**Dynamic numbering:** Groups are numbered sequentially based on which are visible. When service wall is off, there's no gap in numbering.

### Component Architecture

**New component: `FieldGroup`**
- Wraps a numbered card with header (number badge + title)
- Props: `number`, `title`, `variant` (`'default'` | `'footnote'`), `children`
- Handles the card border, background, and header styling
- Used by WallBuilder to compose the group sequence

**Modified: `WallBuilder.jsx`**
- Replace flat `.wall-selectors-group` divs with `<FieldGroup>` components
- Add auto-default logic to `handleFieldChange` cascades and toggle handlers
- Cladding and exterior sheathing fields move from the old "Boundary Layers" group into the Main Wall group
- Continuous insulation fields move from their own group into the Main Wall group (single stud only)
- New "Assumptions" group replaces "Boundary Layers" — static display, no dropdowns

**Modified: `App.css`**
- New `.field-group` card styles (border, radius, padding, active state)
- `.field-group.footnote` variant (dashed border, smaller text, gray tones)
- `.sub-label` for intra-group section dividers
- `.assumptions-list` and `.assumption-item` for read-only display
- Remove or deprecate old `.wall-selectors-group` styles if no longer used elsewhere

### Diagram Behavior

The wall section diagram remains at the bottom of the builder, below the result bar (RSI + points). With auto-defaults, the diagram renders immediately when a wall type is selected — no more "select framing options to calculate RSI" empty state for wood/steel frames.

### What Doesn't Change

- State management (all state in App.jsx, passed down via `selection` prop)
- `calculateWallRsi()` and `getWallPoints()` logic
- WallSection.jsx SVG rendering
- Simple mode ("Select RSI" tab)
- ICF form thickness as a single dropdown (just wrapped in FieldGroup)
- The existing exclusive behavior: continuous insulation hidden when service wall is on, service wall unavailable for steel/ICF

## Mockups

Visual mockups available in whiteboard session `wall-builder-ui-grouping`, page `design-v2`.
