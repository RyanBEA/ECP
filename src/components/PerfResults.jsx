import React from 'react'

// Renders the simulation outcome. result = { status, data, error } where status is
// idle | running | done | error. Tier is the hero; the three %-vs-reference metrics
// and the whole-house GJ follow; intensities are supporting text.
export default function PerfResults({ result }) {
  const { status, data, error } = result

  if (status === 'idle') {
    return <div className="perf-results perf-idle">Set geometry and run a simulation.</div>
  }
  if (status === 'running') {
    return (
      <div className="perf-results perf-running" role="status" aria-live="polite">
        <span className="spinner" /> Running simulation… (8–15 s)
      </div>
    )
  }
  if (status === 'error') {
    return <div className="perf-results perf-error">{error || 'Simulation failed — please try again.'}</div>
  }

  const c = data.compliance
  const metric = (v) => `${v.toFixed(1)}%`
  return (
    <div className="perf-results perf-done">
      <div className="perf-hero">
        <div className="perf-hero-label">NBC 2020 PERFORMANCE PATH</div>
        <div className="perf-hero-tier">Tier {c.tier}</div>
        <div className="perf-hero-sub">
          peak-cooling check {c.peak_cooling_validation ? '✔ pass' : '✘ fail'}
        </div>
      </div>
      <div className="perf-metrics">
        <div className="perf-metric"><b>{metric(c.overall_improvement_pct)}</b><span>overall</span></div>
        <div className="perf-metric"><b>{metric(c.envelope_improvement_pct)}</b><span>space heating</span></div>
        <div className="perf-metric"><b>{metric(c.peak_cooling_improvement_pct)}</b><span>peak cooling</span></div>
      </div>
      <div className="perf-wholehouse">
        <span>Whole-house energy</span><b>{data.annual_energy_gj.toFixed(1)} GJ/yr</b>
      </div>
      <div className="perf-supporting">
        TEDI {c.tedi.toFixed(1)} · MEUI {c.meui.toFixed(1)} · GHGI {c.ghgi} ·
        {' '}{c.nbc_proposed_kwh_m2.toFixed(1)} vs {c.nbc_target_kwh_m2.toFixed(1)} kWh/m²
      </div>
    </div>
  )
}
