import React, { useEffect, useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Dialog from './Dialog'

describe('Dialog', () => {
  it('renders an open dialog named by its title, with the live line and the content', () => {
    render(<Dialog title="Your usual house" sub="+$9,200 more than Your usual house, before HST." onClose={() => {}}><p>inside</p></Dialog>)
    const d = screen.getByRole('dialog', { name: 'Your usual house' })
    expect(d).toHaveAttribute('open')
    expect(d.querySelector('.dialog-sub')).toHaveTextContent('+$9,200 more than Your usual house, before HST.')
    expect(screen.getByText('inside')).toBeInTheDocument()
  })
  it('Esc, the Close button and a click outside the content each call onClose', () => {
    const onClose = vi.fn()
    render(<Dialog title="T" onClose={onClose}><p>inside</p></Dialog>)
    const d = screen.getByRole('dialog', { name: 'T' })
    fireEvent.keyDown(d, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(d)
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(d.querySelector('.dialog-sub')).toBeNull()
  })
  it('a click inside the content does not close it', () => {
    const onClose = vi.fn()
    render(<Dialog title="T" onClose={onClose}><p>inside</p></Dialog>)
    fireEvent.click(screen.getByText('inside'))
    fireEvent.keyDown(screen.getByText('inside'), { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
  })
  it('is open before its children\'s effects run, so a child can scroll inside it', () => {
    let openAtEffect = null
    function Probe() {
      const ref = useRef(null)
      useEffect(() => { openAtEffect = ref.current.closest('dialog').hasAttribute('open') }, [])
      return <p ref={ref}>probe</p>
    }
    render(<Dialog title="T" onClose={() => {}}><Probe /></Dialog>)
    expect(openAtEffect).toBe(true)
  })
  it('announces the live cost line politely (final review M1)', () => {
    render(<Dialog title="T" sub="+$1 more" onClose={() => {}}><p>inside</p></Dialog>)
    expect(document.querySelector('.dialog-sub')).toHaveAttribute('aria-live', 'polite')
  })
  it('puts focus on the Close button when it opens (final review M2)', () => {
    render(<Dialog title="T" onClose={() => {}}><p>inside</p></Dialog>)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
  })
})
