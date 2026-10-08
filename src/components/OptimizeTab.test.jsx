// src/components/OptimizeTab.test.jsx
import React, { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import OptimizeTab from './OptimizeTab'
import { defaultConsider, toggleConsider } from '../optimize/candidates'
import { useOptimize } from '../optimize/useOptimize'
import { useHouseCost, resolveHouseFields } from '../costing/useHouseCost'
import { categories } from '../data/ecpData'

const idx = (cardId, value) => categories.find(c => c.id === cardId).options.findIndex(o => o.value === value)
const design = {
  selections: { windowsDoors: idx('windowsDoors', 1.22), dhwElectric: idx('dhwElectric', 2.35), belowGradeWalls: idx('belowGradeWalls', 3.46), hrv: idx('hrv', 65) },
  wallSelection: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsType: 'XPS', contInsThickness: '2"', sheathingId: 'osb_11', claddingId: 'vinyl_siding' },
}

// Test support: OptimizeTab with live state, as App drives it.
function Harness({ selections = design.selections, wallSelection = design.wallSelection, houseType: initialType = 'singleDetached', fields = {}, spies = {} }) {
  const [houseType] = useState(initialType)
  const [consider, setConsider] = useState(defaultConsider)
  const [request, setRequest] = useState(null)
  const [screenState, setScreen] = useState('consider')
  const [applied, setApplied] = useState(false)
  const houseFields = resolveHouseFields(houseType, { [houseType]: fields })
  const cost = useHouseCost({ selections, wallSelection, houseType, houseFields, baselineChoice: 'typicalTier2', usualHouse: {}, overrides: {}, frozenOrder: null })
  const result = useOptimize(request)
  const blocked = cost.quantities.airflow === null && consider.hrv.size > 0 ? 'Enter the designed airflow on the Cost tab to include ventilation' : null
  const run = () => { setRequest({ selections, wallSelection, houseType, houseFields, baselineChoice: 'typicalTier2', usualHouse: {}, overrides: {}, tierPoints: 20, tierLabel: 'Tier 3', consider }); setScreen('result') }
  return (
    <OptimizeTab cost={cost} houseType={houseType} houseFields={houseFields} overriddenKeys={[]} baselineChoice="typicalTier2" usualHouse={{}} overrideCount={0}
      onTypeChange={() => {}} onFieldChange={() => {}} onBaselineChoice={() => {}} onEditUsual={() => {}} onResetUsual={() => {}} onViewBaselineCard={() => {}}
      tierLabel="Tier 3" consider={consider} onToggleConsider={(c, v) => setConsider(p => toggleConsider(p, c, v))}
      result={result} stale={false} blocked={blocked} onRun={run} onApply={p => { spies.onApply?.(p); setApplied(true) }} applied={applied} canRestore={applied} onRestore={() => { spies.onRestore?.(); setApplied(false) }}
      screen={screenState} onScreen={setScreen} />
  )
}

describe('OptimizeTab screen 1 (spec 5.1)', () => {
  it('opens on "What would you build?" with everything ticked and the standard wall locked', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'What would you build?' })).toBeInTheDocument()
    const standard = screen.getByLabelText(/2x4 or 2x6 studs, no foam or thin exterior foam/)
    expect(standard).toBeChecked(); expect(standard).toBeDisabled()
    expect(screen.getByLabelText('Double stud wall')).toBeChecked()
    expect(screen.getByLabelText('0.6 ACH50, tested')).toBeChecked()
    expect(screen.getByText(/Your current wall \(2x6 R24 batt \+ 2 in XPS, OSB, vinyl\) is always included/)).toBeInTheDocument()
  })
  it('walls and airtightness are open; the other cards are closed with a summary', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /Windows and doors/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Windows and doors.*all 3 options/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Above-ground walls/ })).toHaveAttribute('aria-expanded', 'true')
  })
  it('unticking changes the summary the closed row shows', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Windows and doors/ }))
    fireEvent.click(screen.getByLabelText('U 1.22 (triple glazed)'))
    fireEvent.click(screen.getByRole('button', { name: /Windows and doors/ }))
    expect(screen.getByRole('button', { name: /Windows and doors.*2 of 3 options/ })).toBeInTheDocument()
  })
  it('the button is disabled with the ventilation reason until HRV is unticked (review focus 2)', () => {
    render(<Harness fields={{ bedrooms: 'moreThan5' }} />)
    const btn = screen.getByRole('button', { name: 'Find the cheapest way to Tier 3' })
    expect(btn).toBeDisabled()
    expect(screen.getByText('Enter the designed airflow on the Cost tab to include ventilation')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Ventilation/ }))
    for (const v of [60, 65, 75]) fireEvent.click(screen.getByLabelText(`HRV, ${v}% SRE`))
    expect(btn).not.toBeDisabled()
  })
})

