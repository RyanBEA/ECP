import React from 'react'
import Disclosure from './Disclosure'
import { ArrowIcon } from './icons'
import { BASELINE_PRESETS, presetPoints } from '../costing/baselines'
import { wallText, describeWall, assumedWallSelection } from '../costing/assumedAssemblies'
import { plural } from '../costing/houseText'

// The Compared with card (spec rev 3 3.1): three radios with their descriptions, and what the current
// baseline includes, one pick per row with "view" (3.2).
const CHOICES = ['codeMinimum', 'typicalTier2', 'usualHouse']
const LABEL = { codeMinimum: 'Code minimum', typicalTier2: 'Typical Tier 2', usualHouse: 'My usual house' }
const DESCRIBE = { codeMinimum: BASELINE_PRESETS.codeMinimum.describe, typicalTier2: BASELINE_PRESETS.typicalTier2.describe, usualHouse: 'Start from Typical Tier 2 and change what you do differently.' }

// belowGradeApplicable: false when the house has no foundation wall, so the below-grade part is left out (R45).
export function picksSmallPrint(picks, { belowGradeApplicable = true } = {}) {
  return baselinePickRows(picks, { belowGradeApplicable }).map(r => `${r.name.toLowerCase()} ${r.value}`).join(' . ')
}

export function baselinePickRows(picks, { belowGradeApplicable = true } = {}) {
  if (!picks) return []
  const c = picks.cards || {}
  const wall = picks.wall?.kind === 'assembly' ? wallText(picks.wall.selection)
    : picks.wall?.kind === 'level' ? `RSI ${picks.wall.rsi} (priced as ${describeWall(assumedWallSelection(picks.wall.rsi))})` : 'no wall'
  const rows = [{ cardId: 'aboveGroundWalls', name: 'Above-ground walls', value: wall }]
  if (belowGradeApplicable && c.belowGradeWalls !== undefined) rows.push({ cardId: 'belowGradeWalls', name: 'Below-grade walls', value: `RSI ${c.belowGradeWalls}` })
  if (c.windowsDoors !== undefined) rows.push({ cardId: 'windowsDoors', name: 'Windows and doors', value: `U ${c.windowsDoors}` })
  if (c.airTightness !== undefined) rows.push({ cardId: 'airTightness', name: 'Airtightness', value: c.airTightness === 'untested' ? 'untested, prescriptive air-barrier detailing' : `${c.airTightness} ACH50, tested` })
  if (c.hrv !== undefined) rows.push({ cardId: 'hrv', name: 'Ventilation', value: `HRV ${c.hrv}% SRE` })
  if (c.dhwElectric !== undefined) rows.push({ cardId: 'dhwElectric', name: 'Water heating', value: c.dhwElectric === 'electricStorage' ? 'electric storage tank' : `heat pump, EF ${c.dhwElectric}` })
  else if (c.dhwGas !== undefined) rows.push({ cardId: 'dhwGas', name: 'Water heating', value: `gas, UEF ${c.dhwGas}` })
  return rows
}

export default function BaselinePicker({ choice, onChoice, onEdit, onResetUsual, hasUsual, baselineName, baselinePicks, belowGradeApplicable = true, includesOpen = false, onToggleIncludes = () => {}, onView = () => {}, showTitle = true }) {
  const effective = choice === 'usualHouse' && !hasUsual ? 'typicalTier2' : choice
  const pick = id => { if (id === 'usualHouse' && !hasUsual) onEdit(); else onChoice(id) }
  const rows = baselinePickRows(baselinePicks, { belowGradeApplicable })
  const includesLabel = baselineName === 'Your usual house' ? 'What your usual house includes' : `What ${baselineName} includes`
  return (
    <div className="baseline-picker">
      <fieldset className="baseline-radios">
        <legend className={showTitle ? 'card-title' : 'visually-hidden'}>Compared with</legend>
        {showTitle && <p className="card-sub">What the difference is measured against.</p>}
        {CHOICES.map(id => (
          <div key={id} className={`baseline-radio ${id === effective ? 'current' : ''}`}>
            <input type="radio" id={`bc-${id}`} name="baseline-choice" value={id} checked={id === effective} onChange={() => pick(id)} aria-describedby={`bc-${id}-d`} />
            <label htmlFor={`bc-${id}`}>{LABEL[id]}</label>
            <p id={`bc-${id}-d`} className="radio-desc">{DESCRIBE[id]}</p>
            {id === 'usualHouse' && (hasUsual
              ? <p className="radio-actions"><button type="button" className="go-link" onClick={onEdit}>edit <ArrowIcon /></button> <button type="button" className="link-button" onClick={onResetUsual}>reset to Typical Tier 2</button></p>
              : <p className="radio-actions"><button type="button" className="go-link" onClick={onEdit}>Describe it <ArrowIcon /></button></p>)}
          </div>
        ))}
      </fieldset>
      {baselinePicks && (
        <Disclosure className="baseline-includes" label={includesLabel} summary={`${plural(rows.length, 'pick')}, ${presetPoints({ ...baselinePicks, cards: Object.fromEntries(Object.entries(baselinePicks.cards || {}).filter(([id]) => belowGradeApplicable || id !== 'belowGradeWalls')) }).toFixed(1)} points`} open={includesOpen} onToggle={onToggleIncludes}>
          <ul className="includes-list">
            {rows.map(r => (
              <li key={r.cardId}>
                <span><span className="inc-card">{r.name}</span><span className="inc-value">{r.value}</span></span>
                <button type="button" className="go-link" aria-label={`view ${r.name}`} onClick={() => onView(r.cardId)}>view <ArrowIcon /></button>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  )
}
