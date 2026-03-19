# Sub-Code Wall Warning

## Problem

The Wall Builder's "Build Assembly" mode allows users to configure wall assemblies that fall below the NBC 2020 minimum RSI requirement (2.97 per Table 9.36.2.6.-B for homes with HRVs in Nova Scotia). Currently, such walls show "Points: +0" with no indication that the wall is non-compliant. A 2x4 wood frame wall with fiberglass batt and no continuous insulation, for example, yields RSI 1.94 — well below code — but the UI gives no warning.

## Solution

When the calculated wall RSI is below 2.97, replace the "Points" display with a "Min. RSI" reference and a single red warning line.

## Two Result States

| State | Condition | Display |
|-------|-----------|---------|
| **Meets code** | RSI >= 2.97 | Effective RSI (normal color) + Points (green if >0, gray if 0) |
| **Below code** | RSI < 2.97 | Effective RSI (red) + Min. RSI: 2.97 (gray) + warning text |

The warning text reads: `⚠ Does not meet code — X.XX below minimum`

Where X.XX is `(2.97 - calculatedRsi).toFixed(2)`.

## Scope

This warning applies only to **Build Assembly** mode. The "Select RSI" simple mode's lowest option is RSI 3.08, which already meets code.

**ICF note:** All ICF options yield RSI >= 3.66, so they can never trigger the warning. No special handling needed.

**Boundary case:** RSI = 2.97 exactly does NOT trigger the warning (uses strict `<`). One lookup combination produces exactly 2.97 (wood / 24" / Loose Fill Cellulose / 2x6) — this should show "Points: +0" in gray, not the warning.

## Files Changed

### `ecp-calculator/src/data/ecpData.js`
- Add `export const MIN_WALL_RSI = 2.97`

### `ecp-calculator/src/components/WallBuilder.jsx`
- Import `MIN_WALL_RSI` from ecpData
- In the result area (currently lines 289-314), add a conditional:
  - If `rsi < MIN_WALL_RSI`: render RSI value with a `below-code` class, show "Min. RSI: 2.97" instead of "Points: +N", and render warning text line
  - Otherwise: render existing RSI + Points display unchanged

### `ecp-calculator/src/App.css`
- Add CSS variables to both `:root` and `.dark` themes:
  - `:root` — `--danger: #dc2626`
  - `.dark` — `--danger: #f87171`
- Add `.wall-rsi.below-code .value` rule — applies `color: var(--danger)`
- Add `.wall-warning` rule — red text, small font size, for the warning line

## Files NOT Changed

- `App.jsx` — no changes needed; wall points calculation already handles zero-point case
- `CategoryCard.jsx` — not involved
- `PointsCounter.jsx` — not involved
- `WallSection.jsx` — the cross-section diagram is unaffected
- Simple "Select RSI" mode — lowest option (3.08) already meets code

## Design Decisions

- **Hardcoded threshold**: MIN_WALL_RSI = 2.97, based on NBC 2020 Table 9.36.2.6.-B (with HRV) for NS Zone 5/6. No climate zone selector — the tool targets Nova Scotia.
- **No NBC table references in UI**: Target audience (builders, building officials) doesn't need table numbers. Plain language only.
- **Inline approach**: Warning is a single text line, not a banner or card. Keeps the tool clean and lightweight.
- **Two states, not three**: No special treatment for the 2.97-3.07 range (meets code but no ECP points). The existing "Points: +0" gray display is sufficient for that case.
