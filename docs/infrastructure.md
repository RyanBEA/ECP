# ECP Calculator — Infrastructure & Deployment

## Build Tool

**Vite 5** with `@vitejs/plugin-react`.

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  base: './',     // Relative asset paths — required for subdirectory serving
  resolve: {
    alias: { '@scripts': path.resolve(__dirname, 'scripts') }
  },
  test: { environment: 'jsdom', globals: true, setupFiles: [] }
})
```

Path alias `@scripts` allows `src/` code to import from `scripts/compute.js` (shared between build pipeline and React app). Test environment configured for jsdom (component + ExcelJS tests).

## NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Dev server with HMR (port 5173/5174) |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build locally |
| `start` | `node server/index.js` | Production server — static files + print telemetry API |
| `test` | `vitest run` | Run unit tests (single pass) |
| `test:watch` | `vitest` | Run tests in watch mode |
| `generate` | `node scripts/generate.js` | Regenerate JSON from YAML materials |
| `generate:audit` | `node scripts/generate.js --audit` | Generate + produce audit Excel workbook |
| `generate:validate` | `node scripts/generate.js --validate` | Generate + validate against existing JSON |

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | UI framework |
| `react-dom` | ^18.2.0 | DOM rendering |
| `express` | ^4.21.2 | Production server: static file serving + print telemetry API |
| `pg` | ^8.13.1 | Postgres client for print telemetry storage |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `exceljs` | ^4.4.0 | Excel workbook generation (dynamically imported, code-split) |
| `js-yaml` | ^4.1.1 | YAML parsing for `scripts/generate.js` build pipeline |
| `vite` | ^5.0.0 | Build tool |
| `@vitejs/plugin-react` | ^4.2.1 | React JSX/refresh support |
| `vitest` | ^4.0.18 | Test framework |
| `jsdom` | ^29.0.1 | DOM environment for tests |
| `@testing-library/react` | ^16.3.2 | React component testing |
| `@testing-library/jest-dom` | ^6.9.1 | Custom DOM matchers for tests |

ExcelJS is a dev dependency but dynamically imported at runtime — Vite code-splits it into a separate chunk loaded only when the user clicks "Export to Excel" in the wall builder.

---

## Deployment

The app runs on Railway as a single Node.js/Express server that serves the static build **and** the print telemetry API described below (any other Node.js-capable host — Vercel, Render, etc. — works the same way).

- **Build command:** `npm run build` (Vite produces `dist/`)
- **Start command:** `npm run start` → `node server/index.js`
- **Server:** `server/index.js` (Express). Serves `dist/` as static files with an SPA fallback (any non-`/api` GET returns `dist/index.html`), and exposes the print telemetry endpoints under `/api`.
- **Environment variables:**
  | Variable | Required | Purpose |
  |---|---|---|
  | `PORT` | no (default `3000`) | Port the server listens on (set automatically by Railway) |
  | `DATABASE_URL` | no | Postgres connection string. Without it the server still starts and serves static files, but `POST /api/events` returns 503 and `/api/health` reports `db: false` |
  | `PGSSLMODE` | no | Set to `disable` to skip TLS (e.g. local Postgres). SSL (`rejectUnauthorized: false`) is used otherwise, except against a `localhost`/`127.0.0.1` `DATABASE_URL` |
  | `EVENTS_EXPORT_KEY` | no | Bearer token required to read `GET /api/events.csv`. Without it the endpoint returns 503 |

---

## Print Telemetry

An anonymous event is sent to the server each time a user clicks "Save / Print" (see `src/utils/printEvent.js` and `src/App.jsx`). No project/address/permit/applicant text or other free-text input is ever recorded — only the tier, point totals, and the category/wall selections (indices and enum-like fields), plus a per-page-load random `sessionId` held only in memory. The below-grade (foundation) wall is recorded in its own `below_grade` column (fixed keys, option ids and labels, booleans, rounded RSI and points); from v1.3.0 the Below Grade Walls category is no longer recorded as an option index in `selections`. See `.claude/skills/ecp-telemetry/SKILL.md` for the column shapes and the pre-1.3.0 index shift.

### Storage

Postgres table, created automatically on server startup when `DATABASE_URL` is set:

```sql
CREATE TABLE IF NOT EXISTS print_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  app_version TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tier SMALLINT NOT NULL,
  target_points NUMERIC(5,1) NOT NULL,
  total_points NUMERIC(5,1) NOT NULL,
  met BOOLEAN NOT NULL,
  selections JSONB NOT NULL,
  wall JSONB
);
-- Added for the below-grade (foundation) wall builder; safe on existing tables.
ALTER TABLE print_events ADD COLUMN IF NOT EXISTS below_grade JSONB;
CREATE INDEX IF NOT EXISTS print_events_created_at_idx ON print_events (created_at);
```

Server-side code lives in `server/db.js` (pool init, insert, streaming export, health ping) and `server/validate.js` (pure request validation — rejects malformed/oversized payloads with 400).

### Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/events` | POST | Accepts one validated print event, inserts it, responds `204`. Returns `503` if no `DATABASE_URL`, `400` on invalid body, `429` if the client IP has sent more than 60 events in the last minute (in-memory rate limit, IPs never persisted). |
| `/api/events.csv` | GET | Streams all events as CSV. Requires `Authorization: Bearer <EVENTS_EXPORT_KEY>` (compared via `crypto.timingSafeEqual` over SHA-256 digests). Returns `503` if `EVENTS_EXPORT_KEY` is unset or `DATABASE_URL` is unset, `401` on a bad/missing key. |
| `/api/health` | GET | `{ ok: true, db: true|false }` — `db` reflects whether a `SELECT 1` against Postgres currently succeeds. |

The server never logs request bodies or client IPs.

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
