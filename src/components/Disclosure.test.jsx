import { render, screen, fireEvent } from '@testing-library/react'
import Disclosure from './Disclosure'

describe('Disclosure', () => {
  it('closed: a button with aria-expanded false, the label and summary, no content', () => {
    render(<Disclosure label="Layers" summary="8 layers, 3 differ" open={false} onToggle={() => {}}><p>inside</p></Disclosure>)
    const btn = screen.getByRole('button', { name: /^Layers/ })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(btn).toHaveTextContent('8 layers, 3 differ')
    expect(screen.queryByText('inside')).toBeNull()
    expect(btn.querySelector('svg')).not.toBeNull()
  })
  it('open: content shown and the same row toggles it', () => {
    const onToggle = vi.fn()
    render(<Disclosure label="Layers" summary="8 layers" open onToggle={onToggle}><p>inside</p></Disclosure>)
    expect(screen.getByText('inside')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /^Layers/ })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
  it('no summary renders only the label', () => {
    render(<Disclosure label="House" open={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'House' })).toBeInTheDocument()
  })
})
