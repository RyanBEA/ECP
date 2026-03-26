# ECP Calculator — Styling Reference

**File:** `src/App.css`

Plain CSS with custom properties — no Tailwind, no CSS modules, no preprocessor. Global stylesheet loaded in `main.jsx`.

## Font

```css
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;800&display=swap');
```

| Context | Weight | Size |
|---------|--------|------|
| Body text | 300 (Light) | 16px default |
| Headings (h1–h6) | 800 (ExtraBold) | inherited |
| Tier selector | 600 (SemiBold) | 1.1rem |
| Category names | 600 | 1rem |
| Option values | 600 | 0.9rem |
| Option labels | 500 | 0.65rem |
| Points counter value | 600 | 1.5rem |
| Descriptions | 300 | 0.8rem |
| Wall selector labels | 600 | 0.75rem (uppercase, letter-spaced) |

---

## CSS Custom Properties

### Light Theme (`:root`)

| Variable | Value | Usage |
|----------|-------|-------|
| `--primary` | `#4F3D63` | Purple — borders, selected states, accents |
| `--primary-dark` | `#3d2f4d` | Darker purple (defined but unused in CSS) |
| `--primary-light` | `#e8e0f0` | Light purple — field group borders |
| `--success` | `#16a34a` | Green — completion states |
| `--success-light` | `#dcfce7` | Light green — completion backgrounds |
| `--danger` | `#dc2626` | Red — sub-code warnings, below-minimum RSI |
| `--gray-50` | `#f9fafb` | Hover backgrounds |
| `--gray-100` | `#f3f4f6` | Body background |
| `--gray-200` | `#e5e7eb` | Default borders |
| `--gray-300` | `#d1d5db` | Muted borders |
| `--gray-400` | `#9ca3af` | Muted accents |
| `--gray-500` | `#6b7280` | Secondary text |
| `--gray-600` | `#4b5563` | — |
| `--gray-700` | `#374151` | Label text |
| `--gray-900` | `#111827` | Primary text |
| `--radius` | `8px` | Border radius (universal) |
| `--card-bg` | `white` | Card backgrounds |
| `--body-bg` | `var(--gray-100)` | Page background |
| `--text-primary` | `var(--gray-900)` | Main text |
| `--text-secondary` | `var(--gray-500)` | Subdued text |
| `--border-color` | `var(--gray-200)` | Borders |

### Dark Theme (`.dark`)

The `.dark` class on `<body>` inverts the gray scale and adjusts semantic tokens:

| Variable | Light | Dark |
|----------|-------|------|
| `--primary` | `#4F3D63` | `#8b7a9e` (lighter purple) |
| `--primary-dark` | `#3d2f4d` | `#4F3D63` |
| `--primary-light` | `#e8e0f0` | `#3d2f4d` (dark purple) |
| `--success` | `#16a34a` | `#4ade80` (brighter green) |
| `--success-light` | `#dcfce7` | `#166534` (dark green) |
| `--danger` | `#dc2626` | `#f87171` (brighter red) |
| `--gray-50` | `#f9fafb` | `#1f2937` |
| `--gray-100` | `#f3f4f6` | `#111827` |
| `--gray-200` | `#e5e7eb` | `#374151` |
| `--gray-300` | `#d1d5db` | `#4b5563` |
| `--gray-400` | `#9ca3af` | `#6b7280` |
| `--gray-500` | `#6b7280` | `#9ca3af` |
| `--gray-600` | `#4b5563` | `#d1d5db` |
| `--gray-700` | `#374151` | `#e5e7eb` |
| `--gray-900` | `#111827` | `#f9fafb` |
| `--card-bg` | `white` | `#1f2937` |
| `--body-bg` | `var(--gray-100)` | `#111827` |
| `--text-primary` | `var(--gray-900)` | `#f9fafb` |
| `--text-secondary` | `var(--gray-500)` | `#9ca3af` |
| `--border-color` | `var(--gray-200)` | `#374151` |

**Design pattern:** The gray scale is numerically inverted in dark mode — all components using gray vars adapt automatically without per-component overrides.

---

## Layout

Primary layout uses flexbox and CSS grid. No third-party layout framework.

| Component | Strategy | Details |
|-----------|----------|---------|
| `.app` | flex column | `max-width: 900px`, centered, `min-height: 100vh` |
| `.app-header` | flex row, wrap | Horizontal header; wraps on mobile |
| `.categories-container` | grid | Single-column, `gap: 1rem`, `flex-grow: 1` |
| `.options-grid` | flex wrap | Row of option buttons, `gap: 0.5rem` |
| `.wall-selectors` | grid auto-fit | `repeat(auto-fit, minmax(140px, 1fr))` — reflows automatically |
| `.points-counter` | flex | Baseline-aligned for mixed font sizes |

---

## Responsive Design

Single breakpoint at 600px:

