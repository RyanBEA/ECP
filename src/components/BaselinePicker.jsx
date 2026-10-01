import React from 'react'
import { BASELINE_PRESETS, BASELINE_NAMES } from '../costing/baselines'
import { wallText } from '../costing/assumedAssemblies'

// "Compared with" (spec 3.1): three choices, each with its one-line description (all three shown, ruling R4).
// "My usual house..." (none saved for this type) opens the editor; an existing usual house is chosen like the others (R40).
const CHOICES = ['codeMinimum', 'typicalTier2', 'usualHouse']
const DESCRIBE = { codeMinimum: BASELINE_PRESETS.codeMinimum.describe, typicalTier2: BASELINE_PRESETS.typicalTier2.describe, usualHouse: 'Start from Typical Tier 2 and change what you do differently.' }

// belowGradeApplicable: false when the house has no foundation wall (foundation height 0), so the below-grade
// part is left out (ruling R45).
export function picksSmallPrint(picks, { belowGradeApplicable = true } = {}) {
  if (!picks) return ''
  const c = picks.cards || {}
  const wall = picks.wall?.kind === 'assembly' ? wallText(picks.wall.selection) : picks.wall?.kind === 'level' ? `RSI ${picks.wall.rsi}` : 'no wall'
  const parts = [`walls ${wall}`]
  if (belowGradeApplicable && c.belowGradeWalls !== undefined) parts.push(`below grade RSI ${c.belowGradeWalls}`)
  if (c.windowsDoors !== undefined) parts.push(`windows U ${c.windowsDoors}`)
  if (c.airTightness !== undefined) parts.push(c.airTightness === 'untested' ? 'untested airtightness' : `${c.airTightness} ACH50`)
  if (c.hrv !== undefined) parts.push(`HRV ${c.hrv}%`)
  if (c.dhwElectric !== undefined || c.dhwGas !== undefined) parts.push(c.dhwElectric === 'electricStorage' ? 'electric tank' : `water heater ${c.dhwElectric ?? c.dhwGas}`)
  return parts.join(' . ')
}

export default function BaselinePicker({ choice, onChoice, onEdit, onResetUsual, hasUsual, baselinePicks, belowGradeApplicable = true }) {
  const effective = choice === 'usualHouse' && !hasUsual ? 'typicalTier2' : choice
  const label = id => (id === 'usualHouse' ? (hasUsual ? 'My usual house' : 'My usual house...') : BASELINE_NAMES[id])
  return (
    <div className="baseline-picker">
      <h3>Compared with</h3>
      <select id="baseline-choice" aria-label="Compared with" value={effective} onChange={e => { const v = e.target.value; if (v === 'usualHouse' && !hasUsual) onEdit(); else onChoice(v) }}>
        {CHOICES.map(id => <option key={id} value={id}>{label(id)}</option>)}
      </select>
      <ul className="baseline-choices">
        {CHOICES.map(id => (
          <li key={id} className={`costing-note baseline-choice ${id === effective ? 'current' : ''}`}>
            <strong>{label(id)}</strong> - <span className={`baseline-describe ${id === effective ? 'current' : ''}`}>{DESCRIBE[id]}</span>
            {id === 'usualHouse' && hasUsual && <> <button type="button" className="link-button" onClick={onEdit}>edit</button> . <button type="button" className="link-button" onClick={onResetUsual}>reset to {BASELINE_NAMES.typicalTier2}</button></>}
          </li>
        ))}
      </ul>
      <p className="costing-note small-print">{picksSmallPrint(baselinePicks, { belowGradeApplicable })}</p>
    </div>
  )
}
