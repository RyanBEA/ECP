import React, { useState } from 'react'

export const formatMoney = (n, decimals = 0) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: decimals, maximumFractionDigits: decimals })

// Lifted from cost-layer CostLines.jsx (PriceCell), with a decimals prop. Enter commits, Esc cancels, blur commits.
// dormant: the value does not reach the cost (a line override covers it), so an override on it is not styled
// as active; its reset stays available because the override is kept (spec 7.2).
export default function PriceCell({ name, value, overridden, onSet, decimals = 2, dormant = false }) {
  const [draft, setDraft] = useState(null)
  const commit = () => {
    if (draft !== null && draft !== '' && Number(draft) >= 0) onSet(Number(draft))
    setDraft(null)
  }
  if (draft !== null) {
    return (
      <input type="number" min="0" step="any" autoFocus aria-label={name} className="price-input" value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(null) }} />
    )
  }
  const cls = ['price-cell', overridden && !dormant ? 'overridden' : '', dormant ? 'dormant' : ''].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      {value === null || value === undefined ? '-' : formatMoney(value, decimals)}
      <button type="button" className="pencil-button" aria-label={`Override ${name}`} onClick={() => setDraft(value === null || value === undefined ? '' : String(value))}>&#9998;</button>
      {overridden && <button type="button" className="link-button" aria-label={`Reset ${name}`} onClick={() => onSet(undefined)}>reset</button>}
    </span>
  )
}
