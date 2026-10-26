import React from 'react'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { Harness } from './__testing__/costHarness'

const PROPS = { selections: { windowsDoors: 1, dhwElectric: 0 }, wallSelection: { simpleIndex: 7 } }
const lineButton = name => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const openLine = name => fireEvent.click(lineButton(name))
const totals = () => {
  const cells = within(screen.getByRole('row', { name: 'total' })).getAllByRole('cell').map(c => c.textContent)
  return cells.slice(1)
}

describe('CategoryLine variants', () => {
  it("C renders today's tree", () => {
    render(<Harness {...PROPS} variant="c" />)
    openLine('Above-ground walls')
    expect(screen.getByRole('button', { name: /^Layers/ })).toBeInTheDocument()
    expect(screen.queryByTestId(/^variant-/)).toBeNull()
  })
  it('A renders the variant table and no Layers', () => {
    render(<Harness {...PROPS} variant="a" />)
    openLine('Above-ground walls')
    expect(screen.getByTestId('variant-a-aboveGroundWalls')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Layers/ })).toBeNull()
    expect(document.querySelector('.cost-tiles')).toBeNull()
    expect(screen.getByText('Supplied and installed. Installed prices are assumed to include contractor overhead, profit and waste.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'change house' })).toBeInTheDocument()
  })
  it('override button toggles edit table', () => {
    render(<Harness {...PROPS} variant="b" />)
    openLine('Above-ground walls')
    fireEvent.click(screen.getByRole('button', { name: /Use my own prices/ }))
    expect(screen.getByTestId('specifics-aboveGroundWalls')).toBeInTheDocument()
    expect(screen.queryByTestId('variant-b-aboveGroundWalls')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByTestId('variant-b-aboveGroundWalls')).toBeInTheDocument()
    expect(screen.queryByTestId('specifics-aboveGroundWalls')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Layers/ })).toBeNull()
  })
  it('A and B show the same totals as C', () => {
    const seen = {}
    for (const v of ['c', 'a', 'b']) {
      render(<Harness {...PROPS} variant={v} />)
      seen[v] = []
      for (const name of ['Above-ground walls', 'Windows and doors']) {
        openLine(name)
        if (v === 'c') fireEvent.click(document.querySelector('.specifics-disclosure .disclosure-row'))
        seen[v].push(totals())
        openLine(name)
      }
      cleanup()
    }
    expect(seen.a).toEqual(seen.c)
    expect(seen.b).toEqual(seen.c)
  })
})
