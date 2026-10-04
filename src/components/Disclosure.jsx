import React from 'react'
import { ChevronIcon } from './icons'

// The one "more detail here" control (spec rev 3 section 2): the whole row is the button, the same row
// closes it, and its summary says what is inside.
export default function Disclosure({ label, summary, open, onToggle, className = '', children }) {
  return (
    <div className={`disclosure ${open ? 'open' : ''} ${className}`.trim()}>
      <button type="button" className="disclosure-row" aria-expanded={open} onClick={onToggle}>
        <ChevronIcon />
        <span className="disclosure-text">
          <span className="disclosure-label">{label}</span>
          {summary ? <span className="disclosure-summary">{summary}</span> : null}
        </span>
      </button>
      {open && <div className="disclosure-body">{children}</div>}
    </div>
  )
}
