# ECP Calculator — Infrastructure & Deployment

## Build Tool

**Vite 5** with `@vitejs/plugin-react`.

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  base: './',     // Relative asset paths — required for Railway and subdirectory serving
  resolve: {
    alias: { '@scripts': path.resolve(__dirname, 'scripts') }
  },
  test: { environment: 'jsdom', globals: true }
})
```

Path alias `@scripts` allows `src/` code to import from `scripts/compute.js` (shared between build pipeline and React app). Test environment configured for jsdom (component + ExcelJS tests).

## NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Dev server with HMR (port 5173/5174) |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build locally |
| `start` | `serve dist -s -l $PORT` | Railway production server (`-s` = SPA mode) |

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | UI framework |
| `react-dom` | ^18.2.0 | DOM rendering |
| `serve` | ^14.2.5 | Static file server for production |
| `exceljs` | ^4.4.0 | Excel workbook generation (dynamically imported, code-split) |
| `vite` | ^5.0.0 | Build tool (dev) |
| `@vitejs/plugin-react` | ^4.2.1 | React JSX/refresh support (dev) |
| `vitest` | ^4.0.18 | Test framework (dev) |
| `@testing-library/react` | ^16.3.2 | React component testing (dev) |

ExcelJS is a production dependency but dynamically imported — Vite code-splits it into a separate chunk (~938KB) loaded only when the user clicks "Export to Excel" in the wall builder. The main bundle remains ~229KB.

---

## Deployment

### Railway

- **Project:** "patient-essence"
- **Auto-deploy:** Pushes to `main` branch trigger automatic deployment
- **Build command:** `npm run build` (Vite produces `dist/`)
- **Start command:** `npm run start` → `serve dist -s -l $PORT`
- **SPA mode (`-s`):** All routes fall through to `index.html` for client-side handling

### GitHub

- **Repo:** `https://github.com/RyanBEA/ECP.git`
- **Branches:** `main` (production), `master` (development)

---

## PWA Support

### Manifest (`public/manifest.json`)

```json
{
  "name": "ECP Calculator",
  "short_name": "ECP Calc",
  "description": "NBC 2020 Tier 2 Energy Conservation Points Calculator",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f3f4f6",
  "theme_color": "#2563eb",
  "icons": [{ "src": "data:image/svg+xml,...", "sizes": "any", "type": "image/svg+xml" }]
}
```

- `display: "standalone"` — opens without browser chrome when added to home screen
- `background_color` matches light mode body background
- Icon is an inline SVG data URI (blue square with white "E")

### Service Worker (`public/sw.js`)

**Strategy:** Network-first with cache fallback.

| Event | Behavior |
|-------|----------|
| Install | Pre-caches `'/'` and `'/index.html'` |
| Activate | Deletes all caches except `'ecp-calculator-v1'` |
| Fetch | Tries network first → caches successful responses → falls back to cache on failure |

**Registration** in `main.jsx` on the `load` event (non-blocking).

### Known Gaps

| Issue | Detail |
|-------|--------|
| Cache version hardcoded | `'ecp-calculator-v1'` must be manually incremented to bust cache after deploys |
| Minimal pre-cache | Only `/` and `/index.html` pre-cached; JS/CSS bundles cached lazily on first fetch |
| No apple-touch-icon | iOS home screen shows a screenshot, not the app icon |
| No favicon link | No `<link rel="icon">` in `index.html` |
| Theme color mismatch | `index.html` and `manifest.json` both use `#2563eb` (blue) but the app brand color is `#4F3D63` (purple) |

---

## HTML Entry Point (`index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#2563eb" />
  <title>ECP Calculator - NBC Tier 2 Compliance</title>
  <link rel="manifest" href="/manifest.json" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

Standard React SPA entry. No preload hints, no Open Graph tags, no inline CSS.

---

## Public Assets

```
public/
  manifest.json        PWA manifest
  sw.js                Service worker
  logolightmode.png    BEA logo for light theme
  logodarkmode.png     BEA logo for dark theme
```

Logo switching is handled in JSX based on `darkMode` state, not CSS.
