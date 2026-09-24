---
name: ecp-telemetry
description: Use when asked to pull, export, count, summarize, or analyze ECP Calculator print telemetry / usage statistics / print_events, or when tempted to connect to the calculator's Railway Postgres directly.
---

# ECP Telemetry

## Overview

The calculator records one anonymous event per Save / Print click in a Postgres
table (`print_events`) on Railway. **You cannot reach that database from bae** —
it has no public endpoint and `psql` is not installed. The only pull path is the
app's authenticated CSV export, and the export key is injected from 1Password by
`op-with`. Never try to obtain `DATABASE_URL`, `PGPASSWORD`, or the export key
yourself; the scripts below never print them.

## Quick Reference

| Task | Command (run from the `ecp-calculator/` repo root, on bae as Ryan) |
|---|---|
| Pull all events to CSV | `.claude/skills/ecp-telemetry/scripts/pull-events.sh` → `telemetry-exports/ecp-events-<stamp>.csv` |
| Summarize a pull | `.claude/skills/ecp-telemetry/scripts/summarize.py telemetry-exports/ecp-events-<stamp>.csv` (tiers, selections, walls, and below grade: mode, foundation type, Select RSI levels, builder RSI; exports without `below_grade_json` still work) |
| One design per visit | add `--final-only` to `summarize.py` (keeps the last event per `session_id`) |
| Ad-hoc analysis | load the CSV with Python `csv`/`json`; `selections_json`, `wall_json` and `below_grade_json` are JSON columns |
| Check the endpoint | `curl -s https://ecp.baselineenergy.ca/api/health` → `{"ok":true,"db":true}` |

`telemetry-exports/` is gitignored. Do not commit pulled CSVs.

## What the data means

- One row = one click of Save / Print. Users often print several times while
  tweaking; `session_id` is a random id per page load, so `--final-only` gives
  the finalized design per visit.
- `selections_json` maps category id → option **index** into that category's
  `options` array in `src/data/ecpData.js` (labels/thresholds in `docs/data-layer.md`).
- `wall_json` is `null`, `{"mode":"simple","simpleIndex":n,...}`, or a builder
  object with `wallType`, `assemblyType`, framing/insulation fields, `rsi`, `points`.
- `below_grade_json` (column `below_grade`, added for the foundation wall builder)
  is `null` when the Below Grade Walls category is untouched, or
  `{"mode":"simple","simpleIndex":n,"rsi":<option RSI>,"points":p}`, or a builder
  object. The builder object always carries the same keys, `null` when a field does
  not apply to the chosen foundation type: `mode`, `foundationType` (`concrete` |
  `block` | `icf` | `pwf`), `concreteThickness`, `blockType`, `icfFormThickness`,
  `pwfStud`, `pwfSpacing`, `pwfCavityMaterial`, `pwfCavityType`, `extInsType`,
  `extInsThickness`, `intInsType`, `intInsThickness`, `hasStudWall`, `studSpacing`,
  `cavityMaterial`, `cavityType`, `studDepth`, `studOffset`, `finish`, `rsi`
  (effective RSI rounded to 2 decimals, `null` when incomplete), `points`.
  Rows written before the column existed read as an empty cell.
- **Historical index shift, Below Grade Walls.** Rows recorded before app version
  1.3.0 hold `belowGradeWalls` inside `selections_json` as an index into the OLD
  three-option list: 0 = RSI 3.09, 1 = 3.46, 2 = 3.90. Version 1.3.0 inserted a
  2.98 / 0-point floor at index 0 of that list, so the same index now names a
  different level. Rows from 1.3.0 on never carry `belowGradeWalls` in
  `selections_json` (the client strips it and the server strips it again); they use the `below_grade` column
  instead, whose `simpleIndex` counts from the NEW list (0 = 2.98, 1 = 3.09,
  2 = 3.46, 3 = 3.90) and whose `rsi` field gives the level directly. Split any
  below-grade analysis on `app_version` and read the old rows with the old list.
- Nothing identifying is stored: no project, permit, applicant, IP, or user agent.
  Do not add such fields to reports "for context" — they do not exist.

## Failure modes

| Symptom | Cause / fix |
|---|---|
| Looking for `DATABASE_URL`, `railway connect`, `railway run psql` | Wrong path. Postgres is internal-only; use `pull-events.sh`. |
| `401 unauthorized` | Vault key `BEA-service/railway-ecp/ecp-events-export-key` ≠ `EVENTS_EXPORT_KEY` on the Railway `ECP` service. Ask Ryan to re-sync; do not guess. |
| `503` | Server has no `EVENTS_EXPORT_KEY` or no DB. Check `/api/health`; Railway staging has no database by design. |
| `op-with not found` / `no 1Password token` | Must run on bae as Ryan; see the `secrets` skill. |
| Counts look inflated | Repeated prints in one session — use `--final-only`. |

## Server-side reference

Endpoints live in `server/index.js`; schema in `server/db.js`; export command also
documented in `docs/common-tasks.md`. Changing what is collected means editing
`src/utils/printEvent.js` **and** the allow-list in `server/validate.js` together.
