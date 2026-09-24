import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BelowGradeWallBuilder, { buildFoundationLayers, FOUNDATION_DEFAULTS } from './BelowGradeWallBuilder'
import { calculateBelowGradeAssembly, calculateBelowGradeRsi, categories } from '../data/ecpData'

// Stateful harness: App.jsx owns the selection, the builder only proposes replacements.
// `spy` sees every proposal; the harness applies it so the UI re-renders like the app does.
function Harness({ spy = () => {}, initial = {} }) {
  const [selection, setSelection] = useState(initial)
  return (
    <BelowGradeWallBuilder
      selection={selection}
      onSelect={next => { spy(next); setSelection(next) }}
    />
  )
}

const pick = (id, value) => fireEvent.change(document.getElementById(id), { target: { value } })
const lastCall = spy => spy.mock.calls[spy.mock.calls.length - 1][0]

describe('BelowGradeWallBuilder', () => {
  it('starts in builder mode with a Select... foundation type and a prompt', () => {
    render(<Harness />)
    expect(screen.getByText('Below Grade Walls')).toBeInTheDocument()
    expect(document.getElementById('bg-foundationType')).toHaveValue('')
    expect(screen.getByText('Select a foundation type to begin')).toBeInTheDocument()
  })

  it('choosing Poured Concrete fills the defaults and shows 3.12 and +0.2', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'concrete')
    expect(lastCall(spy)).toEqual(FOUNDATION_DEFAULTS.concrete)
    expect(lastCall(spy)).toMatchObject({
      foundationType: 'concrete', concreteThickness: '200', extInsThickness: 'None', intInsThickness: 'None',
      hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22', finish: 'gypsum',
    })
    expect(screen.getByText(/^3\.12 \(R-/)).toBeInTheDocument()
    expect(screen.getByText('+0.2')).toBeInTheDocument()
    expect(screen.queryByTestId('bg-hint')).toBeNull()
    expect(screen.queryByText(/Does not meet code/)).toBeNull()
  })

  it('R20 at 16" shows 2.87, the warning and the hint; 24" spacing meets at 2.98 with +0', () => {
    render(<Harness />)
    pick('bg-foundationType', 'concrete')
    pick('bg-cavityType', '2x6 R20')
    expect(screen.getByText(/^2\.87 \(R-/)).toBeInTheDocument()
    expect(screen.getByText('⚠ Does not meet code — 0.11 RSI below minimum 2.98')).toBeInTheDocument()
    expect(screen.getByTestId('bg-hint')).toHaveTextContent(/R20 at 16" o\.c\. does not reach the 2\.98 minimum/)
    expect(screen.getByLabelText(/held off the concrete/)).toBeInTheDocument()
    pick('bg-studSpacing', '24"')
    expect(screen.getByText(/^2\.98 \(R-/)).toBeInTheDocument()
    expect(screen.getByText('+0')).toBeInTheDocument()
    expect(screen.queryByTestId('bg-hint')).toBeNull()
  })

  it('R20 at 16" with 2" XPS outside passes, so the R20 hint stays hidden', () => {
    render(<Harness />)
    pick('bg-foundationType', 'concrete')
    pick('bg-cavityType', '2x6 R20')
    pick('bg-extInsType', 'XPS')
    pick('bg-extInsThickness', '2"')
    expect(screen.getByText(/^4\.55 \(R-/)).toBeInTheDocument()
    expect(screen.queryByText(/Does not meet code/)).toBeNull()
    expect(screen.queryByTestId('bg-hint')).toBeNull()
  })

  it('a thickness chosen before its type prompts for the type, not "No data"', () => {
    render(<Harness />)
    pick('bg-foundationType', 'concrete')
    pick('bg-extInsThickness', '2"')
    expect(screen.getByText('Select an insulation type')).toBeInTheDocument()
    expect(screen.queryByText('No data for this combination')).toBeNull()
    pick('bg-extInsType', 'XPS')
    expect(screen.queryByText('Select an insulation type')).toBeNull()
    pick('bg-intInsThickness', '1"')
    expect(screen.getByText('Select an insulation type')).toBeInTheDocument()
  })

  it('Dense Pack Cellulose asks for a stud size, not a cavity size', () => {
    render(<Harness />)
    pick('bg-foundationType', 'concrete')
    pick('bg-cavityMaterial', 'Dense Pack Cellulose')
    expect(document.getElementById('bg-studDepth')).toBeInTheDocument()
    expect(document.getElementById('bg-cavityType')).toBeNull()
  })

  it('switching foundation type replaces the whole selection (concrete -> ICF drops every concrete field)', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'concrete')
    pick('bg-extInsType', 'XPS')
    pick('bg-extInsThickness', '2"')
    pick('bg-foundationType', 'icf')
    expect(lastCall(spy)).toEqual({ foundationType: 'icf', finish: 'gypsum' })
    expect(Object.keys(lastCall(spy))).not.toContain('concreteThickness')
    expect(Object.keys(lastCall(spy))).not.toContain('hasStudWall')
    expect(Object.keys(lastCall(spy))).not.toContain('extInsType')
    // and ICF -> block picks up the block defaults, not the concrete ones
    pick('bg-foundationType', 'block')
    expect(lastCall(spy)).toEqual(FOUNDATION_DEFAULTS.block)
    expect(lastCall(spy).blockType).toBe('normal_empty')
    expect(Object.keys(lastCall(spy))).not.toContain('concreteThickness')
    expect(Object.keys(lastCall(spy))).not.toContain('icfFormThickness')
    // blank foundation type clears everything
    pick('bg-foundationType', '')
    expect(lastCall(spy)).toEqual({})
  })

  it('ICF 2-1/2" shows 3.56 and +0.8 with the finish locked to gypsum', () => {
    render(<Harness />)
    pick('bg-foundationType', 'icf')
    expect(screen.getByText('Select form thickness to calculate RSI')).toBeInTheDocument()
    pick('bg-icfFormThickness', '2-1/2"')
    expect(screen.getByText(/^3\.56 \(R-/)).toBeInTheDocument()
    expect(screen.getByText('+0.8')).toBeInTheDocument()
    expect(document.getElementById('bg-finish')).toBeDisabled()
    expect(document.getElementById('bg-finish')).toHaveValue('gypsum')
    expect(screen.getByText(/required over foam, 9\.10\.17\.10/)).toBeInTheDocument()
  })

  it('interior foam disables the finish select and forces gypsum in the selection', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'concrete')
    pick('bg-finish', 'none')
    expect(lastCall(spy).finish).toBe('none')
    expect(document.getElementById('bg-finish')).not.toBeDisabled()
    pick('bg-intInsType', 'XPS')
    pick('bg-intInsThickness', '1-1/2"')
    expect(document.getElementById('bg-finish')).toBeDisabled()
    expect(document.getElementById('bg-finish')).toHaveValue('gypsum')
    expect(lastCall(spy).finish).toBe('gypsum')
    // removing the foam unlocks it again (value stays gypsum until the user changes it)
    pick('bg-intInsThickness', 'None')
    expect(document.getElementById('bg-finish')).not.toBeDisabled()
  })

  it('cavity material change clears cavity type and offset; empty cavity switches to a stud size select', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'concrete')
    pick('bg-cavityType', '2x6 R20')
    fireEvent.click(screen.getByLabelText(/held off the concrete/))
    expect(lastCall(spy).studOffset).toBe(true)
    expect(screen.getByText(/^2\.96 \(R-/)).toBeInTheDocument()
    pick('bg-cavityMaterial', 'Mineral Wool Batt')
    expect(lastCall(spy)).toMatchObject({ cavityMaterial: 'Mineral Wool Batt', cavityType: undefined, studOffset: undefined })
    expect(screen.getByText('Select stud wall options to calculate RSI')).toBeInTheDocument()
    pick('bg-cavityMaterial', 'None (empty)')
    expect(lastCall(spy)).toMatchObject({ cavityMaterial: 'None (empty)', studDepth: '2x6', cavityType: undefined })
    expect(document.getElementById('bg-studDepth')).toHaveValue('2x6')
    expect(document.getElementById('bg-cavityType')).toBeNull()
    pick('bg-studDepth', '2x4')
    // 0.205 frame + 0.08 concrete + 0.08 gypsum + 0.12 film, far below code
    const expected = calculateBelowGradeRsi(lastCall(spy)).toFixed(2)
    expect(screen.getByText(new RegExp(`^${expected.replace('.', '\\.')} \\(R-`))).toBeInTheDocument()
    expect(screen.getByText(/Does not meet code/)).toBeInTheDocument()
  })

  it('cavity type change away from 2x6 R20 drops the offset', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'concrete')
    pick('bg-cavityType', '2x6 R20')
    fireEvent.click(screen.getByLabelText(/held off the concrete/))
    pick('bg-cavityType', '2x6 R24')
    expect(lastCall(spy).studOffset).toBeUndefined()
    expect(screen.queryByLabelText(/held off the concrete/)).toBeNull()
  })

  it('turning the stud wall off clears its fields; turning it on restores the defaults', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'concrete')
    fireEvent.click(screen.getByLabelText('Interior stud wall'))
    const off = lastCall(spy)
    expect(off.hasStudWall).toBe(false)
    expect(off.studSpacing).toBeUndefined()
    expect(off.cavityMaterial).toBeUndefined()
    expect(off.cavityType).toBeUndefined()
    expect(off.studDepth).toBeUndefined()
    expect(off.studOffset).toBeUndefined()
    expect(document.getElementById('bg-studSpacing')).toBeNull()
    // exterior 4" XPS, stud wall off, finish none -> 3.61 and +0.8
    pick('bg-extInsType', 'XPS')
    pick('bg-extInsThickness', '4"')
    pick('bg-finish', 'none')
    expect(screen.getByText(/^3\.61 \(R-/)).toBeInTheDocument()
    expect(screen.getByText('+0.8')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Interior stud wall'))
    expect(lastCall(spy)).toMatchObject({ hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22' })
  })

  it('block light-weight empty with the default stud wall shows 3.36 and +0.2', () => {
    render(<Harness />)
    pick('bg-foundationType', 'block')
    pick('bg-blockType', 'light_empty')
    expect(screen.getByText(/^3\.36 \(R-/)).toBeInTheDocument()
    expect(screen.getByText('+0.2')).toBeInTheDocument()
  })

  it('PWF default shows 3.98 and +1.4; changing the stud clears the cavity size', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'pwf')
    expect(lastCall(spy)).toEqual(FOUNDATION_DEFAULTS.pwf)
    expect(screen.getByText(/^3\.98 \(R-/)).toBeInTheDocument()
    expect(screen.getByText('+1.4')).toBeInTheDocument()
    expect(document.getElementById('bg-extInsType')).toBeNull()
    expect(document.getElementById('bg-studSpacing')).toBeNull()
    pick('bg-pwfStud', '2x6')
    expect(lastCall(spy)).toMatchObject({ pwfStud: '2x6', pwfCavityType: undefined })
    expect(screen.getByText('Select stud wall options to calculate RSI')).toBeInTheDocument()
    const opts = [...document.getElementById('bg-pwfCavityType').options].map(o => o.value)
    expect(opts).toEqual(['', '2x6 R20', '2x6 R22', '2x6 R24'])
  })

  it('lists every layer under "How it adds up"', () => {
    render(<Harness />)
    pick('bg-foundationType', 'concrete')
    const list = screen.getByTestId('bg-layers')
    expect(list).toHaveTextContent('200 mm (8") concrete')
    expect(list).toHaveTextContent('Interior air film')
    expect(list).toHaveTextContent('0.12')
    expect(list.querySelectorAll('li')).toHaveLength(4)
    // The stud is named once in the frame line.
    expect(list).toHaveTextContent('2x6 @ 16" Fiberglass Batt R22 ... ')
    expect(list).not.toHaveTextContent('Batt 2x6')
  })

  it('layer labels: blown-in names the material only, block names its thickness', () => {
    const blown = calculateBelowGradeAssembly({ ...FOUNDATION_DEFAULTS.concrete, cavityMaterial: 'Loose Fill Cellulose', cavityType: undefined, studDepth: '2x6' })
    expect(blown.layers.find(l => l.id === 'frame').label).toBe('2x6 @ 16" Loose Fill Cellulose')
    const empty = calculateBelowGradeAssembly({ ...FOUNDATION_DEFAULTS.concrete, cavityMaterial: 'None (empty)', cavityType: undefined, studDepth: '2x4' })
    expect(empty.layers.find(l => l.id === 'frame').label).toBe('2x4 @ 16" empty cavity')
    const off = calculateBelowGradeAssembly({ ...FOUNDATION_DEFAULTS.concrete, cavityType: '2x6 R20', studOffset: true })
    expect(off.layers.find(l => l.id === 'frame').label).toBe('2x6 @ 16" Fiberglass Batt R20, held off the wall')
    const block = calculateBelowGradeAssembly({ ...FOUNDATION_DEFAULTS.block, blockType: 'light_empty' })
    expect(block.layers.find(l => l.id === 'block').label).toBe('Light-weight block (190 mm), cores empty')
    const lime = calculateBelowGradeAssembly({ ...FOUNDATION_DEFAULTS.block, blockType: 'limestone_perlite' })
    expect(lime.layers.find(l => l.id === 'block').label).toBe('Limestone aggregate block (190 mm), cores filled with perlite')
  })

  it('mode switch clears the selection; simple mode offers the four options incl. the 2.98 floor', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'concrete')
    fireEvent.click(screen.getByRole('button', { name: 'Select RSI' }))
    expect(lastCall(spy)).toEqual({})
    const cat = categories.find(c => c.id === 'belowGradeWalls')
    expect(cat.options).toHaveLength(4)
    const buttons = screen.getAllByRole('button').filter(b => b.classList.contains('option-button'))
    expect(buttons).toHaveLength(4)
    fireEvent.click(buttons[0])
    expect(lastCall(spy)).toEqual({ simpleIndex: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(lastCall(spy)).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: 'Build Assembly' }))
    expect(lastCall(spy)).toEqual({})
  })

  it('Clear in builder mode empties the selection', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    pick('bg-foundationType', 'pwf')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(lastCall(spy)).toEqual({})
  })

  it('shows the code notes and the moisture disclaimer once a type is chosen', () => {
    render(<Harness />)
    expect(screen.queryByText(/9\.36\.8\.7\.\(4\)/)).toBeNull()
    pick('bg-foundationType', 'concrete')
    expect(screen.getByText(/lowest effective RSI sets the points \(9\.36\.8\.7\.\(4\)\)/)).toBeInTheDocument()
    expect(screen.getByText(/full height of the foundation wall \(9\.25\.2\.3\.\(4\)\)/)).toBeInTheDocument()
    expect(screen.getByText(/600 mm or more above grade/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /LEEP/ })).toBeInTheDocument()
    // The three code sentences are their own list under the disclaimer, one item each.
    expect(screen.getByTestId('bg-code-notes').querySelectorAll('li')).toHaveLength(3)
  })
})