describe('OptimizeTab screen 2 (spec 5.2 to 5.4, 6)', () => {
  const go = () => fireEvent.click(screen.getByRole('button', { name: 'Find the cheapest way to Tier 3' }))
  it('shows the summary line, the headline, the package table and the before', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('0.6 ACH50, tested'))
    go()
    expect(screen.getByText(/^Considering:/)).toHaveTextContent('Considering: everything except 0.6 ACH50')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/^Cheapest way to Tier 3 for this house: /)
    expect(screen.getByText(/^Your current design is /)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'The package' })
    expect(within(table).getAllByRole('row').length).toBe(1 + 7 + 1)   // header, six cards and volume, total
    expect(within(table).getByText('Not changed; a property of your project')).toBeInTheDocument()
  })
  it('"Change" returns to screen 1 with the ticks kept', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('0.6 ACH50, tested'))
    go()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getByRole('heading', { name: 'What would you build?' })).toBeInTheDocument()
    expect(screen.getByLabelText('0.6 ACH50, tested')).not.toBeChecked()
  })
  it('marks changed rows with the builder\'s current pick', () => {
    render(<Harness />)
    go()
    const changed = screen.getAllByText('change')
    expect(changed.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^you have: /).length).toBe(changed.length)
  })
  it('"Show" swaps a runner-up into the package card', () => {
    render(<Harness />)
    go()
    const shows = screen.queryAllByRole('button', { name: 'Show' })
    if (shows.length === 0) return
    const before = screen.getByRole('table', { name: 'The package' }).textContent
    fireEvent.click(shows[0])
    expect(screen.getByRole('table', { name: 'The package' }).textContent).not.toBe(before)
    expect(screen.getByText('An alternative')).toBeInTheDocument()
  })
  it('"Put this on the Points tab" calls onApply with the shown package, then reads "Restore my design"', () => {
    const spies = { onApply: vi.fn(), onRestore: vi.fn() }
    render(<Harness spies={spies} />)
    go()
    fireEvent.click(screen.getByRole('button', { name: 'Put this on the Points tab' }))
    expect(spies.onApply).toHaveBeenCalledTimes(1)
    expect(spies.onApply.mock.calls[0][0].picks).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Restore my design' }))
    expect(spies.onRestore).toHaveBeenCalledTimes(1)
  })
  it('shows the nothing-reaches headline with the best package and a change button', () => {
    render(<Harness wallSelection={{}} />)
    for (const t of ['2x6 with thick exterior foam (2 in and up)', 'Larger studs (2x8 and up)', '2x6 with an interior service cavity', 'Double stud wall']) fireEvent.click(screen.getByLabelText(t))
    for (const v of ['2.5 ACH50, tested', '2 ACH50, tested', '1.5 ACH50, tested', '1 ACH50, tested', '0.6 ACH50, tested']) fireEvent.click(screen.getByLabelText(v))
    fireEvent.click(screen.getByRole('button', { name: /Windows and doors/ }))
    for (const v of ['U 1.44 (double glazed)', 'U 1.22 (triple glazed)']) fireEvent.click(screen.getByLabelText(v))
    go()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nothing you\'ve ticked reaches Tier 3 for this house.')
    expect(screen.getByRole('button', { name: 'Change what to consider' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'The package' })).toBeInTheDocument()
  })
})
