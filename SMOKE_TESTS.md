# Perf Modelling Smoke Tests

Manual pre-merge runbook for the ECP2 perf server. Run after substantive backend changes to verify the full pipeline end-to-end.

## Setup

In two terminals:

```bash
# Terminal 1 — perf server
cd c:\BEAtools\ECP2\server
uv run uvicorn perf_server.api:app --host 127.0.0.1 --port 8001

# Terminal 2 — frontend
cd c:\BEAtools\ECP2
npm run dev
```

Open `http://localhost:5173/`. The dev proxy routes `/api/*` to the perf server.

Verify health:

```powershell
Invoke-RestMethod http://localhost:5173/api/health
# {"status":"ok","queue_depth":0}
```

Cases are POSTed via DevTools console:

```js
fetch('/api/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(/* case body */)
}).then(r => r.json()).then(console.log)
```

## Request shape

All cases use the same shape:

```jsonc
{
  "ecp_state": {
    "above_grade_wall": { "rsi": ... },
    "below_grade_wall": { "rsi": ... },
    "windows": { "rsi": ..., "shgc": ... },
    "airtightness_ach50": ...,
    "hrv": { "sre": ... },
    "dhw": { "ef": ... }
  },
  "geometry": {
    "footprint": { "length_m": ..., "width_m": ... },
    "fdwr": ...
  },
  "perf_extras": {
    "heating": { "type": "electric_baseboard", "efficiency": 1.0 }
  }
}
```

User-set inputs: envelope (from ECP), `footprint`, `fdwr`. Hidden defaults: stories=2, foundation=finished basement, wall heights, weather (Halifax), occupants, door area.

## Cases

### Case 1: Smallest valid box, NBC-minimum envelope

Smallest footprint above `MIN_FOOTPRINT_M2 = 30`. Floor of FDWR range.

```jsonc
{
  "ecp_state": {
    "above_grade_wall": { "rsi": 2.97 },
    "below_grade_wall": { "rsi": 2.98 },
    "windows": { "rsi": 0.43, "shgc": 0.40 },
    "airtightness_ach50": 3.2,
    "hrv": { "sre": 0.55 },
    "dhw": { "ef": 0.82 }
  },
  "geometry": { "footprint": { "length_m": 6.0, "width_m": 5.5 }, "fdwr": 0.10 },
  "perf_extras": { "heating": { "type": "electric_baseboard", "efficiency": 1.0 } }
}
```

Expected: `annual_energy_gj` in the 35-55 GJ range (small floor area, NBC minimums).

### Case 2: Largest valid box, NBC-minimum envelope

Largest footprint under `MAX_FOOTPRINT_M2 = 400`. Wide-shape rectangle.

```jsonc
{
  "ecp_state": {
    "above_grade_wall": { "rsi": 2.97 },
    "below_grade_wall": { "rsi": 2.98 },
    "windows": { "rsi": 0.43, "shgc": 0.40 },
    "airtightness_ach50": 3.2,
    "hrv": { "sre": 0.55 },
    "dhw": { "ef": 0.82 }
  },
  "geometry": { "footprint": { "length_m": 25.0, "width_m": 15.0 }, "fdwr": 0.17 },
  "perf_extras": { "heating": { "type": "electric_baseboard", "efficiency": 1.0 } }
}
```

Expected: `annual_energy_gj` significantly higher than Case 1 (large floor area, more envelope to heat). Likely 120-180 GJ.

### Case 3: Tier-3-style envelope (high performance)

Same geometry as base.h2k (~58 m² × 2 storeys), envelope reflective of Tier 3 ECP selections.

```jsonc
{
  "ecp_state": {
    "above_grade_wall": { "rsi": 7.0 },
    "below_grade_wall": { "rsi": 4.5 },
    "windows": { "rsi": 1.1, "shgc": 0.50 },
    "airtightness_ach50": 1.0,
    "hrv": { "sre": 0.85 },
    "dhw": { "ef": 2.3 }
  },
  "geometry": { "footprint": { "length_m": 7.65, "width_m": 7.65 }, "fdwr": 0.17 },
  "perf_extras": { "heating": { "type": "electric_baseboard", "efficiency": 1.0 } }
}
```

