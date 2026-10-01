import { render, screen, fireEvent } from '@testing-library/react'
import CategoryCard from './CategoryCard'
import PointsCounter from './PointsCounter'
import WallBuilder from './WallBuilder'
import { categories } from '../data/ecpData'

// Controller-mandated tests for Task 11 beyond the brief: ruling R33, hideExtras,
// initial wall builder mode, and the baseline classes.

const windows = categories.find(c => c.id === 'windowsDoors')
const dhwGas = categories.find(c => c.id === 'dhwGas')
const wood = { wallType: 'wood', assemblyType: 'single', studSpacing: '24"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R24', contInsType: 'XPS', contInsThickness: '1"' }

describe('R33: preset row on a disabled card', () => {
  it('is not pressed when the card is disabled, even with no option picked', () => {
    const onSelect = vi.fn()
    render(<CategoryCard category={dhwGas} selectedOption={null} onSelect={onSelect} disabled variant="baseline" presetValue={0.5} presetName="Typical Tier 2" />)
    const row = screen.getByRole('button', { name: /Typical Tier 2:/ })
    expect(row).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(row)
    expect(onSelect).not.toHaveBeenCalled()
  })
  it('is pressed on the same card when it is not disabled', () => {
    render(<CategoryCard category={dhwGas} selectedOption={null} onSelect={() => {}} variant="baseline" presetValue={0.5} presetName="Typical Tier 2" />)
    expect(screen.getByRole('button', { name: /Typical Tier 2:/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('baseline variant classes', () => {
  it('marks the card, its option buttons and the counter as baseline', () => {
    const { container } = render(<CategoryCard category={windows} selectedOption={0} onSelect={() => {}} variant="baseline" presetValue={1.61} presetName="Typical Tier 2" />)
    expect(container.querySelector('.category-card')).toHaveClass('baseline')
    const opts = container.querySelectorAll('.option-button:not(.preset-row):not(.clear-button)')
    expect(opts.length).toBe(windows.options.length)
    opts.forEach(b => expect(b).toHaveClass('baseline'))
    const counter = render(<PointsCounter total={4.2} target={10} variant="baseline" label="your usual house . short of Tier 2" />).container
    expect(counter.querySelector('.points-counter')).toHaveClass('baseline')
    expect(counter.querySelector('.points-sublabel')).toHaveTextContent('your usual house . short of Tier 2')
  })
})

describe('WallBuilder variant props', () => {
  it('hideExtras hides the export button and the cross-section, keeps Clear', () => {
    const { container } = render(<WallBuilder selection={wood} onSelect={() => {}} hideExtras />)
    expect(container.querySelector('.export-button')).toBeNull()
    expect(container.querySelector('.wall-section-container')).toBeNull()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  })
  it('baseline variant marks the root card', () => {
    const { container } = render(<WallBuilder selection={{}} onSelect={() => {}} variant="baseline" />)
    expect(container.querySelector('.wall-builder')).toHaveClass('baseline')
  })
  it('opens in Select RSI when the selection has a simpleIndex, with baseline option buttons', () => {
    const { container } = render(<WallBuilder selection={{ simpleIndex: 0 }} onSelect={() => {}} variant="baseline" />)
    expect(screen.getByRole('button', { name: 'Select RSI' })).toHaveClass('active')
    const opts = container.querySelectorAll('.options-grid .option-button:not(.clear-button)')
    expect(opts.length).toBeGreaterThan(0)
    opts.forEach(b => expect(b).toHaveClass('baseline'))
  })
})

describe('R34: preset row with readable preset text', () => {
  const dhwElectric = categories.find(c => c.id === 'dhwElectric')
  it('shows the presetText prop instead of the raw value', () => {
    render(<CategoryCard category={dhwElectric} selectedOption={null} onSelect={() => {}} variant="baseline" presetValue="electricStorage" presetName="Typical Tier 2" presetText="electric storage tank" />)
    expect(screen.getByRole('button', { name: 'Typical Tier 2: electric storage tank (0 pts)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/electricStorage/)).toBeNull()
  })
})
