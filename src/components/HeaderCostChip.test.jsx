import { render, screen, fireEvent } from '@testing-library/react'
import HeaderCostChip from './HeaderCostChip'

describe('HeaderCostChip', () => {
  it('shows the figure and second line, opens on click, hides on the hide control', () => {
    const onOpen = vi.fn(), onHide = vi.fn()
    render(<HeaderCostChip text="+$8,500" secondLine="more than Typical Tier 2 . details ->" onOpen={onOpen} onHide={onHide} />)
    fireEvent.click(screen.getByRole('button', { name: /Cost details/ }))
    expect(onOpen).toHaveBeenCalled()
    expect(screen.getByText('+$8,500')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide cost from the Points tab' }))
    expect(onHide).toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
