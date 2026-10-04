import { render, screen, fireEvent, within } from '@testing-library/react'
import SpecificsTable from './SpecificsTable'
import { scenario } from '../costing/__testing__/scenario'
import { buildSpecifics } from '../costing/specifics'

const setup = (args, id) => { const s = scenario(args); const line = s.line(id); return { line, model: buildSpecifics(line, s.ctx), name: s.ctx.baselineName } }
const walls = (overrides = {}) => setup({ wallSelection: { simpleIndex: 4 }, overrides }, 'aboveGroundWalls')
const renderTable = (t, props = {}) => render(<SpecificsTable model={t.model} line={t.line} baselineName={t.name} {...props} />)
const row = name => screen.getByRole('row', { name })

describe('SpecificsTable read, wide', () => {
  it('every layer is a row; differing rows are marked, same rows say "same"; one-sided rows say "none"', () => {
    renderTable(walls())
    expect(screen.getByTestId('specifics-aboveGroundWalls')).toBeInTheDocument()
    expect(row('Cavity insulation')).toHaveClass('differs')
    expect(row('Framing')).toHaveClass('same')
    expect(within(row('Framing')).getByText('same')).toBeInTheDocument()
    expect(within(row('Strapping')).getByText('none')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Layer', 'This design', 'Typical Tier 2', 'Difference'])
    expect(within(row('total')).getByText(/^x [\d,]+ sq ft$/)).toBeInTheDocument()
    expect(screen.getByText('costs more')).toBeInTheDocument()
    expect(screen.queryByText(/LEEP|placeholder/)).toBeNull()
  })
  it('specification rows come first under their own headings', () => {
    renderTable(setup({ selections: { hrv: 2 } }, 'hrv'))
    expect(screen.getByText('Specification')).toBeInTheDocument()
    expect(screen.getByText('Priced, supplied and installed')).toBeInTheDocument()
    expect(row('Sensible recovery efficiency')).toHaveClass('differs')
    expect(row('Airflow needed')).toHaveClass('same')
  })
  it('walls have no specification headings', () => {
    renderTable(walls())
    expect(screen.queryByText('Specification')).toBeNull()
  })
  it('a line price in use is stated under the table (Review Focus 1)', () => {
    renderTable(walls({ 'design/aboveGroundWalls/__line': { line: 100 } }))
    expect(screen.getByText('Your own price per sq ft of wall is in use for This design; the rows show the prices it replaces.')).toBeInTheDocument()
  })
})

describe('SpecificsTable read, narrow', () => {
  it('no table: same rows on one line, differing rows show both houses', () => {
    const { container } = renderTable(walls(), { narrow: true })
    expect(container.querySelector('table')).toBeNull()
    const framing = container.querySelector('[data-row="framing"]')
    expect(framing).toHaveTextContent('same')
    const cavity = container.querySelector('[data-row="cavity_insulation"]')
    expect(within(cavity).getByText('This design')).toBeInTheDocument()
    expect(within(cavity).getByText('Typical Tier 2')).toBeInTheDocument()
    expect(container.querySelector('.narrow-total')).toHaveTextContent('Difference')
  })
})

describe('SpecificsTable edit', () => {
  it('a same row edits both houses by default; a differing row edits one', () => {
    const onOverride = vi.fn()
    renderTable(walls(), { editing: true, onOverride })
    const framing = screen.getByRole('spinbutton', { name: 'This design framing material' })
    expect(framing).toHaveValue(0.63)
    fireEvent.change(framing, { target: { value: '2.5' } })
    fireEvent.keyDown(framing, { key: 'Enter' })
    expect(onOverride).toHaveBeenCalledWith('both', 'framing', 'stud_2x6_16oc', 'material', 2.5)
    const ci = screen.getByRole('spinbutton', { name: 'This design continuous insulation material' })
    fireEvent.change(ci, { target: { value: '3' } })
    fireEvent.keyDown(ci, { key: 'Enter' })
    expect(onOverride).toHaveBeenLastCalledWith('design', 'continuous_insulation', 'isocyanurate_1_5in', 'material', 3)
  })
  it('"this house only" splits a same row into two pairs of fields', () => {
    renderTable(walls(), { editing: true })
    expect(screen.queryByRole('spinbutton', { name: 'Typical Tier 2 framing material' })).toBeNull()
    fireEvent.click(within(row('Framing')).getByRole('button', { name: 'this house only' }))
    expect(screen.getByRole('spinbutton', { name: 'Typical Tier 2 framing material' })).toBeInTheDocument()
  })
  it('sends the priced-item id for a sized row (R25)', () => {
    const onOverride = vi.fn()
    renderTable(setup({ selections: { hrv: 2 } }, 'hrv'), { editing: true, onOverride })
    const f = screen.getByRole('spinbutton', { name: 'This design HRV unit material' })
    fireEvent.change(f, { target: { value: '950' } })
    fireEvent.keyDown(f, { key: 'Enter' })
    expect(onOverride).toHaveBeenCalledWith('design', 'hrv', 'sre_75_84@45', 'material', 950)
    expect(screen.queryByText('Sensible recovery efficiency')).toBeNull()
  })
  it('doors stay per each in a sq ft table', () => {
    const onOverride = vi.fn()
    renderTable(setup({ selections: { windowsDoors: 1 } }, 'windowsDoors'), { editing: true, onOverride })
    const door = screen.getByRole('spinbutton', { name: 'This design exterior doors material' })
    expect(door).toHaveValue(1300)
    fireEvent.change(door, { target: { value: '950' } })
    fireEvent.keyDown(door, { key: 'Enter' })
    expect(onOverride).toHaveBeenCalledWith('design', 'doors', 'u_1_22', 'material', 950)
  })
  it('fields under an active line price are dormant (R26 carry)', () => {
    renderTable(walls({ 'design/aboveGroundWalls/__line': { line: 100 } }), { editing: true })
    expect(screen.getByRole('spinbutton', { name: 'This design continuous insulation material' }).closest('.price-field')).toHaveClass('dormant')
    expect(screen.getAllByText('line price in use')).toHaveLength(1)
  })
  it('counts changed prices on the card and resets them all (R36)', () => {
    const onResetCard = vi.fn()
    const t = walls()
    const { rerender } = renderTable(t, { editing: true, changedCount: 0, onResetCard })
    expect(screen.queryByText(/You've changed/)).toBeNull()
    rerender(<SpecificsTable model={t.model} line={t.line} baselineName={t.name} editing changedCount={2} onResetCard={onResetCard} />)
    expect(screen.getByText(/You've changed 2 prices on this card/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'reset all' }))
    expect(onResetCard).toHaveBeenCalledTimes(1)
  })
  it('the line field rejects negatives, commits on Enter, shows an active price and clears when it goes (R37)', () => {
    const onLineOverride = vi.fn()
    const t = walls()
    const { rerender } = renderTable(t, { editing: true, onLineOverride })
    const field = () => screen.getByRole('spinbutton', { name: 'I pay this much per sq ft of wall for This design' })
    fireEvent.change(field(), { target: { value: '-4' } })
    fireEvent.blur(field())
    expect(onLineOverride).not.toHaveBeenCalled()
    fireEvent.change(field(), { target: { value: '9' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onLineOverride).toHaveBeenCalledWith('design', 9)
    const active = walls({ 'design/aboveGroundWalls/__line': { line: 107.6391042 } })   // $10 per sq ft
    rerender(<SpecificsTable model={active.model} line={active.line} baselineName={active.name} editing onLineOverride={onLineOverride} />)
    expect(field()).toHaveValue(10)
    rerender(<SpecificsTable model={t.model} line={t.line} baselineName={t.name} editing onLineOverride={onLineOverride} />)
    expect(field()).toHaveValue(null)
  })
  it('line field words per category', () => {
    renderTable(setup({ selections: { hrv: 2 } }, 'hrv'), { editing: true })
    expect(screen.getByRole('spinbutton', { name: 'I pay this much per HRV, installed for This design' })).toBeInTheDocument()
  })
  it('narrow edit: one block per priced row', () => {
    const { container } = renderTable(walls(), { editing: true, narrow: true })
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelectorAll('.edit-block')).toHaveLength(8)
    expect(screen.getAllByText('Both houses').length).toBe(5)
  })
})

// Ported from LayerTable (R37): reset clears the key that supplied the value.
describe('SpecificsTable reset targets (R37)', () => {
  const KEY = (side, comp, opt) => `${side}/aboveGroundWalls/${comp}/${opt}`
  const comp = (component, option, material, extra = {}) => ({ component, option, priceId: option, label: option, unit: 'm2', quantity: 100, material, labour: 22, overridden: { material: false, labour: false }, overrideKeys: { material: null, labour: null }, ...extra })
  const ov = side => ({ overridden: { material: true, labour: false }, overrideKeys: { material: KEY(side, 'framing', 'stud_2x6_16oc'), labour: null } })
  const lineWith = (d, b) => ({ categoryId: 'aboveGroundWalls', state: 'priced', design: { state: 'priced', unit: 'm2', quantity: 100, perUnit: 0, cost: 0, lineOverride: null, lineKey: null, description: 'D', components: [d] }, baseline: { state: 'priced', unit: 'm2', quantity: 100, perUnit: 0, cost: 0, lineOverride: null, lineKey: null, description: 'B', components: [b] } })
  const ctx = { baselineName: 'Typical Tier 2', houseFields: { lengthFt: 33, widthFt: 30 }, typeName: 'Single detached' }
  const show = (line, onOverride) => render(<SpecificsTable model={buildSpecifics(line, ctx)} line={line} baselineName="Typical Tier 2" editing onOverride={onOverride} />)
  const resetDesign = () => fireEvent.click(screen.getByRole('button', { name: 'Reset This design framing material' }))

  it('after "this house only", reset still clears the both key that supplied it', () => {
    const onOverride = vi.fn()
    const f = comp('framing', 'stud_2x6_16oc', 25, ov('both'))
    show(lineWith(f, f), onOverride)
    fireEvent.click(screen.getByRole('button', { name: 'this house only' }))
    resetDesign()
    expect(onOverride).toHaveBeenCalledTimes(1)
    expect(onOverride).toHaveBeenCalledWith('both', 'framing', 'stud_2x6_16oc', 'material', undefined)
  })
  it('on a differing row, reset clears a both key that supplied this side', () => {
    const onOverride = vi.fn()
    show(lineWith(comp('framing', 'stud_2x6_16oc', 25, ov('both')), comp('framing', 'stud_2x6_16oc', 30, ov('baseline'))), onOverride)
    resetDesign()
    expect(onOverride).toHaveBeenCalledTimes(1)
    expect(onOverride).toHaveBeenCalledWith('both', 'framing', 'stud_2x6_16oc', 'material', undefined)
  })
  it('on a same row, reset clears each distinct side key', () => {
    const onOverride = vi.fn()
    show(lineWith(comp('framing', 'stud_2x6_16oc', 25, ov('design')), comp('framing', 'stud_2x6_16oc', 25, ov('baseline'))), onOverride)
    resetDesign()
    expect(onOverride).toHaveBeenCalledTimes(2)
    expect(onOverride).toHaveBeenCalledWith('design', 'framing', 'stud_2x6_16oc', 'material', undefined)
    expect(onOverride).toHaveBeenCalledWith('baseline', 'framing', 'stud_2x6_16oc', 'material', undefined)
  })
})

describe('SpecificsTable edit, same-displayed rows with different price ids (final review F1)', () => {
  const hpwh = () => setup({ selections: { dhwElectric: 0 } }, 'dhw')
  it('"applies to both" on the 240 V circuit of a heat pump vs electric storage edits both price ids', () => {
    const onOverride = vi.fn()
    renderTable(hpwh(), { editing: true, onOverride })
    const f = screen.getByRole('spinbutton', { name: 'This design 240 V circuit labour' })
    fireEvent.change(f, { target: { value: '400' } })
    fireEvent.keyDown(f, { key: 'Enter' })
    expect(onOverride).toHaveBeenCalledWith('both', 'circuit_240v', 'heat_pump', 'labour', 400)
    expect(onOverride).toHaveBeenCalledWith('both', 'circuit_240v', 'elec_storage', 'labour', 400)
    expect(onOverride).toHaveBeenCalledTimes(2)
  })
  it('reset on that both-pair clears the override under both price ids', () => {
    const onOverride = vi.fn()
    const t = setup({ selections: { dhwElectric: 0 }, overrides: { 'both/dhw/circuit_240v/heat_pump': { labour: 400 }, 'both/dhw/circuit_240v/elec_storage': { labour: 400 } } }, 'dhw')
    renderTable(t, { editing: true, onOverride })
    fireEvent.click(screen.getByRole('button', { name: 'Reset This design 240 V circuit labour' }))
    expect(onOverride).toHaveBeenCalledWith('both', 'circuit_240v', 'heat_pump', 'labour', undefined)
    expect(onOverride).toHaveBeenCalledWith('both', 'circuit_240v', 'elec_storage', 'labour', undefined)
  })
})
