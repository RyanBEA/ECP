import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EnvelopeMirror from './EnvelopeMirror'

const ecpState = {
  above_grade_wall: { rsi: 4.5 }, below_grade_wall: { rsi: 2.97 },
  windows: { rsi: 0.82, shgc: 0.4 }, airtightness_ach50: 2.0,
  hrv: { sre: 0.75 }, dhw: { ef: 2.35 },
}
const sources = {
  aboveGradeWall: 'selected', belowGradeWall: 'default', windows: 'assumed',
  airtightness: 'selected', ventilation: 'selected', dhw: 'selected',
}

describe('EnvelopeMirror', () => {
  it('renders each envelope value', () => {
    render(<EnvelopeMirror ecpState={ecpState} sources={sources} />)
    expect(screen.getByText(/4.5/)).toBeTruthy()
    expect(screen.getByText(/2.35/)).toBeTruthy()
  })

  it('shows a default tag for unselected categories', () => {
    render(<EnvelopeMirror ecpState={ecpState} sources={sources} />)
    expect(screen.getAllByText('default').length).toBeGreaterThan(0)
  })

  it('states electric baseboard is fixed for MVP', () => {
    render(<EnvelopeMirror ecpState={ecpState} sources={sources} />)
    expect(screen.getByText(/baseboard/i)).toBeTruthy()
  })
})
