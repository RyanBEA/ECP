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

describe('PrintSummary code-minimum flags', () => {
  // 2x4 R12 @ 16", no foam: RSI 1.94, below the 2.97 minimum
  const failingWall = { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x4 R12' }
  // 2x6 R24 @ 16": RSI 3.11, meets the minimum
  const passingWall = { ...failingWall, cavityType: '2x6 R24' }
  const concrete = {
    foundationType: 'concrete', concreteThickness: '200', extInsThickness: 'None', intInsThickness: 'None',
    hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', finish: 'gypsum',
  }
  // R20 @ 16": RSI 2.87, below the 2.98 minimum; R22 @ 16": RSI 3.12, meets it
  const failingBg = { ...concrete, cavityType: '2x6 R20' }
  const passingBg = { ...concrete, cavityType: '2x6 R22' }

  const renderSummary = (props) => render(
    <PrintSummary selections={{ airTightness: 4 }} wallPoints={0} belowGradePoints={0} totalPoints={13.3} selectedTier={baseTier} {...props} />
  )

  it('above-ground wall below minimum: flag under the row and Not Met despite enough points', () => {
    const { container } = renderSummary({ wallSelection: failingWall, belowGradeSelection: passingBg })
    expect(screen.getByText('RSI 1.94')).toBeTruthy()
    const flag = container.querySelector('[data-warning="aboveGroundWalls"]')
    expect(flag.textContent).toBe('⚠ Does not meet code — 1.03 RSI below minimum 2.97')
    // The flag sits directly under the Above Ground Walls row
    expect(flag.previousElementSibling.querySelector('td').textContent).toBe('Above Ground Walls')
    expect(container.querySelector('[data-warning="belowGradeWalls"]')).toBeNull()
    expect(container.querySelector('.print-status').textContent).toBe('✗ Tier 2 Not Met — wall below code minimum')
    expect(screen.queryByText(/Tier 2 Met/)).toBeNull()
  })

  it('below-grade wall below minimum: flag under the row and Not Met despite enough points', () => {
    const { container } = renderSummary({ wallSelection: passingWall, belowGradeSelection: failingBg })
    const flag = container.querySelector('[data-warning="belowGradeWalls"]')
    expect(flag.textContent).toBe('⚠ Does not meet code — 0.11 RSI below minimum 2.98')
    expect(flag.previousElementSibling.dataset.category).toBe('belowGradeWalls')
    expect(container.querySelector('[data-warning="aboveGroundWalls"]')).toBeNull()
    expect(container.querySelector('.print-status').textContent).toBe('✗ Tier 2 Not Met — wall below code minimum')
  })

  it('both walls below minimum: both flags, plural status', () => {
    const { container } = renderSummary({ wallSelection: failingWall, belowGradeSelection: failingBg })
    expect(container.querySelectorAll('.print-wall-warning').length).toBe(2)
    expect(container.querySelector('.print-status').textContent).toBe('✗ Tier 2 Not Met — walls below code minimum')
  })

  it('passing pair with enough points: no flags, Met', () => {
    const { container } = renderSummary({ wallSelection: passingWall, belowGradeSelection: passingBg })
    expect(container.querySelectorAll('.print-wall-warning').length).toBe(0)
    expect(container.querySelector('.print-status').textContent).toBe('✓ Tier 2 Met')
  })

  it('passing pair short on points: points wording, no wall note', () => {
    const { container } = renderSummary({ wallSelection: passingWall, belowGradeSelection: passingBg, totalPoints: 4.1 })
    expect(container.querySelectorAll('.print-wall-warning').length).toBe(0)
    expect(container.querySelector('.print-status').textContent).toBe('5.9 more points needed for Tier 2')
  })

  it('short on points and a wall below minimum: points wording plus the wall note', () => {
    const { container } = renderSummary({ wallSelection: failingWall, belowGradeSelection: passingBg, totalPoints: 4.1 })
    expect(container.querySelector('.print-status').textContent).toBe('5.9 more points needed for Tier 2 — wall below code minimum')
  })

  it('simple mode never flags (options start at the minimum)', () => {
    const { container } = renderSummary({ wallSelection: { simpleIndex: 0 }, belowGradeSelection: { simpleIndex: 0 } })
    expect(container.querySelectorAll('.print-wall-warning').length).toBe(0)
    expect(container.querySelector('.print-status').textContent).toBe('✓ Tier 2 Met')
  })

  it('incomplete builder selections do not flag', () => {
    const { container } = renderSummary({ wallSelection: { wallType: 'wood', assemblyType: 'single' }, belowGradeSelection: { foundationType: 'icf', finish: 'gypsum' } })
    expect(container.querySelectorAll('.print-wall-warning').length).toBe(0)
    expect(container.querySelector('.print-status').textContent).toBe('✓ Tier 2 Met')
  })
})
