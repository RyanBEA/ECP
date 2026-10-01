import React from 'react'

const DETAILS_SUFFIX = ' . details ->'

export default function HeaderCostChip({ text, secondLine = '', onOpen, onHide }) {
  // Accessible name: the figure and the comparison only, without the visual " . details ->" cue (R35).
  const comparison = secondLine.endsWith(DETAILS_SUFFIX) ? secondLine.slice(0, -DETAILS_SUFFIX.length) : secondLine
  const label = `Cost details: ${text}${comparison ? ` ${comparison}` : ''}`
  return (
    <span className="cost-chip-wrap">
      <button type="button" className="cost-chip" aria-label={label} onClick={onOpen}>
        <span className="cost-chip-value">{text}</span>
        <span className="cost-chip-sub">{secondLine}</span>
      </button>
      <button type="button" className="cost-chip-hide" aria-label="Hide cost from the Points tab" onClick={onHide}>hide</button>
    </span>
  )
}