Expected: `annual_energy_gj` noticeably lower than base.h2k's 69.6 GJ — likely 40-55 GJ. HPWH path (EF > 1.0) exercised.

### Case 4: NBC-minimum envelope, base geometry

Same geometry as Case 3, NBC code-min envelope. Establishes baseline for comparing Case 3.

```jsonc
{
  "ecp_state": {
    "above_grade_wall": { "rsi": 2.97 },
    "below_grade_wall": { "rsi": 2.98 },
    "windows": { "rsi": 0.43, "shgc": 0.40 },
    "airtightness_ach50": 3.2,
    "hrv": { "sre": 0.55 },
    "dhw": { "ef": 0.82 }
  },
  "geometry": { "footprint": { "length_m": 7.65, "width_m": 7.65 }, "fdwr": 0.17 },
  "perf_extras": { "heating": { "type": "electric_baseboard", "efficiency": 1.0 } }
}
```

Expected: roughly matches base.h2k's 69.6 GJ. The mutations write the same envelope values that are already in base.h2k, so the result should be near-identical (small variation possible due to FDWR=0.17 vs base's ~0.127).

### Case 5: Bounds-check rejection

Invalid input — verifies the bounds layer is wired correctly.

```jsonc
{
  "ecp_state": {
    "above_grade_wall": { "rsi": 4.0 },
    "below_grade_wall": { "rsi": 3.0 },
    "windows": { "rsi": 0.5, "shgc": 0.4 },
    "airtightness_ach50": 2.5,
    "hrv": { "sre": 0.75 },
    "dhw": { "ef": 0.92 }
  },
  "geometry": { "footprint": { "length_m": 6.0, "width_m": 4.0 }, "fdwr": 0.17 },
  "perf_extras": { "heating": { "type": "electric_baseboard", "efficiency": 1.0 } }
}
```

Expected: **HTTP 422**, body contains `detail` mentioning "footprint" (24 m² < `MIN_FOOTPRINT_M2`).

## Sanity checks for every passing case

- `annual_energy_gj > 0`
- `breakdown_gj.space_heating > 0` (Halifax CZ6 always needs heating)
- `breakdown_gj.space_cooling >= 0` (typically ~0 with no cooling)
- `breakdown_gj.other` populated (baseload + ventilation)
- `peak_heating_kw > 0`, roughly `50-100 W/m²` of floor area
- `job_duration_seconds` between 1 and 30 seconds

Expected ordering of `annual_energy_gj`:
- Case 3 (Tier 3) < Case 4 (NBC min, same geometry)
- Case 1 (small NBC) < Case 4 (base-size NBC) < Case 2 (large NBC)

## Known failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| HTTP 503 from `/api/simulate` | HOT2000.exe missing or `H2K_CLI_PATH` env var wrong | Check `C:\H2K-CLI-11.12\HOT2000.exe` exists |
| HTTP 500 "simulation engine error" | Mutation produced invalid HOT2000 file | Check perf server logs; inspect mutated file at `%TEMP%\...\input.h2k` |
| HTTP 504 timeout | HOT2000.exe hung | Kill `HOT2000.exe` in Task Manager, retry |
| Result `annual_energy_gj == 69.58` exactly | Stale `<AllResults>` from base.h2k leaking through | Bug in `simulate.py` strip logic — see `test_simulate_integration.py` regression test |
| HTTP 422 on otherwise-valid input | Bounds check too strict, or schema mismatch | Read `detail` field; check `mutations.py` `MIN_*`/`MAX_*` constants |

## Pre-merge checklist

- [ ] All 5 smoke cases produce expected results
- [ ] Full pytest suite passes (`uv run pytest -v` in `server/`)
- [ ] Integration tests pass (`uv run pytest -m requires_hot2000 -v` in `server/`)
- [ ] `npm test` passes for frontend
- [ ] Version bumped per `CLAUDE.md` convention before push
