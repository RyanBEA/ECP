import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PerfResults from './PerfResults'

const done = {
  status: 'done',
  data: {
    annual_energy_gj: 67.8,
    compliance: {
      tier: 2, overall_improvement_pct: 14.03, envelope_improvement_pct: 10.71,
      peak_cooling_improvement_pct: 7.14, peak_cooling_validation: true,
      tedi: 38.88, meui: 61.06, ghgi: 44, nbc_proposed_kwh_m2: 42.2, nbc_target_kwh_m2: 49.09,
    },
  },
  error: null,
}

describe('PerfResults', () => {
  it('shows an idle prompt before any run', () => {
    render(<PerfResults result={{ status: 'idle', data: null, error: null }} />)
    expect(screen.getByText(/run a simulation/i)).toBeTruthy()
  })

  it('shows a spinner while running', () => {
    render(<PerfResults result={{ status: 'running', data: null, error: null }} />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders tier, three metrics, and whole-house energy when done', () => {
    render(<PerfResults result={done} />)
    expect(screen.getByText(/Tier 2/)).toBeTruthy()
    expect(screen.getByText(/14.0%/)).toBeTruthy()
    expect(screen.getByText(/10.7%/)).toBeTruthy()
    expect(screen.getByText(/7.1%/)).toBeTruthy()
    expect(screen.getByText(/67.8/)).toBeTruthy()
  })

  it('renders an error message on failure', () => {
    render(<PerfResults result={{ status: 'error', data: null, error: 'Simulation failed' }} />)
    expect(screen.getByText(/simulation failed/i)).toBeTruthy()
  })
})
