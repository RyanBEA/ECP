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

describe('HeaderCostChip accessible name (R35)', () => {
  it('reads the figure and the comparison without the details decoration', () => {
    render(<HeaderCostChip text="+$8,500" secondLine="more than Typical Tier 2 . details ->" onOpen={() => {}} onHide={() => {}} />)
    const chip = screen.getByRole('button', { name: /Cost details/ })
    expect(chip).toHaveAttribute('aria-label', 'Cost details: +$8,500 more than Typical Tier 2')
    expect(chip.getAttribute('aria-label')).not.toContain('->')
  })
  it('keeps the your prices note and works without a second line', () => {
    const { unmount } = render(<HeaderCostChip text="-$800" secondLine="less than Your usual house . your prices . details ->" onOpen={() => {}} onHide={() => {}} />)
    expect(screen.getByRole('button', { name: /Cost details/ })).toHaveAttribute('aria-label', 'Cost details: -$800 less than Your usual house . your prices')
    unmount()
    render(<HeaderCostChip text="$0" onOpen={() => {}} onHide={() => {}} />)
    const chip = screen.getByRole('button', { name: /Cost details/ })
    expect(chip).toHaveAttribute('aria-label', 'Cost details: $0')
    expect(chip.textContent).not.toContain('undefined')
  })
})
