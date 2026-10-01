import React, { useRef } from 'react'

const TABS = [['points', 'Points'], ['cost', 'Cost']]

export default function TabBar({ active, onChange, disabled = false }) {
  const refs = useRef({})
  // Left / Right arrows move to the neighbouring tab (wrapping) and focus it; inert while disabled (R35).
  const handleKeyDown = (e, index) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    if (disabled) return
    const step = e.key === 'ArrowRight' ? 1 : -1
    const [nextId] = TABS[(index + step + TABS.length) % TABS.length]
    onChange(nextId)
    refs.current[nextId]?.focus()
  }
  return (
    <div className="tab-bar" role="tablist" aria-label="Points and Cost">
      {TABS.map(([id, label], index) => (
        <button key={id} id={`tab-${id}`} ref={el => { refs.current[id] = el }} type="button" role="tab"
          aria-selected={active === id} aria-controls={`panel-${id}`} tabIndex={active === id ? 0 : -1} className={`tab ${active === id ? 'active' : ''}`}
          onClick={() => !disabled && onChange(id)} onKeyDown={e => handleKeyDown(e, index)} aria-disabled={disabled}>{label}</button>
      ))}
    </div>
  )
}
