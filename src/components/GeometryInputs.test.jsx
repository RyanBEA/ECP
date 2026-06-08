import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GeometryInputs from './GeometryInputs'

const base = { length_m: 10, width_m: 8, fdwr: 0.17 }

describe('GeometryInputs', () => {
  it('shows the computed floor area (L×W×2 storeys)', () => {
    render(<GeometryInputs geometry={base} onChange={() => {}} fdwrError={null} />)
    expect(screen.getByText(/160/)).toBeTruthy() // 10*8*2
  })

  it('calls onChange with the updated field', () => {
    const onChange = vi.fn()
    render(<GeometryInputs geometry={base} onChange={onChange} fdwrError={null} />)
    fireEvent.change(screen.getByLabelText(/length/i), { target: { value: '12' } })
    expect(onChange).toHaveBeenCalledWith('length_m', 12)
  })

  it('renders an inline FDWR error when provided', () => {
    render(<GeometryInputs geometry={base} onChange={() => {}} fdwrError="FDWR must be 0.05–0.40" />)
    expect(screen.getByText(/0.05/)).toBeTruthy()
  })
})
