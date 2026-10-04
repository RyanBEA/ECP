import { render, screen, fireEvent, within } from '@testing-library/react'
import BaselinePicker, { baselinePickRows } from './BaselinePicker'
import { moreSummary, houseSummary } from './HouseFields'
import { Harness } from './__testing__/costHarness'
import { getPresetPicks } from '../costing/baselines'
import { resolveHouseFields } from '../costing/useHouseCost'

const headline = () => screen.getByRole('heading', { level: 2 }).textContent
const more = () => screen.getByRole('button', { name: /^More about this house/ })

describe('House card', () => {
  it('says once what the fields are, marks only changed fields, and shows metres', () => {
    render(<Harness selections={{ hrv: 2 }} />)
    expect(screen.getByText('Filled in for a single detached house. Change anything that differs.')).toBeInTheDocument()
    expect(screen.queryByText('assumed')).toBeNull()
    expect(screen.getByText('(10.1 x 9.1 m)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Storeys'), { target: { value: '3' } })
    expect(screen.getByText('changed')).toBeInTheDocument()
  })
  it('More about this house is a disclosure with a summary of its values', () => {
    render(<Harness selections={{ hrv: 2 }} />)
    expect(more()).toHaveAttribute('aria-expanded', 'false')
    expect(more()).toHaveTextContent('9 ft storeys, 8 ft foundation wall, 2 doors, no party walls, 50 gal water heater')
    expect(screen.queryByLabelText('Storey height (ft)')).toBeNull()
    fireEvent.click(more())
    expect(screen.getByLabelText('Storey height (ft)')).toBeInTheDocument()
    fireEvent.click(more())
    expect(screen.queryByLabelText('Storey height (ft)')).toBeNull()
  })
  it('summaries name the house', () => {
    const f = resolveHouseFields('rowHome', {})
    expect(houseSummary('Row home', f)).toBe('Row home, 2 storeys, 36 x 20 ft, 15% glazing, 3 bedrooms')
    expect(moreSummary(f)).toBe('9 ft storeys, 8 ft foundation wall, 1 door, 2 party walls, 40 gal water heater')
  })
})

// Moved here verbatim from CostTab.test.jsx (ruling R40); the labels are kept through aria-label.
describe('HouseFields never stores a cleared or invalid value (R40)', () => {
  it('clearing Length keeps the headline and does not mark the field changed', () => {
    render(<Harness selections={{ windowsDoors: 1 }} />)
    const before = headline()
    const length = screen.getByLabelText('Length (ft)')
    fireEvent.change(length, { target: { value: '' } })
    expect(length).toHaveValue(null)
    expect(headline()).toBe(before)
    expect(screen.queryByText('changed')).toBeNull()
    fireEvent.blur(length)
    expect(length).toHaveValue(33)
  })
  it('rejects a negative length', () => {
    render(<Harness selections={{ windowsDoors: 1 }} />)
    const before = headline()
    fireEvent.change(screen.getByLabelText('Length (ft)'), { target: { value: '-40' } })
    expect(headline()).toBe(before)
    expect(screen.queryByText('changed')).toBeNull()
  })
  it('rejects a glazing ratio above 60%', () => {
    render(<Harness selections={{ windowsDoors: 1 }} />)
    const before = headline()
    fireEvent.change(screen.getByLabelText('Glazing ratio (%)'), { target: { value: '75' } })
    expect(headline()).toBe(before)
    expect(screen.queryByText('changed')).toBeNull()
  })
  it('stores a valid change', () => {
    render(<Harness selections={{ windowsDoors: 1 }} />)
    const before = headline()
    fireEvent.change(screen.getByLabelText('Length (ft)'), { target: { value: '60' } })
    expect(screen.getByText('changed')).toBeInTheDocument()
    expect(headline()).not.toBe(before)
    expect(screen.getByText('(18.3 x 9.1 m)')).toBeInTheDocument()
  })
})

