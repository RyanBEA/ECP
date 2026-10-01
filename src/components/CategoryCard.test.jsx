import { render, screen, fireEvent } from '@testing-library/react'
import CategoryCard from './CategoryCard'
import { categories } from '../data/ecpData'

const windows = categories.find(c => c.id === 'windowsDoors')

describe('CategoryCard baseline variant', () => {
  it('shows a read-only preset row when the preset value is not an option, and never on Points', () => {
    const onSelect = vi.fn()
    render(<CategoryCard category={windows} selectedOption={null} onSelect={onSelect} variant="baseline" presetValue={1.61} presetName="Typical Tier 2" />)
    const row = screen.getByRole('button', { name: /Typical Tier 2: U-value 1.61 \(0 pts\)/ })
    expect(row).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(row)
    expect(onSelect).toHaveBeenCalledWith('windowsDoors', null)
  })
  it('does not show the preset row when the preset is an option or on the design variant', () => {
    const { rerender } = render(<CategoryCard category={windows} selectedOption={null} onSelect={() => {}} variant="baseline" presetValue={1.44} presetName="Typical Tier 2" />)
    expect(screen.queryByText(/Typical Tier 2:/)).toBeNull()
    rerender(<CategoryCard category={windows} selectedOption={null} onSelect={() => {}} presetValue={1.61} presetName="Typical Tier 2" />)
    expect(screen.queryByText(/Typical Tier 2:/)).toBeNull()
  })
  it('unpresses the preset row once an option is picked', () => {
    render(<CategoryCard category={windows} selectedOption={0} onSelect={() => {}} variant="baseline" presetValue={1.61} presetName="Typical Tier 2" />)
    expect(screen.getByRole('button', { name: /Typical Tier 2:/ })).toHaveAttribute('aria-pressed', 'false')
  })
})
