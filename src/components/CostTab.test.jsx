import React, { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import CostTab from './CostTab'
import { houseNoun } from './CategoryLine'
import { useHouseCost, resolveHouseFields } from '../costing/useHouseCost'

function Harness({ selections = {}, wallSelection = {} }) {
  const [houseType, setHouseType] = useState('singleDetached')
  const [fieldOverrides, setFieldOverrides] = useState({})
  const [baselineChoice, setBaselineChoice] = useState('typicalTier2')
  const [overrides, setOverrides] = useState({})
  const [openLine, setOpenLine] = useState(null)
  const [frozenOrder, setFrozenOrder] = useState(null)
  const houseFields = resolveHouseFields(houseType, fieldOverrides)
  const cost = useHouseCost({ selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse: {}, overrides, frozenOrder })
  return <CostTab cost={cost} houseType={houseType} houseFields={houseFields} overriddenKeys={Object.keys(fieldOverrides[houseType] || {})}
    baselineChoice={baselineChoice} usualHouse={{}} overrideCount={cost.overrideCount}
    onTypeChange={t => { setHouseType(t); setFieldOverrides({}) }}
    onFieldChange={(k, v) => setFieldOverrides(p => ({ ...p, [houseType]: { ...(p[houseType] || {}), [k]: v } }))}
    onBaselineChoice={setBaselineChoice} onEditUsual={() => {}} onResetUsual={() => {}}
    onOverride={(side, cat, comp, opt, field, v) => setOverrides(p => ({ ...p, [`${side}/${cat}/${comp}/${opt}`]: { ...(p[`${side}/${cat}/${comp}/${opt}`] || {}), [field]: v } }))}
    onLineOverride={() => {}} onResetAllOverrides={() => setOverrides({})} chipHidden={false} onToggleChip={() => {}}
    openLine={openLine} onOpenLine={setOpenLine} frozenOrder={frozenOrder} onFreezeOrder={setFrozenOrder} notice="" />
}

describe('CostTab', () => {
  it('shows the empty state when nothing is picked', () => {
    render(<Harness />)
    expect(screen.getByText(/Pick options on the Points tab/)).toBeInTheDocument()
    // query mechanics (standing rule 2): /Typical Tier 2/ also matches the sidebar; scope to the statement
    expect(within(screen.getByText(/Pick options on the Points tab/).closest('section')).getByText(/Typical Tier 2/)).toBeInTheDocument()
  })
  it('shows a headline, sorted lines, and opens a line to level 2 then level 3', () => {
    render(<Harness selections={{ hrv: 2, windowsDoors: 1, airTightness: 2 }} wallSelection={{ simpleIndex: 5 }} />)
    expect(screen.getByRole('heading', { level: 2, name: /more than Typical Tier 2, before HST/ })).toBeInTheDocument()
    const rows = screen.getAllByRole('button', { name: /^(Above-ground walls|Windows and doors|Airtightness|Ventilation|Water heating|Below-grade walls|Heated volume)/ })
    expect(rows[rows.length - 1]).toHaveTextContent('Heated volume')
    fireEvent.click(screen.getByRole('button', { name: /^Above-ground walls/ }))
    // query mechanics (standing rule 2): /assumed assembly/ matches the small print, the table and the list item;
    // scope to the open level 2 and accept several matches
    expect(within(document.querySelector('.line-detail')).getAllByText(/assumed assembly/).length).toBeGreaterThan(0)
    expect(within(document.querySelector('.line-detail')).getByText(/Build the assembly on Points to price your own/)).toBeInTheDocument()
    expect(screen.getByText(/from your house fields/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'see layers' }))
    expect(screen.getByTestId('layer-table-aboveGroundWalls')).toBeInTheDocument()
  })
  it('changing the house type clears field overrides with a notice and mini-home drops below grade', () => {
    render(<Harness selections={{ hrv: 2 }} />)
    fireEvent.change(screen.getByLabelText('Storeys'), { target: { value: '3' } })
    expect(screen.getByText('changed')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'miniHome' } })
    expect(screen.queryByText('changed')).toBeNull()
    expect(screen.getByText(/not applicable \(no foundation wall\)/)).toBeInTheDocument()
  })
  it('bedrooms above 5 reveals the designed airflow field and the ventilation line asks for it', () => {
    render(<Harness selections={{ hrv: 1 }} />)
    fireEvent.change(screen.getByLabelText('Bedrooms'), { target: { value: 'moreThan5' } })
    expect(screen.getByLabelText('Designed airflow (L/s)')).toBeInTheDocument()
    expect(screen.getByText(/enter the designed airflow/)).toBeInTheDocument()
  })
})

