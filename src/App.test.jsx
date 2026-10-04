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
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
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
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('radio', { name: 'Typical Tier 2' })).toBeChecked()
  })
  it('a usual house saved for one type is not applied to another (Review Focus 3)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, hasOpenedCost: true, chipHidden: false, houseType: 'miniHome', baselineChoice: 'usualHouse', fieldOverrides: {}, usualHouse: { miniHome: { cards: { hrv: 75, windowsDoors: 1.61, airTightness: 2, dhwElectric: 'electricStorage' }, wall: null } }, overrides: {} }))
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    expect(screen.getByRole('radio', { name: 'My usual house' })).toBeChecked()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'rowHome' } })
    expect(screen.getByRole('radio', { name: 'Typical Tier 2' })).toBeChecked()
  })
  it('print media hides the tab bar, cost tab and editor', () => {
    const css = fs.readFileSync(path.resolve(__dirname, 'App.css'), 'utf8')
    const print = css.slice(css.indexOf('@media print'))
    for (const sel of ['.tab-bar', '.cost-tab', '.baseline-editor', '.cost-chip-wrap']) expect(print).toContain(sel)
  })
  it('rev 3: "view" on a preset pick opens the read-only editor; Back returns to the statement (Review Focus 5)', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^What Typical Tier 2 includes/ }))
    fireEvent.click(screen.getByRole('button', { name: 'view Ventilation' }))
    expect(screen.getByText(/Cost > Typical Tier 2/)).toBeInTheDocument()
    expect(screen.getByText('This is Typical Tier 2.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Cost' }))
    expect(screen.getByRole('heading', { level: 2, name: /Typical Tier 2/ })).toBeInTheDocument()
  })
  it('rev 3: Go to Points switches to the Points tab', () => {
    render(<App />)
    const wall = document.querySelector('#panel-points .wall-builder')
    fireEvent.click(within(wall).getByRole('button', { name: 'Select RSI' }))
    fireEvent.click(within(wall).getAllByRole('button', { name: /4\.29/ })[0])
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Above-ground walls/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to Points' }))
    expect(screen.getByRole('tab', { name: 'Points' })).toHaveAttribute('aria-selected', 'true')
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
    expect(screen.getByRole('radio', { name: 'Typical Tier 2' })).toBeChecked()
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
    fireEvent.click(screen.getByRole('button', { name: /^Flow rates and SRE/ }))
    fireEvent.click(screen.getByRole('button', { name: /Use my own prices/ }))
    const table = screen.getByTestId('specifics-hrv')
    expect(within(table).getByText(/You've changed 1 price on this card/)).toBeInTheDocument()
    fireEvent.click(within(table).getByRole('button', { name: 'reset all' }))
    expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)).overrides).sort()).toEqual(['baseline/aboveGroundWalls/__line', 'both/windowsDoors/windows/u161'])
    expect(within(screen.getByTestId('specifics-hrv')).queryByText(/You've changed/)).toBeNull()
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
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
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
  it('a switch of tab or editor brings the tab bar back into view when it has scrolled off the top (browser walk)', () => {
    render(<App />)
    pickVentilation75()
    const bar = document.querySelector('.tab-bar')
    const scroll = vi.fn()
    bar.scrollIntoView = scroll
    bar.getBoundingClientRect = () => ({ top: -1200, bottom: -1150, left: 0, right: 0, width: 0, height: 50 })
    fireEvent.click(screen.getByRole('button', { name: 'What does this cost? ->' }))
    expect(scroll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(scroll).toHaveBeenCalledTimes(2)
    bar.getBoundingClientRect = () => ({ top: 10, bottom: 60, left: 0, right: 0, width: 0, height: 50 })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(scroll).toHaveBeenCalledTimes(2)   // already in view: no jump
  })
})

// Final fix wave (ruling R45)
describe('App Type change, notice and level 3 (R45)', () => {
  beforeEach(() => { localStorage.clear(); window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })) })
  const NOTICE = 'House type changed; your changed fields were reset to the new type.'

  it('change Storeys, then Type: "changed" goes and the notice shows; the next field change clears the notice', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.change(screen.getByLabelText('Storeys'), { target: { value: '3' } })
    expect(screen.getByText('changed')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'rowHome' } })
    expect(screen.queryByText('changed')).toBeNull()
    expect(screen.getByText(NOTICE)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Length (ft)'), { target: { value: '40' } })
    expect(screen.queryByText(NOTICE)).toBeNull()
  })
  it('with a usual house saved for Single detached, Row home and back keeps "My usual house" selected', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, hasOpenedCost: true, houseType: 'singleDetached', baselineChoice: 'usualHouse',
      usualHouse: { singleDetached: { cards: { hrv: 60 }, wall: null } } }))
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    const usual = () => screen.getByRole('radio', { name: 'My usual house' })
    expect(usual()).toBeChecked()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'rowHome' } })
    expect(screen.getByRole('radio', { name: 'Typical Tier 2' })).toBeChecked()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'singleDetached' } })
    expect(usual()).toBeChecked()
    expect(screen.getByRole('button', { name: /^edit/ })).toBeInTheDocument()
  })
  it('walls specifics stay open through opening and cancelling the baseline editor', () => {
    render(<App />)
    const wall = document.querySelector('#panel-points .wall-builder')
    fireEvent.click(within(wall).getByRole('button', { name: 'Select RSI' }))
    fireEvent.click(within(wall).getAllByRole('button', { name: /3\.96/ })[0])
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Above-ground walls/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }))
    expect(screen.getByTestId('specifics-aboveGroundWalls')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(screen.getByText(/Cost > Your usual house/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Cost > Your usual house/)).toBeNull()
    expect(screen.getByTestId('specifics-aboveGroundWalls')).toBeInTheDocument()
  })
})

describe('App keeps disclosures open across the baseline editor (final review F2)', () => {
  it('"What Typical Tier 2 includes" is still open after view then Back to Cost', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    const includes = () => screen.getByRole('button', { name: /^What Typical Tier 2 includes/ })
    fireEvent.click(includes())
    expect(includes()).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'view Ventilation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to Cost' }))
    expect(includes()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'view Ventilation' })).toBeInTheDocument()
  })
})
