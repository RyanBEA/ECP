import { render, screen, fireEvent, within } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import App from './App'
import { categories } from './data/ecpData'
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
  it('Points never shows a cost: after visiting Cost there is still no cost chip, and the Cost tab has no "Show cost on Points" option', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('button', { name: 'What does this cost? ->' }))
    expect(screen.getByRole('tab', { name: 'Cost' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('checkbox', { name: /Show cost on Points/ })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Points' }))
    expect(screen.queryByRole('button', { name: /Cost details:/ })).toBeNull()
    expect(document.querySelector('.app-header').textContent).not.toMatch(/\$/)
    expect(screen.getByRole('button', { name: 'Cost details ->' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).hasOpenedCost).toBe(true)
  })
  it('the usual-house flow: the editor opens in a dialog, every pick is saved at once, the live line shows it (Review Focus 1)', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    const dlg = screen.getByRole('dialog', { name: 'Your usual house' })
    const vent = within(dlg).getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /60/ }))
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(saved.usualHouse.singleDetached.cards.hrv).toBe(60)
    expect(saved.baselineChoice).toBe('usualHouse')
    expect(dlg.querySelector('.dialog-sub')).toHaveTextContent(/Your usual house/)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Back to Cost' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: /Your usual house/ })).toBeInTheDocument()
  })
  it('closing a first open with no change saves nothing and keeps the previous choice (Review Focus 1 of iteration 3)', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Your usual house' })).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('radio', { name: 'Typical Tier 2' })).toBeChecked()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).usualHouse).toEqual({})
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
    for (const sel of ['.tab-bar', '.cost-tab', '.baseline-editor', '.dialog']) expect(print).toContain(sel)
  })
  it('"view" on a preset pick opens that card alone, read-only, in a dialog; Close returns (Review Focus 5)', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^What Typical Tier 2 includes/ }))
    fireEvent.click(screen.getByRole('button', { name: 'view Ventilation' }))
    const dlg = screen.getByRole('dialog', { name: 'Ventilation in Typical Tier 2' })
    expect(within(dlg).getByText('Typical Tier 2: HRV 65% SRE.')).toBeInTheDocument()
    expect(document.querySelector('.baseline-editor')).toBeNull()
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
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

  it('the Points categories container renders identically before and after a visit to Cost (spec 9)', () => {
    const first = render(<App />)
    const before = first.container.querySelector('.categories-container').outerHTML
    first.unmount()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, hasOpenedCost: true }))
    const second = render(<App />)
    expect(screen.queryByRole('button', { name: /Cost details:/ })).toBeNull()
    expect(second.container.querySelector('.categories-container').outerHTML).toBe(before)
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
  it('Undo changes on a first open removes the usual house again and restores the previous choice; nothing asks to confirm (Review Focus 2)', () => {
    const confirm = vi.spyOn(window, 'confirm')
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    const dlg = screen.getByRole('dialog', { name: 'Your usual house' })
    const vent = within(dlg).getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).usualHouse.singleDetached.cards.hrv).toBe(75)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Undo changes' }))
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(saved.usualHouse).toEqual({})
    expect(saved.baselineChoice).toBe('typicalTier2')
    expect(within(dlg).queryByRole('button', { name: 'Undo changes' })).toBeNull()
    fireEvent.click(within(dlg).getByRole('button', { name: 'Back to Cost' }))
    expect(screen.getByRole('radio', { name: 'Typical Tier 2' })).toBeChecked()
    expect(confirm).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
  it('Undo changes on a saved usual house restores the saved picks exactly, not Typical Tier 2 (Review Focus 3)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, hasOpenedCost: true, houseType: 'singleDetached', baselineChoice: 'usualHouse',
      usualHouse: { singleDetached: { cards: { hrv: 60 }, wall: null } } }))
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^edit/ }))
    const dlg = screen.getByRole('dialog', { name: 'Your usual house' })
    const vent = within(dlg).getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).usualHouse.singleDetached.cards.hrv).toBe(75)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Undo changes' }))
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(saved.usualHouse.singleDetached).toEqual({ cards: { hrv: 60 }, wall: null })
    expect(saved.baselineChoice).toBe('usualHouse')
  })
  it('a switch of tab brings the tab bar back into view when it has scrolled off the top; the editor dialog does not move the page (browser walk)', () => {
    render(<App />)
    pickVentilation75()
    const bar = document.querySelector('.tab-bar')
    const scroll = vi.fn()
    bar.scrollIntoView = scroll
    bar.getBoundingClientRect = () => ({ top: -1200, bottom: -1150, left: 0, right: 0, width: 0, height: 50 })
    fireEvent.click(screen.getByRole('button', { name: 'What does this cost? ->' }))
    expect(scroll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(screen.getByRole('dialog', { name: 'Your usual house' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Cost' }))
    expect(scroll).toHaveBeenCalledTimes(1)
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
  it('walls specifics stay open through opening and closing the baseline editor', () => {
    render(<App />)
    const wall = document.querySelector('#panel-points .wall-builder')
    fireEvent.click(within(wall).getByRole('button', { name: 'Select RSI' }))
    fireEvent.click(within(wall).getAllByRole('button', { name: /3\.96/ })[0])
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Above-ground walls/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }))
    expect(screen.getByTestId('specifics-aboveGroundWalls')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(screen.getByRole('dialog', { name: 'Your usual house' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Cost' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('specifics-aboveGroundWalls')).toBeInTheDocument()
  })
})

describe('App keeps disclosures open across the baseline editor (final review F2)', () => {
  it('"What Typical Tier 2 includes" is still open after view then Close', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    const includes = () => screen.getByRole('button', { name: /^What Typical Tier 2 includes/ })
    fireEvent.click(includes())
    expect(includes()).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'view Ventilation' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Ventilation in Typical Tier 2' })).getByRole('button', { name: 'Close' }))
    expect(includes()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'view Ventilation' })).toBeInTheDocument()
  })
})

describe('App on a phone: the usual-house editor is a page (iteration 3, Review Focus 4)', () => {
  const realMatch = window.matchMedia
  beforeEach(() => {
    localStorage.clear()
    window.matchMedia = q => ({ matches: q.includes('max-width'), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
  })
  afterEach(() => { window.matchMedia = realMatch })

  it('opens as a page with a live cost bar; Esc and the Cost link leave it, and the pick is kept', () => {
    render(<App />)
    pickVentilation75()
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Compared with/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const editor = document.querySelector('.baseline-editor')
    expect(editor.querySelector('.crumb')).toHaveTextContent('Cost > Your usual house')
    const vent = within(editor).getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /60/ }))
    expect(editor.querySelector('.live-bar')).toHaveTextContent(/Your usual house/)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('.baseline-editor')).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).usualHouse.singleDetached.cards.hrv).toBe(60)
    fireEvent.click(screen.getByRole('button', { name: /^edit/ }))
    fireEvent.click(within(document.querySelector('.crumb')).getByRole('button', { name: 'Cost' }))
    expect(document.querySelector('.baseline-editor')).toBeNull()
  })
  it('a tab is a way out: Points closes the editor page and switches tab', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Compared with/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(document.querySelector('.baseline-editor')).not.toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Points' }))
    expect(screen.getByRole('tab', { name: 'Points' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    expect(document.querySelector('.baseline-editor')).toBeNull()
  })
  it('opening the editor page at a card does not scroll the tab bar over the card (fix 1, F2)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, hasOpenedCost: true, houseType: 'singleDetached', baselineChoice: 'usualHouse',
      usualHouse: { singleDetached: { cards: { hrv: 60 }, wall: null } } }))
    render(<App />)
    const bar = document.querySelector('.tab-bar')
    const scroll = vi.fn()
    bar.scrollIntoView = scroll
    bar.getBoundingClientRect = () => ({ top: -1200, bottom: -1150, left: 0, right: 0, width: 0, height: 50 })
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Compared with/ }))
    fireEvent.click(screen.getByRole('button', { name: /^What your usual house includes/ }))
    const before = scroll.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'view Ventilation' }))
    expect(document.querySelector('.baseline-editor')).not.toBeNull()
    expect(scroll.mock.calls.length).toBe(before)
  })
  it('leaving the editor page by Esc puts focus on the Cost tab (final review M3)', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    fireEvent.click(screen.getByRole('button', { name: /^Compared with/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(document.querySelector('.baseline-editor')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('.baseline-editor')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Cost' }))
  })
})

describe('Points add across both wall builders', () => {
  beforeEach(() => { localStorage.clear(); window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })) })
  const counter = () => document.querySelector('.points-counter .points-value').textContent
  const pick = (id, value) => fireEvent.change(document.getElementById(id), { target: { value } })
  const aboveSimple0 = categories.find(c => c.id === 'aboveGroundWalls').options[0].points

  it('above-ground simple index 0 plus below-grade default concrete: 1.6 + 0.2 = 1.8', () => {
    render(<App />)
    expect(counter()).toBe('0.0')
    // above-ground: Select RSI, first option
    const above = screen.getByRole('heading', { name: 'Above Ground Walls' }).closest('.wall-builder')
    fireEvent.click(within(above).getByRole('button', { name: 'Select RSI' }))
    fireEvent.click(within(above).getAllByRole('button').filter(b => b.classList.contains('option-button'))[0])
    expect(aboveSimple0).toBe(1.6)
    expect(counter()).toBe('1.6')
    // below-grade: builder, Poured Concrete defaults -> 3.12, +0.2
    pick('bg-foundationType', 'concrete')
    expect(counter()).toBe('1.8')
    // clearing the below-grade builder drops it back
    const below = screen.getByRole('heading', { name: 'Below Grade Walls' }).closest('.wall-builder')
    fireEvent.click(within(below).getByRole('button', { name: 'Clear' }))
    expect(counter()).toBe('1.6')
  })

  it('both in simple mode, both in builder mode, and one empty', () => {
    render(<App />)
    const above = screen.getByRole('heading', { name: 'Above Ground Walls' }).closest('.wall-builder')
    const below = screen.getByRole('heading', { name: 'Below Grade Walls' }).closest('.wall-builder')
    const optionButtons = card => within(card).getAllByRole('button').filter(b => b.classList.contains('option-button') && !b.classList.contains('clear-button'))

    // both simple: above index 0 (1.6) + below index 3 (1.4)
    fireEvent.click(within(above).getByRole('button', { name: 'Select RSI' }))
    fireEvent.click(optionButtons(above)[0])
    fireEvent.click(within(below).getByRole('button', { name: 'Select RSI' }))
    expect(optionButtons(below)).toHaveLength(4)
    fireEvent.click(optionButtons(below)[3])
    expect(counter()).toBe('3.0')

    // one empty: switching the below-grade mode clears it
    fireEvent.click(within(below).getByRole('button', { name: 'Build Assembly' }))
    expect(counter()).toBe('1.6')

    // both builder: above-ground wood defaults (2x6 R20 at 16", vinyl, OSB) + PWF default (+1.4)
    fireEvent.click(within(above).getByRole('button', { name: 'Build Assembly' }))
    expect(counter()).toBe('0.0')
    pick('wallType', 'wood')
    const aboveOnly = parseFloat(counter())
    pick('bg-foundationType', 'pwf')
    expect(parseFloat(counter())).toBeCloseTo(aboveOnly + 1.4, 5)
  })

  it('the below-grade category renders as the builder card, not a plain option card', () => {
    render(<App />)
    const below = screen.getByRole('heading', { name: 'Below Grade Walls' }).closest('.wall-builder')
    expect(below).not.toBeNull()
    expect(screen.queryByText('Below Grade Walls', { selector: '.category-card:not(.wall-builder) *' })).toBeNull()
  })
})