// Controller rulings R3 (amended), R36 and R39: tests added beside the brief's.
const SQFT_PER_M2 = 10.76391042

function SpyHarness({ selections = {}, wallSelection = {}, overrides = {}, onOverride, onLineOverride, onResetCategoryOverrides }) {
  const [openLine, setOpenLine] = useState(null)
  const houseFields = resolveHouseFields('singleDetached', {})
  const cost = useHouseCost({ selections, wallSelection, houseType: 'singleDetached', houseFields, baselineChoice: 'typicalTier2', usualHouse: {}, overrides, frozenOrder: null })
  return <CostTab cost={cost} houseType="singleDetached" houseFields={houseFields} overriddenKeys={[]}
    baselineChoice="typicalTier2" usualHouse={{}} overrideCount={cost.overrideCount}
    onTypeChange={() => {}} onFieldChange={() => {}} onBaselineChoice={() => {}} onEditUsual={() => {}} onResetUsual={() => {}}
    onOverride={onOverride || (() => {})} onLineOverride={onLineOverride || (() => {})} onResetAllOverrides={() => {}}
    onResetCategoryOverrides={onResetCategoryOverrides}
    chipHidden={false} onToggleChip={() => {}} openLine={openLine} onOpenLine={setOpenLine} frozenOrder={null} onFreezeOrder={() => {}} notice="" />
}

