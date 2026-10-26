import { render, screen, within } from '@testing-library/react'
import VariantTable from './VariantTable'
import { scenario } from '../costing/__testing__/scenario'
import { buildSpecifics, dollars } from '../costing/specifics'
import { categories } from '../data/ecpData'
import house from '../costing/data/round1-test-house.json'

const wallIndex = categories.find(c => c.id === 'aboveGroundWalls').options.findIndex(o => o.value === 4.73)
const picks = { windowsDoors: 1, dhwElectric: 0 }
const setup = (id, overrides = {}) => {
  const s = scenario({ selections: picks, wallSelection: { simpleIndex: wallIndex }, overrides })
  const line = s.line(id)
  return { line, model: buildSpecifics(line, s.ctx), name: s.ctx.baselineName }
}
const renderVariant = (variant, id, overrides) => {
  const t = setup(id, overrides)
  render(<VariantTable variant={variant} model={t.model} line={t.line} baselineName={t.name} />)
  return t
}
const row = name => screen.getByRole('row', { name })

describe('VariantTable', () => {
  it('A walls: one row, per sq ft figures match the test-house file', () => {
    renderVariant('a', 'aboveGroundWalls')
    const w = house.lines.aboveGroundWalls
    const perSqFtRows = screen.getAllByRole('row').filter(r => r.textContent.startsWith('Per sq ft installed'))
    expect(perSqFtRows).toHaveLength(1)
    const perSqFt = perSqFtRows[0]
    const cells = within(perSqFt).getAllByRole('cell').map(c => c.textContent)
    expect(cells[1]).toBe(`$${w.designPerSqFt.toFixed(2)}`)
    expect(cells[2]).toBe(`$${w.baselinePerSqFt.toFixed(2)}`)
    expect(within(row('total')).getByText(w.quantityText)).toBeInTheDocument()
    expect(row('total')).toHaveTextContent(dollars(w.designCost))
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Item', 'This design', 'Typical Tier 2', 'Difference'])
    expect(screen.getByTestId('variant-a-aboveGroundWalls')).toBeInTheDocument()
  })
  it('B walls: trade rows in order, unchanged trades say same', () => {
    renderVariant('b', 'aboveGroundWalls')
    for (const t of ['Framer', 'Insulator', 'Drywaller', 'Siding']) expect(row(t)).toBeInTheDocument()
    expect(row('Insulator')).toHaveClass('same')
    expect(within(row('Insulator')).getByText('same')).toBeInTheDocument()
    expect(row('Framer')).toHaveClass('differs')
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Trade')
    expect(screen.getByTestId('variant-b-aboveGroundWalls')).toBeInTheDocument()
  })
  it('B walls: trade rows carry the unit, footer stays plain', () => {
    renderVariant('b', 'aboveGroundWalls')
    const w = house.lines.aboveGroundWalls
    const framer = within(row('Framer')).getAllByRole('cell').map(c => c.textContent)
    expect(framer[1]).toBe('$16.49 / sq ft')
    const foot = screen.getAllByRole('row').find(r => r.textContent.startsWith('Per sq ft installed'))
    const cells = within(foot).getAllByRole('cell').map(c => c.textContent)
    expect(cells[1]).toBe(`$${w.designPerSqFt.toFixed(2)}`)
    expect(cells[2]).toBe(`$${w.baselinePerSqFt.toFixed(2)}`)
    expect(cells[1]).not.toMatch(/sq ft/)
  })
  it.each(['a', 'b'])('no Layers, no disclosure text under %s', v => {
    renderVariant(v, 'aboveGroundWalls')
    expect(screen.queryByText(/^Layers/)).toBeNull()
    expect(screen.queryByText(/inside to outside/)).toBeNull()
  })
  it('B windows: Framer with the fixed sub-line', () => {
    const t = renderVariant('b', 'windowsDoors')
    expect(within(row('Framer')).getByText('windows and doors, supplied and installed')).toBeInTheDocument()
    expect(t.model.footer.kind).toBe('total')
  })
  it('A DHW: Heater, installed with its parts', () => {
    renderVariant('a', 'dhw')
    expect(row('Heater, installed with its parts')).toBeInTheDocument()
  })
  it('B never prints a raw float', () => {
    renderVariant('b', 'aboveGroundWalls')
    expect(document.body.textContent).not.toMatch(/\d\.\d{3,}/)
  })
  it('line note shown under B', () => {
    renderVariant('b', 'aboveGroundWalls', { 'design/aboveGroundWalls/__line': { line: 100 } })
    expect(screen.getByText(/^Your own price per sq ft of wall is in use/)).toBeInTheDocument()
  })
})
