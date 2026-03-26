import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintSummary from './PrintSummary'

const baseTier = { id: 2, label: 'Tier 2', points: 10 }

describe('PrintSummary', () => {
  it('renders nothing when no selections', () => {
    const { container } = render(
      <PrintSummary
        selections={{}}
        wallSelection={{}}
        wallPoints={0}
        totalPoints={0}
        selectedTier={baseTier}
      />
    )
    const rows = container.querySelectorAll('.print-row')
    expect(rows.length).toBe(0)
  })

  it('renders a row for each selected category', () => {
    // airTightness index 1 = 2.0 ACH, 3.5 pts
    // hrv index 0 = 60% SRE, 0.7 pts
    const { container } = render(
      <PrintSummary
        selections={{ airTightness: 1, hrv: 0 }}
        wallSelection={{}}
        wallPoints={0}
        totalPoints={4.2}
        selectedTier={baseTier}
      />
    )
    const rows = container.querySelectorAll('.print-row')
    expect(rows.length).toBe(2)
    expect(screen.getByText('Air Tightness')).toBeTruthy()
    expect(screen.getByText('Ventilation')).toBeTruthy()
  })

  it('shows wall builder details when builder mode used', () => {
    render(
      <PrintSummary
        selections={{}}
        wallSelection={{ wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20' }}
        wallPoints={2.0}
        totalPoints={2.0}
        selectedTier={baseTier}
      />
    )
    expect(screen.getByText(/Wood Frame/)).toBeTruthy()
    expect(screen.getByText(/Fiberglass Batt/)).toBeTruthy()
  })

  it('shows wall row without details when simple mode used', () => {
    const { container } = render(
      <PrintSummary
        selections={{}}
        wallSelection={{ simpleIndex: 2 }}
        wallPoints={1.5}
        totalPoints={1.5}
        selectedTier={baseTier}
      />
    )
    expect(screen.getByText('Above Ground Walls')).toBeTruthy()
    // Should NOT have builder detail rows
    const details = container.querySelectorAll('.print-wall-detail')
    expect(details.length).toBe(0)
  })

  it('shows Double Stud label for double stud assembly', () => {
    render(
      <PrintSummary
        selections={{}}
        wallSelection={{ wallType: 'wood', assemblyType: 'doubleStud', studSpacing: '16"', outerStud: '2x4', innerStud: '2x4', plate: '2x10', doubleStudMaterial: 'Loose Fill Cellulose' }}
        wallPoints={3.0}
        totalPoints={3.0}
        selectedTier={baseTier}
      />
    )
    expect(screen.getByText(/Double Stud/)).toBeTruthy()
  })

  it('shows pass status when target met', () => {
    render(
      <PrintSummary
        selections={{ airTightness: 4 }}
        wallSelection={{}}
        wallPoints={0}
        totalPoints={13.3}
        selectedTier={baseTier}
      />
    )
    expect(screen.getByText(/Tier 2 Met/)).toBeTruthy()
  })

  it('shows shortfall when target not met', () => {
    render(
      <PrintSummary
        selections={{ hrv: 0 }}
        wallSelection={{}}
        wallPoints={0}
        totalPoints={0.7}
        selectedTier={baseTier}
      />
    )
    expect(screen.getByText(/9.3 more/)).toBeTruthy()
  })
})