const openLayers = (name, link) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
  fireEvent.click(screen.getByRole('button', { name: link }))
}
const typeInto = (cellName, value) => {
  fireEvent.click(screen.getByRole('button', { name: `Override ${cellName}` }))
  const input = screen.getByRole('spinbutton', { name: cellName })
  fireEvent.change(input, { target: { value: String(value) } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('CostTab unit conversion (R3 amended)', () => {
  it('stores an m2 component override typed in $/sq ft as $/m2', () => {
    const onOverride = vi.fn()
    render(<SpyHarness selections={{ windowsDoors: 1 }} onOverride={onOverride} />)
    openLayers('Windows and doors', 'see parts')
    typeInto('This design windows material', 2.5)
    expect(onOverride).toHaveBeenCalledTimes(1)
    const [side, cat, comp, , field, v] = onOverride.mock.calls[0]
    expect([side, cat, comp, field]).toEqual(['design', 'windowsDoors', 'windows', 'material'])
    expect(v).toBeCloseTo(2.5 * SQFT_PER_M2, 9)
  })
  it('passes an each door override through unchanged', () => {
    const onOverride = vi.fn()
    render(<SpyHarness selections={{ windowsDoors: 1 }} onOverride={onOverride} />)
    openLayers('Windows and doors', 'see parts')
    typeInto('This design doors material', 950)
    expect(onOverride).toHaveBeenCalledTimes(1)
    const [side, cat, comp, , field, v] = onOverride.mock.calls[0]
    expect([side, cat, comp, field, v]).toEqual(['design', 'windowsDoors', 'doors', 'material', 950])
  })
  it('converts a line override on an m2 line and passes an each line through', () => {
    const onLineOverride = vi.fn()
    render(<SpyHarness selections={{ windowsDoors: 1, hrv: 2 }} onLineOverride={onLineOverride} />)
    openLayers('Windows and doors', 'see parts')
    const win = screen.getByRole('spinbutton', { name: 'I pay this much per sq ft for This design' })
    fireEvent.change(win, { target: { value: '12' } })
    fireEvent.keyDown(win, { key: 'Enter' })
    expect(onLineOverride.mock.calls[0][0]).toBe('design')
    expect(onLineOverride.mock.calls[0][1]).toBe('windowsDoors')
    expect(onLineOverride.mock.calls[0][2]).toBeCloseTo(12 * SQFT_PER_M2, 9)
    openLayers('Ventilation', 'see parts')
    const hrv = screen.getByRole('spinbutton', { name: 'I pay this much per unit for This design' })
    fireEvent.change(hrv, { target: { value: '900' } })
    fireEvent.keyDown(hrv, { key: 'Enter' })
    expect(onLineOverride).toHaveBeenLastCalledWith('design', 'hrv', 900)
  })
})

describe('CostTab per-card count and level-2 sentences (R36, R39, R4)', () => {
  it('passes the per-card changed count and resets that card', () => {
    const onResetCategoryOverrides = vi.fn()
    render(<SpyHarness selections={{ windowsDoors: 1 }} overrides={{ 'design/windowsDoors/doors/u_1_22': { material: 900, labour: 100 } }} onResetCategoryOverrides={onResetCategoryOverrides} />)
    openLayers('Windows and doors', 'see parts')
    expect(screen.getByText(/You've changed 1 price on this card/)).toBeInTheDocument()
    fireEvent.click(within(screen.getByTestId('layer-table-windowsDoors')).getByRole('button', { name: 'reset all' }))
    expect(onResetCategoryOverrides).toHaveBeenCalledWith('windowsDoors')
  })
  it('states the house type and footprint, and what cancels', () => {
    render(<SpyHarness selections={{ windowsDoors: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Windows and doors/ }))
    expect(screen.getByText('Based on a single detached house, 33 x 30 ft (10.1 x 9.1 m); other shapes will differ.')).toBeInTheDocument()
    expect(screen.getByText('Items identical on both sides are priced and cancel in the difference.')).toBeInTheDocument()
  })
  it('says a below-grade assembly of your own cannot be priced', () => {
    render(<SpyHarness selections={{ belowGradeWalls: 0 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Below-grade walls/ }))
    expect(screen.getByText('Your own foundation assembly cannot be priced in this version.')).toBeInTheDocument()
  })
})

// Fix round 1 (ruling R40)
const headline = () => screen.getByRole('heading', { level: 2 }).textContent
const lineOrder = () => screen.getAllByRole('button', { name: /^(Above-ground walls|Windows and doors|Airtightness|Ventilation|Water heating|Below-grade walls|Heated volume)/ })
  .map(b => b.querySelector('.line-name').firstChild.textContent)

describe('CostTab open lines and order (R40)', () => {
  it('closes an open line that stops applying', () => {
    // a second pick keeps the statement out of the empty state after the switch
    render(<Harness selections={{ belowGradeWalls: 0, hrv: 2 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Below-grade walls/ }))
    expect(document.querySelector('.line-detail')).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'miniHome' } })
    expect(document.querySelector('.line-detail')).toBeNull()
    expect(screen.getByRole('button', { name: /^Below-grade walls/ })).toHaveAttribute('aria-expanded', 'false')
    // the order was released: the not-applicable line sorts last again
    expect(lineOrder().at(-1)).toBe('Below-grade walls')
  })
  it('keeps the order while a line is open and re-sorts when it closes', () => {
    render(<Harness selections={{ windowsDoors: 1, airTightness: 2 }} />)
    expect(lineOrder().slice(0, 2)).toEqual(['Windows and doors', 'Airtightness'])
    fireEvent.click(screen.getByRole('button', { name: /^Airtightness/ }))
    fireEvent.change(screen.getByLabelText('Glazing ratio (%)'), { target: { value: '5' } })
    expect(lineOrder().slice(0, 2)).toEqual(['Windows and doors', 'Airtightness'])
    fireEvent.click(screen.getByRole('button', { name: /^Airtightness/ }))
    expect(lineOrder().slice(0, 2)).toEqual(['Airtightness', 'Windows and doors'])
  })
  it('names the house type in lower case, adding "house" only where the name does not end in home', () => {
    expect(houseNoun('Single detached')).toBe('single detached house')
    expect(houseNoun('Row home')).toBe('row home')
    expect(houseNoun('Mini-home')).toBe('mini-home')
  })
})

// Final fix wave (rulings R44, R45)
const detail = () => within(document.querySelector('.line-detail'))
const OVERHEAD = 'Installed prices are assumed to include contractor overhead, profit and waste.'

describe('CostTab level 2: per-line price source (R44)', () => {
  it('a windows line, all placeholder prices, gets the placeholder sentence', () => {
    render(<SpyHarness selections={{ windowsDoors: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Windows and doors/ }))
    expect(detail().getByText(`Prices: placeholders (no LEEP data for this item), supplied and installed, before HST. ${OVERHEAD}`)).toBeInTheDocument()
    expect(detail().queryByText(/LEEP [A-Z]{2}/)).toBeNull()
  })
  it('the walls line gets a LEEP mixed sentence', () => {
    render(<SpyHarness wallSelection={{ simpleIndex: 5 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Above-ground walls/ }))
    const li = detail().getByText(/^Prices: LEEP /)
    expect(li.textContent).toMatch(/^Prices: LEEP (ON|MB|BC)(\/(ON|MB|BC))* rows for (\d+) of (\d+) layers, placeholders for the rest, supplied and installed, before HST\. /)
    const { n, m } = li.textContent.match(/ rows for (?<n>\d+) of (?<m>\d+) layers/).groups
    expect(Number(n)).toBeGreaterThan(0)
    expect(Number(n)).toBeLessThan(Number(m))
    expect(li.textContent.endsWith(OVERHEAD)).toBe(true)
  })
})

describe('CostTab level 2: wall RSI, doors row and notes (R45)', () => {
  it('an assembly wall reads "RSI x.xx (...)" in level 2 and the small print; a level keeps "assumed assembly"', () => {
    render(<SpyHarness wallSelection={{ simpleIndex: 5 }} />)
    const row = screen.getByRole('button', { name: /^Above-ground walls/ })
    expect(row).toHaveTextContent('Typical Tier 2: RSI 3.99 (2x6 R24 batt + 1 in XPS, OSB, vinyl)')
    fireEvent.click(row)
    const table = document.querySelector('.comparison')
    expect(within(table).getByText('RSI 3.99 (2x6 R24 batt + 1 in XPS, OSB, vinyl)')).toBeInTheDocument()
    expect(within(table).getByText(/^RSI 4\.4, assumed assembly: /)).toBeInTheDocument()
  })
  it('windows level 2 has a doors row, and per unit x quantity + doors = cost', () => {
    render(<SpyHarness selections={{ windowsDoors: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Windows and doors/ }))
    const rows = [...document.querySelectorAll('.comparison tbody tr')].map(tr => [...tr.cells].map(td => td.textContent))
    const doors = rows.find(r => r[0] === 'doors')
    expect(doors).toBeDefined()
    expect(doors[1]).toMatch(/^2 each x \$[\d,]+$/)
    expect(doors[2]).toMatch(/^2 each x \$[\d,]+$/)
    expect(rows.map(r => r[0])).toEqual(['option', 'installed', 'quantity', 'doors', 'cost'])
    const num = t => Number(t.replace(/[^\d.]/g, ''))
    for (const col of [1, 2]) {
      const per = num(rows[1][col]), qty = num(rows[2][col])
      const [, count, each] = rows[3][col].match(/^(\d+) each x (.+)$/)
      // display rounding: per unit to the cent, quantity to the sq ft, cost to the dollar
      expect(Math.abs(per * qty + Number(count) * num(each) - num(rows[4][col]))).toBeLessThan(qty * 0.005 + per * 0.5 + 1)
    }
  })
  it('the DHW line says gas heaters are priced as natural gas', () => {
    render(<SpyHarness selections={{ dhwGas: 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Water heating/ }))
    expect(detail().getByText('Gas heaters are priced as natural gas.')).toBeInTheDocument()
  })
  it('the above-ground walls line notes rim joists', () => {
    render(<SpyHarness wallSelection={{ simpleIndex: 5 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^Above-ground walls/ }))
    expect(detail().getByText('Rim joists are the same in both houses and are not priced.')).toBeInTheDocument()
  })
})
