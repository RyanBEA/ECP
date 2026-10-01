import { render, screen, fireEvent } from '@testing-library/react'
import TabBar from './TabBar'

describe('TabBar', () => {
  it('renders two tabs, marks the active one, and is inert when disabled', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TabBar active="points" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'Points' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    expect(onChange).toHaveBeenCalledWith('cost')
    rerender(<TabBar active="cost" onChange={onChange} disabled />)
    fireEvent.click(screen.getByRole('tab', { name: 'Points' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('TabBar keyboard and ids (R35)', () => {
  it('gives each tab an id and a roving tabindex', () => {
    render(<TabBar active="points" onChange={() => {}} />)
    const points = screen.getByRole('tab', { name: 'Points' })
    const cost = screen.getByRole('tab', { name: 'Cost' })
    expect(points).toHaveAttribute('id', 'tab-points')
    expect(cost).toHaveAttribute('id', 'tab-cost')
    expect(points).toHaveAttribute('tabindex', '0')
    expect(cost).toHaveAttribute('tabindex', '-1')
  })
  it('switches tabs with Left and Right arrows and moves focus, unless disabled', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TabBar active="points" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Points' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('cost')
    expect(screen.getByRole('tab', { name: 'Cost' })).toHaveFocus()
    rerender(<TabBar active="cost" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Cost' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('points')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Cost' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('points')
    expect(onChange).toHaveBeenCalledTimes(3)
    rerender(<TabBar active="cost" onChange={onChange} disabled />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Cost' }), { key: 'ArrowLeft' })
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Cost' }), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(3)
  })
})

describe('TabBar panel links (Task 15 notes)', () => {
  it('points each tab at its panel with aria-controls', () => {
    render(<TabBar active="points" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Points' })).toHaveAttribute('aria-controls', 'panel-points')
    expect(screen.getByRole('tab', { name: 'Cost' })).toHaveAttribute('aria-controls', 'panel-cost')
  })
})
