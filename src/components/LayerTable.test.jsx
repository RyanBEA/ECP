import { render, screen, fireEvent, within } from '@testing-library/react'
import LayerTable from './LayerTable'

const comp = (component, option, material, labour, extra = {}) => ({ component, option, label: option, unit: 'm2', quantity: 100, material, labour, overridden: { material: false, labour: false }, source: 'placeholder', ...extra })
const design = { state: 'priced', unit: 'm2', quantity: 100, perUnit: 0, cost: 0, lineOverride: null, description: 'This', components: [comp('framing', 'stud_2x6_16oc', 18, 22), comp('continuous_insulation', 'isocyanurate_2in', 22, 9), comp('cladding', 'vinyl_siding', 5, 7)] }
const baseline = { state: 'priced', unit: 'm2', quantity: 100, perUnit: 0, cost: 0, lineOverride: null, description: 'Base', components: [comp('framing', 'stud_2x6_16oc', 18, 22), comp('continuous_insulation', 'xps_iv_1in', 12, 7), comp('cladding', 'vinyl_siding', 5, 7)] }
const line = { categoryId: 'aboveGroundWalls', name: 'Above-ground walls', design, baseline, delta: 0, state: 'priced' }

describe('LayerTable', () => {
  it('emphasises differing rows and collapses identical ones', () => {
    render(<LayerTable categoryId="aboveGroundWalls" line={line} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={() => {}} onLineOverride={() => {}} quantityDisplay="1,830 sq ft" />)
    expect(screen.getByRole('row', { name: /continuous insulation/i })).toHaveClass('differs')
    expect(screen.queryByRole('row', { name: /framing/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /2 identical layers/ }))
    expect(screen.getByRole('row', { name: /framing/i })).toBeInTheDocument()
  })
  it('edits an identical row on both sides by default and a differing row on one side', () => {
    const onOverride = vi.fn()
    render(<LayerTable categoryId="aboveGroundWalls" line={line} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={onOverride} onLineOverride={() => {}} quantityDisplay="1,830 sq ft" />)
    fireEvent.click(screen.getByRole('button', { name: /2 identical layers/ }))
    const framing = screen.getByRole('row', { name: /framing/i })
    fireEvent.click(within(framing).getAllByRole('button', { name: /Override/ })[0])
    fireEvent.change(within(framing).getByRole('spinbutton'), { target: { value: '2.5' } })
    fireEvent.keyDown(within(framing).getByRole('spinbutton'), { key: 'Enter' })
    expect(onOverride).toHaveBeenCalledWith('both', 'framing', 'stud_2x6_16oc', 'material', 2.5)
    const ci = screen.getByRole('row', { name: /continuous insulation/i })
    fireEvent.click(within(ci).getAllByRole('button', { name: /Override/ })[0])
    fireEvent.change(within(ci).getByRole('spinbutton'), { target: { value: '3' } })
    fireEvent.keyDown(within(ci).getByRole('spinbutton'), { key: 'Enter' })
    expect(onOverride).toHaveBeenLastCalledWith('design', 'continuous_insulation', 'isocyanurate_2in', 'material', 3)
  })
  it('has a line-level override per side', () => {
    const onLineOverride = vi.fn()
    render(<LayerTable categoryId="aboveGroundWalls" line={line} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={() => {}} onLineOverride={onLineOverride} quantityDisplay="1,830 sq ft" />)
    const input = screen.getByRole('spinbutton', { name: 'I pay this much per sq ft for This design' })
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.blur(input)
    expect(onLineOverride).toHaveBeenCalledWith('design', 12)
  })

  // Controller rulings added to the brief's tests: R25 priced-item id, dormant cells under a line override, R36 per-card count.
  it('passes the priced-item id (priceId) when a component has one (R25)', () => {
    const onOverride = vi.fn()
    const sized = (option, material, labour) => comp('hrv_unit', option, material, labour, { unit: 'each', quantity: 1, priceId: `${option}@45` })
    const hrvLine = {
      categoryId: 'hrv', name: 'HRV',
      design: { state: 'priced', unit: 'each', quantity: 1, perUnit: 0, cost: 0, lineOverride: null, description: 'This', components: [sized('sre_65_75', 900, 400)] },
      baseline: { state: 'priced', unit: 'each', quantity: 1, perUnit: 0, cost: 0, lineOverride: null, description: 'Base', components: [sized('sre_55_64', 700, 400)] },
      delta: 0, state: 'priced',
    }
    render(<LayerTable categoryId="hrv" line={hrvLine} baselineName="Typical Tier 2" unitLabel="each" onOverride={onOverride} onLineOverride={() => {}} quantityDisplay="1" />)
    const row = screen.getByRole('row', { name: /hrv unit/i })
    fireEvent.click(within(row).getAllByRole('button', { name: /Override/ })[0])
    fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '950' } })
    fireEvent.keyDown(within(row).getByRole('spinbutton'), { key: 'Enter' })
    expect(onOverride).toHaveBeenCalledWith('design', 'hrv_unit', 'sre_65_75@45', 'material', 950)
  })

  it('shows component cells under an active line override as dormant, not overridden', () => {
    const lineDesign = {
      ...design, lineOverride: 10, lineKey: 'design/aboveGroundWalls/__line',
      components: [comp('framing', 'stud_2x6_16oc', 18, 22), comp('continuous_insulation', 'isocyanurate_2in', 30, 9, { overridden: { material: true, labour: false } }), comp('cladding', 'vinyl_siding', 5, 7)],
    }
    const withLine = { ...line, design: lineDesign }
    render(<LayerTable categoryId="aboveGroundWalls" line={withLine} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={() => {}} onLineOverride={() => {}} quantityDisplay="1,830 sq ft" />)
    const ci = screen.getByRole('row', { name: /continuous insulation/i })
    const designMaterial = within(ci).getByRole('button', { name: 'Override This design continuous insulation material' }).closest('.price-cell')
    expect(designMaterial).not.toHaveClass('overridden')
    expect(designMaterial).toHaveClass('dormant')
    expect(screen.getAllByText('line price in use')).toHaveLength(1)
  })

  it('counts the changed prices on the card and resets them all (R36)', () => {
    const onResetCard = vi.fn()
    const { rerender } = render(<LayerTable categoryId="aboveGroundWalls" line={line} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={() => {}} onLineOverride={() => {}} quantityDisplay="1,830 sq ft" changedCount={0} onResetCard={onResetCard} />)
    expect(screen.queryByText(/You've changed/)).toBeNull()
    rerender(<LayerTable categoryId="aboveGroundWalls" line={line} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={() => {}} onLineOverride={() => {}} quantityDisplay="1,830 sq ft" changedCount={1} onResetCard={onResetCard} />)
    expect(screen.getByText(/You've changed 1 price on this card/)).toBeInTheDocument()
    rerender(<LayerTable categoryId="aboveGroundWalls" line={line} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={() => {}} onLineOverride={() => {}} quantityDisplay="1,830 sq ft" changedCount={3} onResetCard={onResetCard} />)
    expect(screen.getByText(/You've changed 3 prices on this card/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'reset all' }))
    expect(onResetCard).toHaveBeenCalledTimes(1)
  })
})
