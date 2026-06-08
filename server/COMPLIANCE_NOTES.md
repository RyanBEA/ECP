# NBC Compliance Metrics — Backend Notes (Task B0)

## Finding: base.h2k runs NBC mode; Tsv refreshes every run

`base.h2k` is already configured for NBC tiered-performance mode:
- `<Program class="ca.nrcan.gc.OEE.ERS2020NBC.ErsProgram">`
- `<RulesetType value="EnerGuide Rating System 2020 NBC" />`

A plain `HOT2000.exe -inp ..\file.h2k` invocation (the exact pattern used by
`sim_harness.run_hot2000`) **honors the file's NBC mode** — no CLI flag, no
`Opt-Program` injection, and no HTAP ruleset application is required. HOT2000's
interface fires the full ERS/NBC multi-run from the inputs alone.

### Evidence (via real `simulate.run()`, envelope wall RSI 4.5 / ACH 2.5)

- Output `AllResults` contained all 7 ERS house-codes:
  `[None, SOC, HOC, HCV, ROC, Reference, UserHouse]`.
- `Program/Results/Tsv` was **freshly recomputed**:
  - `EnergyPerformanceTier = 3`, `OverallImprovement = 22.07`, `EnvelopeImprovement = 12.42`
  - vs base.h2k's stale pre-run values: `Tier 2`, `14.03`, `10.71`.
  Different values ⇒ HOT2000 refreshes the compliance block on every run.

### Consequence for the implementation

- **No `simulate.py` change is needed.** It strips only `<AllResults>` today; the
  `Program/Results/Tsv`/`Ers` block is refreshed by HOT2000 regardless, so there is
  no stale-data risk. (Earlier "stale" observations came from contaminated manual
  runs that bypassed the real `simulate.run()` flow.)
- The compliance parser (Task B1) targets:
  - `/HouseFile/Program/Results/Tsv` — `EnergyPerformanceTier`, `OverallImprovement`,
    `EnvelopeImprovement`, `PeakCoolingValidation`, `TEDI`, `MEUI`, `GHGI`,
    `NBCAnnualEnegyConsumption`, `NBCHouseEnergyTarget`.
  - `/HouseFile/Program/Results/Ers` — `ERSDesCoolLoss` (proposed peak cooling),
    `RefDesCoolLoss` (reference peak cooling).

## Caveat: HOT2000 silent calculate-failures on some envelopes

A second probe run (wall RSI 7.0 / below 3.5 / window 0.7 / ACH 1.0 / HRV 0.80 /
DHW 2.30) produced **no `UserHouse` block**, which the existing `results.parse`
surfaces as `ValueError` → HTTP 500. This may have been a shared CLI working-dir
collision on a back-to-back run, or a genuine HOT2000 calculate-failure for that
input combination. It is **pre-existing behavior**, unrelated to compliance parsing.
Flag for a future robustness pass (per-run working-dir isolation and/or retry).

## Tooling note

`uv` was not on PATH in the automation shell; the project venv at
`server/.venv/Scripts/python.exe` (with `PYTHONPATH=server/src`) was used directly to
run probes and `pytest`.
