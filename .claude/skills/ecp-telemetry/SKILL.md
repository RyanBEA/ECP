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
| Summarize a pull | `.claude/skills/ecp-telemetry/scripts/summarize.py telemetry-exports/ecp-events-<stamp>.csv` |
| One design per visit | add `--final-only` to `summarize.py` (keeps the last event per `session_id`) |
| Ad-hoc analysis | load the CSV with Python `csv`/`json`; `selections_json` and `wall_json` are JSON columns |
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
