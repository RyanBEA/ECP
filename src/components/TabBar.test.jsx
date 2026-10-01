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
