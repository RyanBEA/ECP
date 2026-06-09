import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PerformanceTab from './PerformanceTab'

vi.mock('../api/simulate', () => ({
  postSimulate: vi.fn(),
}))
import { postSimulate } from '../api/simulate'

const props = { selections: {}, wallSelection: {}, wallRsi: 4.5 }

// PerformanceTab geometry is controlled by App; wrap it so onGeometryChange
// updates the geometry the way App does.
function Harness(p) {
  const [geometry, setGeometry] = useState({ length_m: 10, width_m: 8, fdwr: 0.17 })
  const onGeometryChange = (field, value) => setGeometry(prev => ({ ...prev, [field]: value }))
  return <PerformanceTab {...p} geometry={geometry} onGeometryChange={onGeometryChange} />
}

beforeEach(() => { postSimulate.mockReset() })

describe('PerformanceTab', () => {
  it('runs a simulation and shows the tier on success', async () => {
    postSimulate.mockResolvedValue({
      annual_energy_gj: 67.8,
      compliance: {
        tier: 2, overall_improvement_pct: 14, envelope_improvement_pct: 10.7,
        peak_cooling_improvement_pct: 7.1, peak_cooling_validation: true,
        tedi: 38.9, meui: 61, ghgi: 44, nbc_proposed_kwh_m2: 42.2, nbc_target_kwh_m2: 49.1,
      },
    })
    render(<Harness {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    await waitFor(() => expect(screen.getByText(/Tier 2/)).toBeTruthy())
    expect(postSimulate).toHaveBeenCalledTimes(1)
  })

  it('blocks Run and shows an inline error when FDWR is out of range', () => {
    render(<Harness {...props} />)
    fireEvent.change(screen.getByLabelText(/fdwr/i), { target: { value: '0.9' } })
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    expect(screen.getByText(/0.05/)).toBeTruthy()
    expect(postSimulate).not.toHaveBeenCalled()
  })

  it('surfaces a server error on the panel', async () => {
    const err = new Error('simulation engine error')
    err.status = 500
    postSimulate.mockRejectedValue(err)
    render(<Harness {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    await waitFor(() => expect(screen.getByText(/failed/i)).toBeTruthy())
  })
})