describe('Compared with card', () => {
  it('three radios with their descriptions; the current one is checked', () => {
    render(<Harness selections={{ hrv: 2 }} />)
    const group = screen.getByRole('group', { name: 'Compared with' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Typical Tier 2' })).toBeChecked()
    expect(screen.getByText(/Not a compliant house since April 2026/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Describe it/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Code minimum' }))
    expect(screen.getByRole('radio', { name: 'Code minimum' })).toBeChecked()
    expect(headline()).toMatch(/Code minimum/)
  })
  it('an existing usual house is chosen like the others; with none, choosing it opens the editor (R40)', () => {
    const onChoice = vi.fn(), onEdit = vi.fn()
    const picks = getPresetPicks('typicalTier2', 'singleDetached')
    const { rerender } = render(<BaselinePicker choice="typicalTier2" onChoice={onChoice} onEdit={onEdit} onResetUsual={() => {}} hasUsual baselineName="Typical Tier 2" baselinePicks={picks} />)
    expect(screen.getByRole('button', { name: 'reset to Typical Tier 2' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(onChoice).toHaveBeenCalledWith('usualHouse')
    expect(onEdit).not.toHaveBeenCalled()
    rerender(<BaselinePicker choice="typicalTier2" onChoice={onChoice} onEdit={onEdit} onResetUsual={() => {}} hasUsual={false} baselineName="Typical Tier 2" baselinePicks={picks} />)
    fireEvent.click(screen.getByRole('radio', { name: 'My usual house' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onChoice).toHaveBeenCalledTimes(1)
  })
  it('What Typical Tier 2 includes: a list, one pick per row, each with view; below grade leaves with the foundation', () => {
    const onViewBaselineCard = vi.fn()
    render(<Harness selections={{ hrv: 2 }} spies={{ onViewBaselineCard }} />)
    const inc = screen.getByRole('button', { name: /^What Typical Tier 2 includes/ })
    expect(inc).toHaveTextContent('6 picks, 10.7 points')
    fireEvent.click(inc)
    const list = document.querySelector('.includes-list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(within(list).getByText('RSI 3.46')).toBeInTheDocument()
    fireEvent.click(within(list).getByRole('button', { name: 'view Ventilation' }))
    expect(onViewBaselineCard).toHaveBeenCalledWith('hrv')
    fireEvent.click(more())
    fireEvent.change(screen.getByLabelText('Foundation wall height (ft, 0 = none)'), { target: { value: '0' } })
    expect(within(document.querySelector('.includes-list')).queryByText('RSI 3.46')).toBeNull()
    expect(screen.getByRole('button', { name: /^What Typical Tier 2 includes/ })).toHaveTextContent('5 picks')
  })
  it('a usual house saved with only one card lists the filled picks (Review Focus 2)', () => {
    render(<Harness selections={{ hrv: 2 }} usualHouse={{ singleDetached: { cards: { hrv: 60 }, wall: null } }} initialChoice="usualHouse" />)
    fireEvent.click(screen.getByRole('button', { name: /^What your usual house includes/ }))
    const list = document.querySelector('.includes-list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(within(list).getByText('HRV 60% SRE')).toBeInTheDocument()
    expect(within(list).getByText(/^RSI 3\.99 \(2x6 R24 batt/)).toBeInTheDocument()
  })
  it('baselinePickRows reads a Code minimum wall level with its priced assembly', () => {
    const rows = baselinePickRows(getPresetPicks('codeMinimum', 'singleDetached'))
    expect(rows[0]).toEqual({ cardId: 'aboveGroundWalls', name: 'Above-ground walls', value: 'RSI 2.97 (priced as 2x6 R22 batt, OSB, vinyl)' })
    expect(rows.map(r => r.cardId)).toEqual(['aboveGroundWalls', 'belowGradeWalls', 'windowsDoors', 'airTightness', 'hrv', 'dhwElectric'])
  })
})

describe('change house (R40)', () => {
  it('opens More about this house and focuses a field kept there', () => {
    render(<Harness selections={{ belowGradeWalls: 0 }} />)
    expect(more()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: /^Below-grade walls/ }))
    fireEvent.click(screen.getByRole('button', { name: 'change house' }))
    expect(more()).toHaveAttribute('aria-expanded', 'true')
    expect(document.activeElement).toBe(screen.getByLabelText('Foundation wall height (ft, 0 = none)'))
  })
})
