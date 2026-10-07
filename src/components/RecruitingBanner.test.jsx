import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecruitingBanner, { RECRUITING_END_DATE } from './RecruitingBanner'

const STORAGE_KEY = 'ecp-recruiting-banner-dismissed'
const BEFORE = new Date(2026, 9, 7, 12, 0, 0)

describe('RecruitingBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the heading text and both controls before the end date', () => {
    render(<RecruitingBanner now={BEFORE} />)
    expect(screen.getByRole('region', { name: 'Usability testing invitation' })).toBeTruthy()
    expect(screen.getByText('Help us build the cost feature.')).toBeTruthy()
    expect(screen.getByRole('link', { name: "I'm interested" })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No thanks' })).toBeTruthy()
  })

  it('dismisses on "No thanks" and records the dismissal', () => {
    render(<RecruitingBanner now={BEFORE} />)
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }))
    expect(screen.queryByRole('region', { name: 'Usability testing invitation' })).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('2026-10')
  })

  it('does not render when the dismissal key is already stored', () => {
    localStorage.setItem(STORAGE_KEY, '2026-10')
    render(<RecruitingBanner now={BEFORE} />)
    expect(screen.queryByRole('region', { name: 'Usability testing invitation' })).toBeNull()
  })

  it('exports the end date constant', () => {
    expect(RECRUITING_END_DATE).toBe('2026-10-24')
  })

  it('renders the day before the end date', () => {
    render(<RecruitingBanner now={new Date(2026, 9, 23, 23, 59, 0)} />)
    expect(screen.getByText('Help us build the cost feature.')).toBeTruthy()
  })

  it('does not render on the end date', () => {
    render(<RecruitingBanner now={new Date(2026, 9, 24, 0, 0, 0)} />)
    expect(screen.queryByText('Help us build the cost feature.')).toBeNull()
  })

  it('does not render after the end date', () => {
    render(<RecruitingBanner now={new Date(2026, 10, 2, 9, 0, 0)} />)
    expect(screen.queryByText('Help us build the cost feature.')).toBeNull()
  })

  it('links "I\'m interested" to a mailto address', () => {
    render(<RecruitingBanner now={BEFORE} />)
    const link = screen.getByRole('link', { name: "I'm interested" })
    expect(link.getAttribute('href').startsWith('mailto:ryan@baselineenergy.ca')).toBe(true)
    expect(link.getAttribute('target')).toBeNull()
  })

  it('still dismisses for the session when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    render(<RecruitingBanner now={BEFORE} />)
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }))
    expect(screen.queryByRole('region', { name: 'Usability testing invitation' })).toBeNull()
  })
})