```css
@media (max-width: 600px) {
  .app-header     → flex-direction: column, align-items: flex-start
  .points-counter → width: 100%, justify-content: center
  .option-button  → flex: 1, min-width: 70px (reduced from 80px)
}
```

The wall selectors grid handles its own responsiveness via `auto-fit` without a media query.

No tablet breakpoints.

### Print Styles (`@media print`)

Used by the Save / Print feature. Hides the interactive UI and shows only the `PrintSummary` component.

```css
@media print {
  .app-header, .app-intro, .categories-container, .app-footer → display: none
  .print-summary → display: block (was display: none on screen)
  body, .app, .app.dark → white background, dark text (forces light mode)
  @page { margin: 1cm }
}
```

Print-specific classes (only styled inside `@media print`):

| Class | Purpose |
|-------|---------|
| `.print-summary` | Container — `display: none` on screen, `display: block` in print |
| `.print-header` | Flex row: title + date, bold 13pt, bottom border |
| `.print-table` | Full-width table with collapse borders |
| `.print-row` | Standard category row |
| `.print-wall-detail` | Indented sub-row (9pt, gray) for wall builder details |
| `.print-total` | Bold total row with top border |
| `.print-status` | Right-aligned pass/fail status (12pt bold) |
| `.print-pts` | Right-aligned points column |
| `.print-footer` | Centered 8pt gray disclaimer |

---

## Transitions

All motion is via `transition` — no keyframe animations.

| Element | Transition |
|---------|------------|
| `body` | `background-color 0.2s ease, color 0.2s ease` (theme switch) |
| Buttons (`.dark-toggle`, `.option-button`, `.mode-btn`) | `all 0.15s ease` |
| `.wall-selector select` | `border-color 0.15s ease` |

---

## Box Shadows

| Element | Shadow |
|---------|--------|
| Cards, header, footer | `0 1px 3px rgba(0,0,0,0.1)` |
| Focus rings (selects) | `0 0 0 3px rgba(79,61,99,0.15)` |

---

## Class Naming Conventions

Flat hyphen-separated names (BEM-like but without `__` or `--` syntax):

- **Blocks:** `.app`, `.category-card`, `.option-button`, `.wall-builder`, `.points-counter`, `.field-group`, `.view-toggle`, `.print-summary`
- **Elements:** `.category-name`, `.option-value`, `.wall-selector`, `.points-label`, `.field-group-num`, `.field-group-title`, `.sub-label`
- **State modifiers:** additional class names — `.selected`, `.active`, `.complete`, `.disabled`, `.has-points`, `.has-label`, `.below-code`, `.footnote`

### Notable Patterns

- **`.wall-builder`** has a thick left border (`border-left: 4px solid var(--primary)`) — unique visual treatment distinguishing it from standard cards.
- **`.category-card.disabled`** — `opacity: 0.5` + `pointer-events: none` for full card disabling.
- **`.points-counter.complete`** — switches entire counter from gray to green palette.
- **`.wall-points.has-points`** — value text turns green only when points are earned.
- **`.wall-rsi.below-code`** — RSI value turns `--danger` red when below NBC minimum.

### Field Group Cards

| Class | Purpose |
|-------|---------|
| `.field-group` | Numbered card wrapper — `border: 2px solid var(--primary-light)`, 10px radius, subtle purple tint background |
| `.field-group-head` | Flex row: badge + title |
| `.field-group-num` | Circular numbered badge — 20px, `var(--primary)` background, white text |
| `.field-group-title` | 0.75rem, bold 700, `var(--gray-700)` |
| `.field-group.footnote` | Variant — dashed `var(--gray-300)` border, transparent background, smaller badge (16px, `var(--gray-400)`) and title (0.65rem, `var(--gray-500)`) |

### Sub-labels and Assumptions

| Class | Purpose |
|-------|---------|
| `.sub-label` | Section divider within a FieldGroup — 0.6rem uppercase, `var(--gray-400)`, letter-spaced |
| `.assumptions-list` | Flex row of read-only assumption items |
| `.assumption-item` | 0.7rem, `var(--gray-500)` |
| `.assumption-label` | Bold 600, `var(--gray-600)` |

### Wall Builder Result Area

| Class | Purpose |
|-------|---------|
| `.wall-result` | Flex row with `var(--gray-50)` background — holds RSI and points display |
| `.wall-rsi`, `.wall-points` | Baseline-aligned label + value pairs |
| `.wall-warning` | Full-width `--danger` colored warning text for sub-code RSI |
| `.wall-prompt` | Italic `var(--gray-500)` placeholder text |
| `.export-button` | `var(--primary)` filled button with disabled/wait state |
| `.view-toggle` | Pill-style mode switcher (Build Assembly / Select RSI) with `.active` highlight |
| `.option-group` | Flex row for assembly type toggle buttons |
