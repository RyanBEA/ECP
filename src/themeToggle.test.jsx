import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'

describe('theme toggle', () => {
  beforeEach(() => { localStorage.clear(); window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })) })

  it('is an icon button named for the mode it switches to, with no text label', () => {
    const { container } = render(<App />)
    const toggle = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(toggle).toHaveTextContent(/^$/)
    expect(toggle.querySelector('svg.moon')).not.toBeNull()
    fireEvent.click(toggle)
    expect(container.querySelector('.app')).toHaveClass('dark')
    const back = screen.getByRole('button', { name: 'Switch to light mode' })
    expect(back.querySelector('svg.sun')).not.toBeNull()
  })
})
