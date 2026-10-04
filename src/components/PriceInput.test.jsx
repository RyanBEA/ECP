import { render, screen, fireEvent } from '@testing-library/react'
import PriceInput from './PriceInput'

const field = () => screen.getByRole('spinbutton', { name: 'This design framing material' })

describe('PriceInput', () => {
  it('shows the value to its decimals and commits a changed value on Enter', () => {
    const onSet = vi.fn()
    render(<PriceInput name="This design framing material" value={0.6299} onSet={onSet} />)
    expect(field()).toHaveValue(0.63)
    fireEvent.change(field(), { target: { value: '0.9' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onSet).toHaveBeenCalledWith(0.9)
    fireEvent.blur(field())
    expect(onSet).toHaveBeenCalledTimes(1)
  })
  it('Esc cancels, and a blur after Esc commits nothing', () => {
    const onSet = vi.fn()
    render(<PriceInput name="This design framing material" value={1} onSet={onSet} />)
    fireEvent.change(field(), { target: { value: '5' } })
    fireEvent.keyDown(field(), { key: 'Escape' })
    fireEvent.blur(field())
    expect(onSet).not.toHaveBeenCalled()
    expect(field()).toHaveValue(1)
  })
  it('blur commits only a changed value; empty, negative and unchanged input commit nothing', () => {
    const onSet = vi.fn()
    render(<PriceInput name="This design framing material" value={1} onSet={onSet} />)
    fireEvent.focus(field()); fireEvent.blur(field())
    fireEvent.change(field(), { target: { value: '' } }); fireEvent.blur(field())
    fireEvent.change(field(), { target: { value: '-2' } }); fireEvent.blur(field())
    fireEvent.change(field(), { target: { value: '1' } }); fireEvent.blur(field())
    expect(onSet).not.toHaveBeenCalled()
    fireEvent.change(field(), { target: { value: '3' } }); fireEvent.blur(field())
    expect(onSet).toHaveBeenCalledWith(3)
  })
  it('an overridden value has a reset that sends undefined; dormant is marked', () => {
    const onSet = vi.fn()
    const { container } = render(<PriceInput name="This design framing material" value={2} overridden dormant onSet={onSet} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset This design framing material' }))
    expect(onSet).toHaveBeenCalledWith(undefined)
    expect(container.firstChild).toHaveClass('dormant')
    expect(container.firstChild).not.toHaveClass('overridden')
  })
  it('whole-dollar values use decimals 0', () => {
    render(<PriceInput name="This design framing material" value={1300} decimals={0} onSet={() => {}} />)
    expect(field()).toHaveValue(1300)
  })
})
