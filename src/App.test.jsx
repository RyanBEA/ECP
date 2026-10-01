import { render, screen, fireEvent, within } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import App from './App'
import { STORAGE_KEY, DEFAULT_PERSISTED } from './costing/persist'

const pickVentilation75 = () => {
  const vent = screen.getByText('Ventilation').closest('.category-card')
  fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
}

describe('App with the cost tab', () => {
  beforeEach(() => { localStorage.clear(); window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })) })

  it('first visit: Points tab, no chip, footer button reads "What does this cost?"', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Points' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: /Cost details:/ })).toBeNull()
    pickVentilation75()
    expect(screen.getByRole('button', { name: 'What does this cost? ->' })).toBeEnabled()
  })
  it('opening Cost shows the chip on Points afterwards, remembers it, and hide removes it', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('button', { name: 'What does this cost? ->' }))
    expect(screen.getByRole('tab', { name: 'Cost' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Points' }))
    expect(screen.getByRole('button', { name: /Cost details:/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cost details ->' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).hasOpenedCost).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hide cost from the Points tab' }))
    expect(screen.queryByRole('button', { name: /Cost details:/ })).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).chipHidden).toBe(true)
  })
  it('the chip recalculates on a pick and clicking it opens Cost', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, hasOpenedCost: true, chipHidden: false, houseType: 'singleDetached', baselineChoice: 'typicalTier2', fieldOverrides: {}, usualHouse: {}, overrides: {} }))
    render(<App />)
    const before = screen.getByRole('button', { name: /Cost details:/ }).textContent
    pickVentilation75()
    expect(screen.getByRole('button', { name: /Cost details:/ }).textContent).not.toBe(before)
    fireEvent.click(screen.getByRole('button', { name: /Cost details:/ }))
    expect(screen.getByRole('tab', { name: 'Cost' })).toHaveAttribute('aria-selected', 'true')
  })
  it('the usual-house flow: open editor, change, Done, headline says Your usual house; tab bar inert while editing (Review Focus 1)', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.change(screen.getByLabelText('Compared with'), { target: { value: 'usualHouse' } })
    expect(screen.getByText(/Cost > Your usual house/)).toBeInTheDocument()
    const vent = within(document.querySelector('.baseline-editor')).getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /60/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Points' }))
    expect(screen.getByText(/Cost > Your usual house/)).toBeInTheDocument()   // still editing
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('heading', { level: 2, name: /Your usual house/ })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).usualHouse.singleDetached.cards.hrv).toBe(60)
  })
  it('Cancel on a first open returns the dropdown to its previous choice', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.change(screen.getByLabelText('Compared with'), { target: { value: 'usualHouse' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Compared with').value).toBe('typicalTier2')
  })
  it('a usual house saved for one type is not applied to another (Review Focus 3)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, hasOpenedCost: true, chipHidden: false, houseType: 'miniHome', baselineChoice: 'usualHouse', fieldOverrides: {}, usualHouse: { miniHome: { cards: { hrv: 75, windowsDoors: 1.61, airTightness: 2, dhwElectric: 'electricStorage' }, wall: null } }, overrides: {} }))
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    expect(screen.getByLabelText('Compared with').value).toBe('usualHouse')
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'rowHome' } })
    expect(screen.getByLabelText('Compared with').value).toBe('typicalTier2')
  })
  it('print media hides the tab bar, cost tab and editor', () => {
    const css = fs.readFileSync(path.resolve(__dirname, 'App.css'), 'utf8')
    const print = css.slice(css.indexOf('@media print'))
    for (const sel of ['.tab-bar', '.cost-tab', '.baseline-editor', '.cost-chip-wrap']) expect(print).toContain(sel)
  })
})

describe('App with the cost tab: controller-mandated checks (Task 15 notes)', () => {
  beforeEach(() => { localStorage.clear(); window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })) })

  it('the Points categories container renders identically with the chip hidden and shown (spec 9)', () => {
    const first = render(<App />)
    expect(screen.queryByRole('button', { name: /Cost details:/ })).toBeNull()
    const withoutChip = first.container.querySelector('.categories-container').outerHTML
    first.unmount()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, hasOpenedCost: true }))
    const second = render(<App />)
    expect(screen.getByRole('button', { name: /Cost details:/ })).toBeInTheDocument()
    expect(second.container.querySelector('.categories-container').outerHTML).toBe(withoutChip)
  })
  it('a stored blob with the right schema version but usualHouse null loads as a first visit, without throwing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, usualHouse: null }))
    expect(() => render(<App />)).not.toThrow()
    expect(screen.queryByRole('button', { name: /Cost details:/ })).toBeNull()
    pickVentilation75()
    expect(screen.getByRole('button', { name: 'What does this cost? ->' })).toBeEnabled()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    expect(screen.getByLabelText('Compared with').value).toBe('typicalTier2')
    expect(screen.getByRole('heading', { level: 2, name: /Typical Tier 2/ })).toBeInTheDocument()
  })
  it("a card's reset all (R36) removes only that category's overrides", () => {
    const overrides = {
      'design/hrv/__line': { line: 5000 },
      'baseline/aboveGroundWalls/__line': { line: 20 },
      'both/windowsDoors/windows/u161': { material: 1 },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, hasOpenedCost: true, overrides }))
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Ventilation/ }))
    fireEvent.click(screen.getByRole('button', { name: 'see parts' }))
    const table = screen.getByTestId('layer-table-hrv')
    expect(within(table).getByText(/You've changed 1 price on this card/)).toBeInTheDocument()
    fireEvent.click(within(table).getByRole('button', { name: 'reset all' }))
    expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)).overrides).sort()).toEqual(['baseline/aboveGroundWalls/__line', 'both/windowsDoors/windows/u161'])
    expect(within(screen.getByTestId('layer-table-hrv')).queryByText(/You've changed/)).toBeNull()
  })
  it('the two panels are tabpanels labelled by their tabs, and the tabs point at them', () => {
    render(<App />)
    const points = document.getElementById('panel-points')
    const cost = document.getElementById('panel-cost')
    expect(points).toHaveAttribute('role', 'tabpanel')
    expect(points).toHaveAttribute('aria-labelledby', 'tab-points')
    expect(cost).toHaveAttribute('role', 'tabpanel')
    expect(cost).toHaveAttribute('aria-labelledby', 'tab-cost')
    expect(screen.getByRole('tab', { name: 'Points' })).toHaveAttribute('aria-controls', 'panel-points')
    expect(screen.getByRole('tab', { name: 'Cost' })).toHaveAttribute('aria-controls', 'panel-cost')
    expect(points).not.toHaveAttribute('hidden')
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    expect(points).toHaveAttribute('hidden')
    expect(document.querySelector('#panel-points .categories-container')).not.toBeNull()   // Points stays mounted (spec 2.1)
  })
  it('Cancel with unsaved changes asks before discarding them (spec 5)', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.change(screen.getByLabelText('Compared with'), { target: { value: 'usualHouse' } })
    const vent = within(document.querySelector('.baseline-editor')).getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(confirm).toHaveBeenCalledWith('Discard changes to your usual house?')
    expect(screen.getByText(/Cost > Your usual house/)).toBeInTheDocument()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Cost > Your usual house/)).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).usualHouse).toEqual({})
    confirm.mockRestore()
  })
})
