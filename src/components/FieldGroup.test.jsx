import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FieldGroup from './FieldGroup'

describe('FieldGroup', () => {
  it('renders number badge and title', () => {
    render(<FieldGroup number={1} title="Wall Configuration">content</FieldGroup>)
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('Wall Configuration')).toBeTruthy()
  })

  it('renders children', () => {
    render(<FieldGroup number={2} title="Test"><p>child content</p></FieldGroup>)
    expect(screen.getByText('child content')).toBeTruthy()
  })

  it('applies footnote variant class', () => {
    const { container } = render(
      <FieldGroup number={3} title="Assumptions" variant="footnote">info</FieldGroup>
    )
    expect(container.querySelector('.field-group.footnote')).toBeTruthy()
  })

  it('applies default variant class', () => {
    const { container } = render(
      <FieldGroup number={1} title="Test">content</FieldGroup>
    )
    expect(container.querySelector('.field-group')).toBeTruthy()
    expect(container.querySelector('.field-group.footnote')).toBeNull()
  })
})
