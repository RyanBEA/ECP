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

  // Fix round 1 (ruling R37).
  const KEY = (side, component, option) => `${side}/aboveGroundWalls/${component}/${option}`
  const ov = side => ({ overridden: { material: true, labour: false }, overrideKeys: { material: KEY(side, 'framing', 'stud_2x6_16oc'), labour: null } })
  const withFraming = (d, b) => ({ ...line, design: { ...design, components: [d, ...design.components.slice(1)] }, baseline: { ...baseline, components: [b, ...baseline.components.slice(1)] } })
  const props = { categoryId: 'aboveGroundWalls', baselineName: 'Typical Tier 2', unitLabel: 'sq ft', onLineOverride: () => {}, quantityDisplay: '1,830 sq ft' }
  const resetDesignFraming = () => fireEvent.click(within(screen.getByRole('row', { name: /framing/i })).getByRole('button', { name: 'Reset This design framing material' }))

  it('reset clears the key that supplied the value, even after "this house only" (R37)', () => {
    const onOverride = vi.fn()
    const f = comp('framing', 'stud_2x6_16oc', 25, 22, ov('both'))
    render(<LayerTable {...props} line={withFraming(f, f)} onOverride={onOverride} />)
    fireEvent.click(screen.getByRole('button', { name: /2 identical layers/ }))
    fireEvent.click(within(screen.getByRole('row', { name: /framing/i })).getByRole('button', { name: 'this house only' }))
    resetDesignFraming()
    expect(onOverride).toHaveBeenCalledTimes(1)
    expect(onOverride).toHaveBeenCalledWith('both', 'framing', 'stud_2x6_16oc', 'material', undefined)
  })
  it('reset on a differing row clears a both key that supplied this side (R37)', () => {
    const onOverride = vi.fn()
    render(<LayerTable {...props} line={withFraming(comp('framing', 'stud_2x6_16oc', 25, 22, ov('both')), comp('framing', 'stud_2x6_16oc', 30, 22, ov('baseline')))} onOverride={onOverride} />)
    resetDesignFraming()
    expect(onOverride).toHaveBeenCalledTimes(1)
    expect(onOverride).toHaveBeenCalledWith('both', 'framing', 'stud_2x6_16oc', 'material', undefined)
  })
  it('reset on an identical row clears each distinct supplying side key (R37)', () => {
    const onOverride = vi.fn()
    render(<LayerTable {...props} line={withFraming(comp('framing', 'stud_2x6_16oc', 25, 22, ov('design')), comp('framing', 'stud_2x6_16oc', 25, 22, ov('baseline')))} onOverride={onOverride} />)
    fireEvent.click(screen.getByRole('button', { name: /2 identical layers/ }))
    resetDesignFraming()
    expect(onOverride).toHaveBeenCalledTimes(2)
    expect(onOverride).toHaveBeenCalledWith('design', 'framing', 'stud_2x6_16oc', 'material', undefined)
    expect(onOverride).toHaveBeenCalledWith('baseline', 'framing', 'stud_2x6_16oc', 'material', undefined)
  })

  const door = () => comp('doors', 'door_std', 900, 350, { unit: 'each', quantity: 2, label: 'exterior doors' })
  const winLine = {
    categoryId: 'windowsDoors', name: 'Windows and doors', delta: 1200, state: 'priced',
    // design: 400 $/m2 x 20 m2 + 2 doors x 1,250 = 10,500; baseline: 340 x 20 + 2,500 = 9,300
    design: { state: 'priced', unit: 'm2', quantity: 20, perUnit: 400, cost: 10500, lineOverride: null, lineKey: null, description: 'U 1.22', components: [comp('windows', 'u_1_22', 300, 100, { quantity: 20 }), door()] },
    baseline: { state: 'priced', unit: 'm2', quantity: 20, perUnit: 340, cost: 9300, lineOverride: null, lineKey: null, description: 'U 1.6', components: [comp('windows', 'u_1_6', 250, 90, { quantity: 20 }), door()] },
  }
  it('shows doors in a sq ft table as their own each row, unconverted, so the parts add up (R37)', () => {
    const onOverride = vi.fn()
    render(<LayerTable categoryId="windowsDoors" line={winLine} baselineName="Typical Tier 2" unitLabel="sq ft" onOverride={onOverride} onLineOverride={() => {}} quantityDisplay="215 sq ft" />)
    // the identical door row is not collapsed: only line-unit rows count as identical layers
    expect(screen.queryByRole('button', { name: /identical layer/ })).toBeNull()
    const row = screen.getByRole('row', { name: /doors/i })
    expect(within(row).getAllByText('$900.00')).toHaveLength(2)
    expect(within(row).getAllByText('$350.00')).toHaveLength(2)
    expect(within(row).getAllByText('2 each x $1,250.00 = $2,500')).toHaveLength(2)
    expect(within(row).getAllByText('each').length).toBeGreaterThanOrEqual(4)
    // per sq ft x quantity + doors = cost: 400 $/m2 is $37.16 per sq ft; 37.16 x 215 + 2,500 ~ 10,500
    expect(within(screen.getByRole('row', { name: /per sq ft installed/ })).getByText('$37.16')).toBeInTheDocument()
    const total = screen.getByRole('row', { name: /x 215 sq ft/ })
    expect(within(total).getByText('$10,500')).toBeInTheDocument()
    expect(within(total).getByText('$9,300')).toBeInTheDocument()
    fireEvent.click(within(row).getAllByRole('button', { name: /Override/ })[0])
    expect(within(row).getByRole('spinbutton')).toHaveValue(900)
    fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '950' } })
    fireEvent.keyDown(within(row).getByRole('spinbutton'), { key: 'Enter' })
    expect(onOverride).toHaveBeenCalledWith('both', 'doors', 'door_std', 'material', 950)
  })

  it('collapses only line-unit rows and matches identical rows on priced-item id and unit (R37)', () => {
    const sized = comp('framing', 'stud_2x6_16oc', 18, 22, { priceId: 'stud_2x6_16oc@a' })
    const sized2 = comp('framing', 'stud_2x6_16oc', 18, 22, { priceId: 'stud_2x6_16oc@b' })
    render(<LayerTable {...props} line={withFraming(sized, sized2)} onOverride={() => {}} />)
    expect(screen.getByRole('row', { name: /framing/i })).toHaveClass('differs')
    expect(screen.getByRole('button', { name: /1 identical layer,/ })).toBeInTheDocument()
  })

  it('line field rejects negatives, commits on Enter, shows the active override in display units and clears when it goes away (R37)', () => {
    const onLineOverride = vi.fn()
    const { rerender } = render(<LayerTable {...props} line={line} onOverride={() => {}} onLineOverride={onLineOverride} />)
    const field = () => screen.getByRole('spinbutton', { name: 'I pay this much per sq ft for This design' })
    fireEvent.change(field(), { target: { value: '-4' } })
    fireEvent.blur(field())
    expect(onLineOverride).not.toHaveBeenCalled()
    fireEvent.change(field(), { target: { value: '9' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onLineOverride).toHaveBeenCalledWith('design', 9)
    // active override of 107.6391042 $/m2 is $10 per sq ft
    const active = { ...line, design: { ...design, lineOverride: 107.6391042, perUnit: 107.6391042, lineKey: 'design/aboveGroundWalls/__line' } }
    rerender(<LayerTable {...props} line={active} onOverride={() => {}} onLineOverride={onLineOverride} />)
    expect(field()).toHaveValue(10)
    fireEvent.change(field(), { target: { value: '7' } })
    rerender(<LayerTable {...props} line={line} onOverride={() => {}} onLineOverride={onLineOverride} />)
    expect(field()).toHaveValue(null)
  })

  it('says per unit for each and per house for house', () => {
    const { rerender } = render(<LayerTable {...props} unitLabel="each" line={line} onOverride={() => {}} />)
    expect(screen.getByRole('spinbutton', { name: 'I pay this much per unit for This design' })).toBeInTheDocument()
    expect(screen.getByText('per unit installed')).toBeInTheDocument()
    rerender(<LayerTable {...props} unitLabel="house" line={line} onOverride={() => {}} />)
    expect(screen.getByRole('spinbutton', { name: 'I pay this much per house for This design' })).toBeInTheDocument()
    expect(screen.getByText('per house installed')).toBeInTheDocument()
  })
})
