// src/components/ConsiderScreen.jsx
import React, { useState } from 'react'
import Disclosure from './Disclosure'
import { LEVER_CARDS, CARD_NAMES, cardOptions } from '../optimize/candidates'
import { ownWallCandidate } from '../optimize/wallTypes'

// Screen 1 of the Optimize tab (Capability 2 spec 5.1): what the tool may pick. Ticked = allowed; all ticked by default.
export default function ConsiderScreen({ consider, onToggle, tierLabel, wallSelection, blocked, onRun }) {
  const [open, setOpen] = useState({ aboveGroundWalls: true, airTightness: true })
  const own = ownWallCandidate(wallSelection)
  const summary = cardId => {
    const all = cardOptions(cardId)
    const on = all.filter(o => consider[cardId].has(o.value)).length
    const noun = cardId === 'aboveGroundWalls' ? 'wall types' : 'options'
    return on === all.length ? `all ${all.length} ${noun}` : on === 0 ? 'left out' : `${on} of ${all.length} ${noun}`
  }
  return (
    <section className="cost-statement optimize-consider">
      <div className="cost-card headline-card">
        <h2 className="headline small">What would you build?</h2>
        <p>Everything starts ticked. Untick any option you would not build, then find the cheapest way to {tierLabel} for this house among what is left.</p>
      </div>
      <div className="cost-card">
        <p className="card-title">Options to consider</p>
        <p className="card-sub">A tick means the tool may pick it. Walls are listed by construction type.</p>
        {LEVER_CARDS.map(cardId => (
          <Disclosure key={cardId} label={CARD_NAMES[cardId]} summary={summary(cardId)} open={!!open[cardId]} onToggle={() => setOpen(o => ({ ...o, [cardId]: !o[cardId] }))}>
            <div className={`consider-options ${cardId === 'aboveGroundWalls' ? 'stack' : ''}`}>
              {cardOptions(cardId).map(o => {
                const id = `consider-${cardId}-${String(o.value).replace(/\W/g, '_')}`
                return (
                  <label key={id} htmlFor={id} className="consider-option">
                    <input id={id} type="checkbox" checked={consider[cardId].has(o.value)} disabled={o.locked} onChange={() => onToggle(cardId, o.value)} />
                    <span>{o.label}{o.locked && <span className="muted"> always considered</span>}</span>
                  </label>
                )
              })}
              {cardId === 'aboveGroundWalls' && own && <p className="costing-note">Your current wall ({own.label}) is always included.</p>}
            </div>
          </Disclosure>
        ))}
        <p className="costing-note">Heated volume is taken from your project and is not changed.</p>
      </div>
      <div className="optimize-actions">
        <button type="button" className="btn primary" disabled={!!blocked} onClick={onRun}>Find the cheapest way to {tierLabel}</button>
        {blocked && <p className="costing-note blocked">{blocked}</p>}
      </div>
    </section>
  )
}
