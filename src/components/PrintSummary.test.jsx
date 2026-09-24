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

  it('shows Double Stud label and framing details for double stud assembly', () => {
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
    expect(screen.getByText(/Studs: 2x4 \+ 2x4/)).toBeTruthy()
    expect(screen.getByText(/Plate: 2x10/)).toBeTruthy()
    expect(screen.getByText(/Fill: Loose Fill Cellulose/)).toBeTruthy()
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

  it('prints project details when provided and blank lines when not', () => {
    const { container, rerender } = render(
      <PrintSummary
        selections={{ airTightness: 1 }}
        wallSelection={{}}
        wallPoints={0}
        totalPoints={3.5}
        selectedTier={baseTier}
        projectInfo={{ project: '123 Main St', permit: '', applicant: 'Acme Homes' }}
      />
    )
    expect(container.querySelector('[data-field="project"]').textContent).toBe('123 Main St')
    expect(container.querySelector('[data-field="applicant"]').textContent).toBe('Acme Homes')
    expect(container.querySelector('[data-field="permit"]').classList.contains('print-blank')).toBe(true)

    // Omitting projectInfo entirely still renders three blank rows
    rerender(
      <PrintSummary
        selections={{ airTightness: 1 }}
        wallSelection={{}}
        wallPoints={0}
        totalPoints={3.5}
        selectedTier={baseTier}
      />
    )
    expect(container.querySelectorAll('.print-blank').length).toBe(3)
  })

  it('prints the AHJ disclaimer', () => {
    const { container } = render(
      <PrintSummary selections={{}} wallSelection={{}} wallPoints={0} totalPoints={0} selectedTier={baseTier} />
    )
    expect(container.querySelector('.print-disclaimer').textContent).toMatch(/authority having jurisdiction/)
  })
})

describe('PrintSummary below-grade walls', () => {
  const concrete = {
    foundationType: 'concrete', concreteThickness: '200', extInsThickness: 'None', intInsThickness: 'None',
    hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22', finish: 'gypsum',
  }

  it('renders no below-grade row when nothing is selected, and never from `selections`', () => {
    const { container } = render(
      <PrintSummary selections={{ belowGradeWalls: 1 }} wallSelection={{}} wallPoints={0} totalPoints={0} selectedTier={baseTier} />
    )
    expect(container.querySelectorAll('.print-row').length).toBe(0)
    expect(screen.queryByText('Below Grade Walls')).toBeNull()
  })

  it('simple mode: row with the option value, no detail lines', () => {
    const { container } = render(
      <PrintSummary selections={{}} wallSelection={{}} wallPoints={0}
        belowGradeSelection={{ simpleIndex: 0 }} belowGradePoints={0} totalPoints={0} selectedTier={baseTier} />
    )
    expect(screen.getByText('Below Grade Walls')).toBeTruthy()
    expect(screen.getByText('≥ RSI 2.98')).toBeTruthy()
    expect(container.querySelectorAll('.print-wall-detail').length).toBe(0)
    expect(container.querySelector('[data-category="belowGradeWalls"] .print-pts').textContent).toBe('0.0')
  })

  it('builder mode: RSI label and the detail lines for concrete', () => {
    const { container } = render(
      <PrintSummary selections={{}} wallSelection={{}} wallPoints={0}
        belowGradeSelection={{ ...concrete, extInsType: 'XPS', extInsThickness: '2"', cavityType: '2x6 R20', studOffset: true }}
        belowGradePoints={1.4} totalPoints={1.4} selectedTier={baseTier} />
    )
    expect(screen.getByText('RSI 4.64')).toBeTruthy()
    expect(screen.getByText('Foundation Type: Poured Concrete')).toBeTruthy()
    expect(screen.getByText('Wall Thickness: 200 mm (8")')).toBeTruthy()
    expect(screen.getByText('Exterior Ins: XPS, 2"')).toBeTruthy()
    expect(screen.getByText('Stud Spacing: 16" | Cavity: Fiberglass Batt, 2x6 R20 | held off the concrete')).toBeTruthy()
    expect(screen.getByText('Finish: 1/2" gypsum board')).toBeTruthy()
    expect(screen.getByText('Total Assembly RSI: 4.64')).toBeTruthy()
    expect(container.querySelector('[data-category="belowGradeWalls"] .print-pts').textContent).toBe('1.4')
  })

  it('builder mode: block, ICF and PWF lines; interior foam forces the gypsum line', () => {
    const { rerender } = render(
      <PrintSummary selections={{}} wallSelection={{}} wallPoints={0}
        belowGradeSelection={{ ...concrete, foundationType: 'block', blockType: 'light_empty', concreteThickness: undefined, hasStudWall: false, finish: 'none', intInsType: 'XPS', intInsThickness: '2"' }}
        belowGradePoints={0} totalPoints={0} selectedTier={baseTier} />
    )
    expect(screen.getByText('Block Type: Light-weight, cores empty')).toBeTruthy()
    expect(screen.getByText('Interior Ins: XPS, 2"')).toBeTruthy()
    expect(screen.getByText('Stud Wall: none')).toBeTruthy()
    expect(screen.getByText('Finish: 1/2" gypsum board')).toBeTruthy()

    rerender(
      <PrintSummary selections={{}} wallSelection={{}} wallPoints={0}
        belowGradeSelection={{ foundationType: 'icf', icfFormThickness: '2-1/2"', finish: 'gypsum' }}
        belowGradePoints={0.8} totalPoints={0.8} selectedTier={baseTier} />
    )
    expect(screen.getByText('RSI 3.56')).toBeTruthy()
    expect(screen.getByText('EPS Form Thickness: 2-1/2" per side')).toBeTruthy()

    rerender(
      <PrintSummary selections={{}} wallSelection={{}} wallPoints={0}
        belowGradeSelection={{ foundationType: 'pwf', pwfStud: '2x8', pwfSpacing: '16"', pwfCavityMaterial: 'Fiberglass Batt', pwfCavityType: '2x8 R28', finish: 'none' }}
        belowGradePoints={1.4} totalPoints={1.4} selectedTier={baseTier} />
    )
    expect(screen.getByText('Foundation Type: Permanent Wood Foundation')).toBeTruthy()
    expect(screen.getByText('Studs: 2x8 @ 16" | Cavity: Fiberglass Batt, 2x8 R28')).toBeTruthy()
    expect(screen.getByText('Finish: None (unfinished)')).toBeTruthy()
  })

  it('incomplete builder selection prints "Incomplete"', () => {
    render(
      <PrintSummary selections={{}} wallSelection={{}} wallPoints={0}
        belowGradeSelection={{ foundationType: 'icf', finish: 'gypsum' }}
        belowGradePoints={0} totalPoints={0} selectedTier={baseTier} />
    )
    expect(screen.getByText('Incomplete')).toBeTruthy()
  })

  it('above-ground and below-grade rows both print', () => {
    const { container } = render(
      <PrintSummary selections={{ airTightness: 1 }} wallSelection={{ simpleIndex: 0 }} wallPoints={1.6}
        belowGradeSelection={concrete} belowGradePoints={0.2} totalPoints={5.3} selectedTier={baseTier} />
    )
    const rows = [...container.querySelectorAll('.print-row')].map(r => r.querySelector('td').textContent)
    expect(rows).toEqual(['Above Ground Walls', 'Below Grade Walls', 'Air Tightness'])
  })
})
