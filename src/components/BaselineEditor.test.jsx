import { render, screen, fireEvent, within } from '@testing-library/react'
import BaselineEditor from './BaselineEditor'
import { getPresetPicks } from '../costing/baselines'

const typical = getPresetPicks('typicalTier2', 'singleDetached')

describe('BaselineEditor', () => {
  it('opens pre-filled, shows the amber counter at or above 10, and the preset rows', () => {
    render(<BaselineEditor initialPicks={typical} houseType="singleDetached" onDone={() => {}} onCancel={() => {}} onDirtyChange={() => {}} />)
    expect(screen.getByText(/Cost > Your usual house/)).toBeInTheDocument()
    expect(screen.getByText(/your usual house . meets Tier 2/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Typical Tier 2: U-value 1.61 \(0 pts\)/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull()
  })
  it('Done returns picks by value and records what changed; Cancel returns nothing (Review Focus 1)', () => {
    const onDone = vi.fn(), onCancel = vi.fn(), onDirtyChange = vi.fn()
    render(<BaselineEditor initialPicks={typical} houseType="singleDetached" onDone={onDone} onCancel={onCancel} onDirtyChange={onDirtyChange} />)
    const vent = screen.getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByText(/Changed from Typical Tier 2: Ventilation/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ cards: expect.objectContaining({ hrv: 75, windowsDoors: 1.61, airTightness: 'untested' }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
  it('Reset to typical restores the preset', () => {
    render(<BaselineEditor initialPicks={typical} houseType="singleDetached" onDone={() => {}} onCancel={() => {}} onDirtyChange={() => {}} />)
    const vent = screen.getByText('Ventilation').closest('.category-card')
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to typical' }))
    expect(screen.queryByText(/Changed from Typical Tier 2:/)).toBeNull()
  })
  it('reads short of Tier 2 when the picks drop below 10', () => {
    render(<BaselineEditor initialPicks={{ cards: { windowsDoors: 1.61 }, wall: null }} houseType="singleDetached" onDone={() => {}} onCancel={() => {}} onDirtyChange={() => {}} />)
    expect(screen.getByText(/short of Tier 2/)).toBeInTheDocument()
  })
})

// Controller-mandated tests for Task 14 beyond the brief: rulings R32, R33, R34, R41 and the wall remount on reset.
const noop = () => {}
const editor = (props = {}) => render(<BaselineEditor initialPicks={typical} houseType="singleDetached" onDone={noop} onCancel={noop} onDirtyChange={noop} {...props} />)
const card = name => screen.getByText(name).closest('.category-card')
const wallCard = () => screen.getByText('Above Ground Walls').closest('.category-card')

describe('BaselineEditor rulings', () => {
  it('R34: preset rows use readable preset text', () => {
    editor()
    expect(within(card('DHW (Electric)')).getByRole('button', { name: 'Typical Tier 2: electric storage tank (0 pts)' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(card('Air Tightness')).getByRole('button', { name: 'Typical Tier 2: untested, prescriptive air-barrier detailing (0 pts)' })).toBeInTheDocument()
  })
  it('R33: the DHW electric preset row is not pressed while a gas option is picked', () => {
    editor()
    fireEvent.click(within(card('DHW (Gas- or oil-fired)')).getByRole('button', { name: /0\.92/ }))
    expect(within(card('DHW (Electric)')).getByRole('button', { name: /Typical Tier 2:/ })).toHaveAttribute('aria-pressed', 'false')
  })
  it('R32: Clear on a card whose preset is one of its options returns to that option', () => {
    editor()
    const vent = card('Ventilation')
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    fireEvent.click(within(vent).getByRole('button', { name: 'Clear' }))
    expect(within(vent).getByRole('button', { name: /65/ })).toHaveClass('selected')
    expect(within(vent).getByRole('button', { name: /75/ })).not.toHaveClass('selected')
    expect(screen.queryByText(/Changed from Typical Tier 2:/)).toBeNull()
  })
  it('R32: on a mini home, Clear on air tightness returns to the 2.0 option', () => {
    editor({ initialPicks: getPresetPicks('typicalTier2', 'miniHome'), houseType: 'miniHome' })
    const air = card('Air Tightness')
    expect(within(air).getByRole('button', { name: /2\+3\.5 pts/ })).toHaveClass('selected')
    fireEvent.click(within(air).getByRole('button', { name: /1\.5/ }))
    fireEvent.click(within(air).getByRole('button', { name: 'Clear' }))
    expect(within(air).getByRole('button', { name: /2\+3\.5 pts/ })).toHaveClass('selected')
  })
  it('R32: Clear on a card whose preset is not an option leaves it unselected, the preset row pressed', () => {
    editor()
    const win = card('Windows & Doors')
    fireEvent.click(within(win).getByRole('button', { name: /1\.22/ }))
    expect(within(win).getByRole('button', { name: /Typical Tier 2:/ })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(win).getByRole('button', { name: 'Clear' }))
    expect(within(win).getByRole('button', { name: /Typical Tier 2:/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(win).getByRole('button', { name: /1\.22/ })).not.toHaveClass('selected')
  })
  it('R41: with fillMissing, a usual house missing cards and wall starts from the Typical Tier 2 values', () => {
    editor({ initialPicks: { cards: { windowsDoors: 1.61 }, wall: null }, fillMissing: true })
    expect(screen.getByText(/your usual house . meets Tier 2/)).toBeInTheDocument()
    expect(within(card('Ventilation')).getByRole('button', { name: /65/ })).toHaveClass('selected')
    expect(within(card('Below Grade Walls')).getByRole('button', { name: /3\.46/ })).toHaveClass('selected')
    expect(within(card('DHW (Electric)')).getByRole('button', { name: /Typical Tier 2:/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(wallCard()).getByLabelText('Cavity Size')).toHaveValue('2x6 R24')
    expect(screen.getByText(/Same as Typical Tier 2/)).toBeInTheDocument()
  })
  it('R41: Done with fillMissing saves the filled picks', () => {
    const onDone = vi.fn()
    editor({ initialPicks: { cards: { hrv: 75 }, wall: null }, fillMissing: true, onDone })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledWith({ cards: { ...typical.cards, hrv: 75 }, wall: typical.wall })
  })
  it('R41: change notes read the preset and the pick in words', () => {
    editor()
    fireEvent.click(within(card('DHW (Gas- or oil-fired)')).getByRole('button', { name: /0\.92/ }))
    expect(screen.getByText('Typical Tier 2: electric storage tank. You picked UEF 0.92 (Tankless Condensing).')).toBeInTheDocument()
    fireEvent.click(within(card('Windows & Doors')).getByRole('button', { name: /1\.22/ }))
    expect(screen.getByText('Typical Tier 2: U-value 1.61. You picked U-value 1.22.')).toBeInTheDocument()
    fireEvent.click(within(card('Ventilation')).getByRole('button', { name: /75/ }))
    expect(screen.getByText('Typical Tier 2: SRE 65. You picked SRE 75.')).toBeInTheDocument()
    fireEvent.click(within(wallCard()).getByRole('button', { name: 'Select RSI' }))
    fireEvent.click(within(wallCard()).getByRole('button', { name: /3\.69/ }))
    expect(screen.getByText('Typical Tier 2: RSI 3.99 (2x6 R24 batt + 1 in XPS, OSB, vinyl). You picked RSI 3.69.')).toBeInTheDocument()
    expect(screen.getByText(/Changed from Typical Tier 2: Above Ground Walls, DHW \(Gas- or oil-fired\), Ventilation, Windows & Doors\./)).toBeInTheDocument()
  })
  it('Reset to typical remounts the wall card in Build Assembly with the 2x6 R24 assembly', () => {
    editor()
    fireEvent.click(within(wallCard()).getByRole('button', { name: 'Select RSI' }))
    fireEvent.click(within(wallCard()).getByRole('button', { name: /3\.69/ }))
    expect(within(wallCard()).getByRole('button', { name: 'Select RSI' })).toHaveClass('active')
    fireEvent.click(screen.getByRole('button', { name: 'Reset to typical' }))
    expect(within(wallCard()).getByRole('button', { name: 'Build Assembly' })).toHaveClass('active')
    expect(within(wallCard()).getByLabelText('Cavity Size')).toHaveValue('2x6 R24')
    expect(screen.getByText(/Same as Typical Tier 2/)).toBeInTheDocument()
  })
  it('the counter target is 10', () => {
    const { container } = editor()
    expect(container.querySelector('.points-target')).toHaveTextContent('10')
    expect(container.querySelector('.points-counter')).toHaveClass('baseline')
  })
})

// Fix round 1: rulings R42 and R43.
describe('BaselineEditor fix round 1', () => {
  it('R42: clearing the wall counts as the preset wall (points, changed list, note)', () => {
    const { container } = editor()
    const before = container.querySelector('.points-value').textContent
    fireEvent.click(within(wallCard()).getByRole('button', { name: 'Clear' }))
    expect(screen.getByText(/your usual house . meets Tier 2/)).toBeInTheDocument()
    expect(container.querySelector('.points-value')).toHaveTextContent(before)
    expect(screen.queryByText(/Changed from Typical Tier 2:/)).toBeNull()
    expect(screen.queryByText(/You picked/)).toBeNull()
  })
  it('R42: Select RSI with no level picked counts as the preset wall and stays in Select RSI', () => {
    editor()
    fireEvent.click(within(wallCard()).getByRole('button', { name: 'Select RSI' }))
    expect(within(wallCard()).getByRole('button', { name: 'Select RSI' })).toHaveClass('active')
    expect(screen.getByText(/your usual house . meets Tier 2/)).toBeInTheDocument()
    expect(screen.queryByText(/Changed from Typical Tier 2:/)).toBeNull()
  })
  it('R43: a card with no preset reads "no pick on this card"', () => {
    editor()
    fireEvent.click(within(card('Heated Volume')).getByRole('button', { name: /^\S+ 300[ +]/ }))
    expect(screen.getByText(/^Typical Tier 2: no pick on this card\. You picked 300 /)).toBeInTheDocument()
  })
  it('R43: an assembly pick reads its computed RSI and description', () => {
    editor()
    fireEvent.change(within(wallCard()).getByLabelText('Cavity Size'), { target: { value: '2x6 R22' } })
    expect(screen.getByText(/^Typical Tier 2: RSI 3\.99 \(2x6 R24 batt \+ 1 in XPS, OSB, vinyl\)\. You picked RSI \d\.\d\d \(2x6 R22 batt \+ 1 in XPS, OSB, vinyl\)\.$/)).toBeInTheDocument()
  })
  it('R43: dirty compares the draft with its start, not whether anything was touched', () => {
    const onDirtyChange = vi.fn()
    editor({ onDirtyChange })
    const vent = card('Ventilation')
    fireEvent.click(within(vent).getByRole('button', { name: 'Clear' }))   // no-op: back to 65
    fireEvent.click(screen.getByRole('button', { name: 'Reset to typical' }))
    fireEvent.click(within(wallCard()).getByRole('button', { name: 'Select RSI' }))   // empty wall = preset
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(within(vent).getByRole('button', { name: 'Clear' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(within(vent).getByRole('button', { name: /75/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to typical' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
  it('R43: Done after picking gas DHW saves dhwGas and not dhwElectric', () => {
    const onDone = vi.fn()
    editor({ onDone })
    fireEvent.click(within(card('DHW (Gas- or oil-fired)')).getByRole('button', { name: /0\.92/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    const picks = onDone.mock.calls[0][0]
    expect(picks.cards.dhwGas).toBe(0.92)
    expect(picks.cards).not.toHaveProperty('dhwElectric')
  })
})
