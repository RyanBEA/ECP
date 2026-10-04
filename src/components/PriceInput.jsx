import React, { useState } from 'react'
import { draftOf } from './PriceCell'

// Edit mode's price field (spec rev 3 5.2). The field is always shown. Enter commits, Esc cancels, and blur
// commits only a changed value (R37). Empty, negative and non-numeric input is rejected.
export default function PriceInput({ name, value, decimals = 2, overridden = false, dormant = false, onSet }) {
  const shown = draftOf(value, decimals)
  const [draft, setDraft] = useState(null)   // null = show the stored value
  const commit = () => {
    if (draft === null) return
    const s = draft
    setDraft(null)
    if (s === '' || s === shown) return
    const n = Number(s)
    if (Number.isFinite(n) && n >= 0) onSet(n)
  }
  const cls = ['price-field', overridden && !dormant ? 'overridden' : '', dormant ? 'dormant' : ''].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      <input type="number" min="0" step="any" aria-label={name} className="price-input" value={draft ?? shown}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(null) }} />
      {overridden && <button type="button" className="link-button" aria-label={`Reset ${name}`} onClick={() => onSet(undefined)}>reset</button>}
    </span>
  )
}
