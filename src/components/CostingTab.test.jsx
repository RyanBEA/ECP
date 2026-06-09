import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CostingTab from './CostingTab'

const base = {
  wallSelection: {}, wallRsi: 0,
  geometry: { length_m: 10, width_m: 8, fdwr: 0.17 },
  onGeometryChange: () => {},
}

describe('CostingTab', () => {
  it('shows an empty state when no upgrades are selected', () => {
    render(<CostingTab selections={{}} {...base} />)
    expect(screen.getByText(/No upgrades selected/i)).toBeTruthy()
  })

  it('renders a cost line and total for a selected upgrade', () => {
    render(<CostingTab selections={{ hrv: 2 }} {...base} />)
    expect(screen.getByText(/HRV/i)).toBeTruthy()
    expect(screen.getByText(/Total incremental cost/i)).toBeTruthy()
    // $2,000 appears twice: the line cost and the total (only one upgrade).
    expect(screen.getAllByText(/\$2,000/)).toHaveLength(2)
  })
})
