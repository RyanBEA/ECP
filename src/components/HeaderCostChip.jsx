import React from 'react'

export default function HeaderCostChip({ text, secondLine, onOpen, onHide }) {
  return (
    <span className="cost-chip-wrap">
      <button type="button" className="cost-chip" aria-label={`Cost details: ${text} ${secondLine}`} onClick={onOpen}>
        <span className="cost-chip-value">{text}</span>
        <span className="cost-chip-sub">{secondLine}</span>
      </button>
      <button type="button" className="cost-chip-hide" aria-label="Hide cost from the Points tab" onClick={onHide}>hide</button>
    </span>
  )
}
