import React from 'react'

const TABS = [['points', 'Points'], ['cost', 'Cost']]

export default function TabBar({ active, onChange, disabled = false }) {
  return (
    <div className="tab-bar" role="tablist" aria-label="Points and Cost">
      {TABS.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={active === id} className={`tab ${active === id ? 'active' : ''}`}
          onClick={() => !disabled && onChange(id)} aria-disabled={disabled}>{label}</button>
      ))}
    </div>
  )
}
