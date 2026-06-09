import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('App tabs', () => {
  it('shows the prescriptive categories by default', () => {
    render(<App />)
    expect(screen.getByText(/Prescriptive Tier 2 Compliance Calculator/i)).toBeTruthy()
  })

  it('switches to the Performance tab', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Performance$/i }))
    expect(screen.getByText(/YOUR DESIGN/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /run simulation/i })).toBeTruthy()
  })

  it('switches to the Costing tab', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Costing$/i }))
    expect(screen.getByText(/No upgrades selected/i)).toBeTruthy()
  })
})
