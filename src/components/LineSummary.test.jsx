import { render, screen, fireEvent, within } from '@testing-library/react'
import LineSummary from './LineSummary'
import { scenario } from '../costing/__testing__/scenario'

const show = (args, id, props = {}) => { const s = scenario(args); return render(<LineSummary line={s.line(id)} ctx={s.ctx} sentences={s.sentences} onChangeHouse={() => {}} onGoToPoints={() => {}} {...props} />) }

describe('LineSummary', () => {
  it('three tiles: both costs and the signed difference', () => {
    show({ wallSelection: { simpleIndex: 4 } }, 'aboveGroundWalls')
    const tiles = document.querySelectorAll('.cost-tiles .tile')
    expect([...tiles].map(t => t.querySelector('span').textContent)).toEqual(['This design', 'Typical Tier 2', 'Difference'])
    expect(tiles[0].querySelector('b').textContent).toMatch(/^\$[\d,]+$/)
    expect(tiles[2].querySelector('b').textContent).toMatch(/^[+-]\$[\d,]+$|^\$0$/)
  })
  it('a wall by level: descriptions, the plain notice, Go to Points and change house', () => {
    const onGoToPoints = vi.fn(), onChangeHouse = vi.fn()
    show({ wallSelection: { simpleIndex: 4 } }, 'aboveGroundWalls', { onGoToPoints, onChangeHouse })
    expect(screen.getByText(/RSI 4\.29 level, priced as 2x6 R22 batt \+ 1-1\/2 in Polyiso, OSB, vinyl/)).toBeInTheDocument()
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('You picked this wall by RSI level, so it is priced as a common wall that reaches RSI 4.29')
    fireEvent.click(within(note).getByRole('button', { name: 'Go to Points' }))
    expect(onGoToPoints).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'change house' }))
    expect(onChangeHouse).toHaveBeenCalledWith('storeyHeightFt')
  })
  it('airtightness has no change house link and no notice', () => {
    show({ selections: { airTightness: 2 } }, 'airTightness')
    expect(screen.queryByRole('button', { name: 'change house' })).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByText('Priced per house.')).toBeInTheDocument()
  })
})
