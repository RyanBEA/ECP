import { render, screen, fireEvent, within } from '@testing-library/react'
import BaselineCardView from './BaselineCardView'
import { getPresetPicks } from '../costing/baselines'

const typical = getPresetPicks('typicalTier2', 'singleDetached')
const codeMin = getPresetPicks('codeMinimum', 'singleDetached')

describe('BaselineCardView', () => {
  it('shows one card of a preset, read-only, with its pick in words', () => {
    render(<BaselineCardView picks={typical} baselineName="Typical Tier 2" cardId="hrv" onClose={() => {}} />)
    const d = screen.getByRole('dialog', { name: 'Ventilation in Typical Tier 2' })
    expect(within(d).getByText('Typical Tier 2: HRV 65% SRE.')).toBeInTheDocument()
    const opt = within(d).getByRole('button', { name: /65/ })
    expect(opt).toHaveClass('selected')
    expect(opt).toBeDisabled()
    expect(d.querySelectorAll('.category-card')).toHaveLength(1)
  })
  it("Code minimum's RSI 2.97 wall is stated in words, never as Typical Tier 2's wall (Review Focus 5)", () => {
    render(<BaselineCardView picks={codeMin} baselineName="Code minimum" cardId="aboveGroundWalls" onClose={() => {}} />)
    const d = screen.getByRole('dialog', { name: 'Above-ground walls in Code minimum' })
    expect(within(d).getByText('Code minimum: RSI 2.97 (priced as 2x6 R22 batt, OSB, vinyl).')).toBeInTheDocument()
    expect(within(d).queryByText(/RSI 3\.99/)).toBeNull()
    expect(d.querySelector('.category-card')).toBeNull()
  })
  it('the Close button calls onClose and is not disabled with the card', () => {
    const onClose = vi.fn()
    render(<BaselineCardView picks={typical} baselineName="Typical Tier 2" cardId="windowsDoors" onClose={onClose} />)
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toBeEnabled()
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