describe('buildFoundationLayers (input for the Task 4 drawing)', () => {
  const layersFor = sel => buildFoundationLayers(sel, calculateBelowGradeAssembly(sel))

  it('returns [] for an incomplete selection', () => {
    expect(buildFoundationLayers({}, null)).toEqual([])
    expect(layersFor({ foundationType: 'icf' })).toEqual([])
  })

  it('default concrete: soil, concrete, frame, gypsum from outside to inside', () => {
    const layers = layersFor(FOUNDATION_DEFAULTS.concrete)
    expect(layers.map(l => l.kind)).toEqual(['soil', 'concrete', 'frame', 'gypsum'])
    expect(layers.map(l => l.thicknessInches)).toEqual([2, 8, 5.5, 0.5])
    const frame = layers.find(l => l.kind === 'frame')
    expect(frame).toMatchObject({ studDepth: '2x6', studSpacing: 16, cavityLabel: '2x6 R22' })
    expect(layers.every(l => typeof l.id === 'string' && typeof l.label === 'string')).toBe(true)
  })

  it('concrete with both foams, 250 mm, 2x4 studs at 24", no finish', () => {
    const sel = {
      ...FOUNDATION_DEFAULTS.concrete, concreteThickness: '250',
      extInsType: 'XPS', extInsThickness: '2"', intInsType: 'EPS', intInsThickness: '1-1/2"',
      studSpacing: '24"', cavityType: '2x4 R14', finish: 'none',
    }
    const layers = layersFor(sel)
    expect(layers.map(l => l.kind)).toEqual(['soil', 'ext_ins', 'concrete', 'int_ins', 'frame', 'gypsum'])
    expect(layers.map(l => l.thicknessInches)).toEqual([2, 2, 10, 1.5, 3.5, 0.5])
    expect(layers.find(l => l.kind === 'frame')).toMatchObject({ studDepth: '2x4', studSpacing: 24 })
  })

  it('block is 7.5" and the ICF is foam / concrete / foam', () => {
    expect(layersFor(FOUNDATION_DEFAULTS.block).map(l => [l.kind, l.thicknessInches])).toEqual(
      [['soil', 2], ['block', 7.5], ['frame', 5.5], ['gypsum', 0.5]]
    )
    const icf = layersFor({ foundationType: 'icf', icfFormThickness: '2-1/2"', finish: 'gypsum' })
    expect(icf.map(l => [l.kind, l.thicknessInches])).toEqual(
      [['soil', 2], ['icf_foam', 2.5], ['concrete', 6], ['icf_foam', 2.5], ['gypsum', 0.5]]
    )
  })

  it('PWF: soil, sheathing, frame, gypsum', () => {
    const layers = layersFor(FOUNDATION_DEFAULTS.pwf)
    expect(layers.map(l => l.kind)).toEqual(['soil', 'sheathing', 'frame', 'gypsum'])
    expect(layers.find(l => l.kind === 'frame')).toMatchObject({ studDepth: '2x8', studSpacing: 16, thicknessInches: 7.25, cavityLabel: '2x8 R28' })
  })

  it('empty cavity and stud wall off', () => {
    const empty = layersFor({ ...FOUNDATION_DEFAULTS.concrete, cavityMaterial: 'None (empty)', cavityType: undefined, studDepth: '2x4' })
    expect(empty.find(l => l.kind === 'frame')).toMatchObject({ studDepth: '2x4', thicknessInches: 3.5, cavityLabel: 'empty cavity' })
    const bare = layersFor({ ...FOUNDATION_DEFAULTS.concrete, hasStudWall: false, finish: 'none' })
    expect(bare.map(l => l.kind)).toEqual(['soil', 'concrete'])
  })
})
