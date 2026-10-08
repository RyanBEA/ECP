// src/App.optimize.test.jsx
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from './App'

import { categories } from './data/ecpData'

const tab = name => fireEvent.click(screen.getByRole('tab', { name }))
const card = cardId => screen.getByRole('heading', { name: categories.find(c => c.id === cardId).name }).closest('.category-card')
const pickOption = (cardId, optionText) => fireEvent.click(within(card(cardId)).getByRole('button', { name: new RegExp(optionText) }))
const isPicked = (cardId, optionText) => within(card(cardId)).getByRole('button', { name: new RegExp(optionText) }).classList.contains('selected')
const setTier = id => fireEvent.change(document.querySelector('.tier-selector select'), { target: { value: String(id) } })

describe('Optimize tab in App (spec 5, 6, 7, 8)', () => {
  beforeEach(() => { window.localStorage.clear(); window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })) })
  it('has three tabs and the Optimize tab opens on screen 1', () => {
    render(<App />)
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Points', 'Cost', 'Optimize'])
    tab('Optimize')
    expect(screen.getByRole('heading', { name: 'What would you build?' })).toBeInTheDocument()
  })
  it('runs, shows a result, and the result goes stale when the Tier changes (review focus 3)', () => {
    render(<App />)
    tab('Optimize')
    fireEvent.click(screen.getByRole('button', { name: /Find the cheapest way to Tier 2/ }))
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Tier 2/)
    expect(screen.queryByText('Your inputs changed.')).toBeNull()
    tab('Points')
    setTier(3)
    tab('Optimize')
    expect(screen.getByText('Your inputs changed.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Tier 2/)   // not re-run on its own
    fireEvent.click(screen.getByRole('button', { name: 'Find again' }))
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Tier 3/)
    expect(screen.queryByText('Your inputs changed.')).toBeNull()
  })
  it('puts the package on the Points tab, clearing the exclusive pair, and restores (review focus 5)', () => {
    render(<App />)
    tab('Points')
    pickOption('dhwElectric', '2\\.35')
    tab('Optimize')
    fireEvent.click(screen.getByRole('button', { name: /Find the cheapest way/ }))
    const table = screen.getByRole('table', { name: 'The package' })
    const dhwRow = within(table).getAllByRole('row').find(r => r.textContent.startsWith('Water heating'))
    const gasPicked = /gas/.test(dhwRow.textContent)
    fireEvent.click(screen.getByRole('button', { name: 'Put this on the Points tab' }))
    expect(screen.queryByText('Your inputs changed.')).toBeNull()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Your current design is the cheapest way/)
    expect(screen.getByRole('button', { name: 'Restore my design' })).toBeInTheDocument()   // the snapshot refresh keeps the restore offer
    tab('Points')
    if (gasPicked) expect(isPicked('dhwElectric', '2\\.35')).toBe(false)
    tab('Optimize')
    fireEvent.click(screen.getByRole('button', { name: 'Restore my design' }))
    expect(screen.queryByText('Your inputs changed.')).toBeNull()
    tab('Points')
    expect(isPicked('dhwElectric', '2\\.35')).toBe(true)
  })
  it('a hand change on the Points tab after an apply ends the restore offer', () => {
    render(<App />)
    tab('Optimize')
    fireEvent.click(screen.getByRole('button', { name: /Find the cheapest way/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Put this on the Points tab' }))
    tab('Points')
    pickOption('windowsDoors', '1\\.44')
    tab('Optimize')
    expect(screen.queryByRole('button', { name: 'Restore my design' })).toBeNull()
  })
  it('Points and Cost tabs render as before', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Points' })).toHaveAttribute('aria-selected', 'true')
    tab('Cost')
    expect(screen.getByText(/Pick options on the Points tab/)).toBeInTheDocument()
  })
})
