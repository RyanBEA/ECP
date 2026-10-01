import React, { useRef, useState } from 'react'

export const formatMoney = (n, decimals = 0) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: decimals, maximumFractionDigits: decimals })

// A value as the edit field starts with it: rounded to `decimals`, no trailing zeros; '' when there is none.
export const draftOf = (value, decimals = 2) => (value === null || value === undefined ? '' : String(Number(Number(value).toFixed(decimals))))

// Lifted from cost-layer CostLines.jsx (PriceCell), with a decimals prop. Enter commits, Esc cancels, blur commits.
// A commit only fires when the typed string differs from the one the field opened with, so opening the pencil and
// leaving does not create an override. Negative, empty and non-numeric input is rejected.
// dormant: the value does not reach the cost (a line override covers it), so an override on it is not styled
// as active; its reset stays available because the override is kept (spec 7.2).
export default function PriceCell({ name, value, overridden, onSet, decimals = 2, dormant = false }) {
  const [draft, setDraft] = useState(null)
  const start = useRef('')
  const done = useRef(false)   // set once Enter, Esc or blur has closed this edit, so a later blur does nothing
  const open = () => {
    start.current = draftOf(value, decimals)
    done.current = false
    setDraft(start.current)
  }
  const commit = () => {
    if (done.current) return
    done.current = true
    const n = Number(draft)
    if (draft !== null && draft !== '' && draft !== start.current && Number.isFinite(n) && n >= 0) onSet(n)
    setDraft(null)
  }
  const cancel = () => {
    done.current = true
    setDraft(null)
  }
  if (draft !== null) {
    return (
      <input type="number" min="0" step="any" autoFocus aria-label={name} className="price-input" value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }} />
    )
  }
  const cls = ['price-cell', overridden && !dormant ? 'overridden' : '', dormant ? 'dormant' : ''].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      {value === null || value === undefined ? '-' : formatMoney(value, decimals)}
      <button type="button" className="pencil-button" aria-label={`Override ${name}`} onClick={open}>&#9998;</button>
      {overridden && <button type="button" className="link-button" aria-label={`Reset ${name}`} onClick={() => onSet(undefined)}>reset</button>}
    </span>
  )
}
