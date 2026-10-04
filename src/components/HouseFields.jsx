import React, { useState } from 'react'
import Disclosure from './Disclosure'
import { ARCHETYPES, VISIBLE_FIELD_KEYS, HOUSE_FIELD_KEYS } from '../costing/archetypes'
import { MORE_THAN_5 } from '../costing/quantities'
import { ftToM } from '../costing/units'
import { houseNoun, plural } from '../costing/houseText'

// The House card (spec rev 3 3.1). Values describe both the design and the baseline. Inputs keep their full
// names as aria-label (the names tests and screen readers use); the grid shows short labels.
export const HIDDEN_FIELD_KEYS = HOUSE_FIELD_KEYS.slice(5)
const FULL = { storeys: 'Storeys', lengthFt: 'Length (ft)', widthFt: 'Width (ft)', glazingRatio: 'Glazing ratio (%)', bedrooms: 'Bedrooms',
  storeyHeightFt: 'Storey height (ft)', foundationHeightFt: 'Foundation wall height (ft, 0 = none)', doors: 'Exterior doors', partyWalls: 'Party walls (long sides)', waterHeaterGal: 'Water heater (gal)' }
const SHORT = { storeys: 'Storeys', glazingRatio: 'Glazing', bedrooms: 'Bedrooms', storeyHeightFt: 'Storey height', foundationHeightFt: 'Foundation wall', doors: 'Exterior doors', partyWalls: 'Party walls', waterHeaterGal: 'Water heater' }
const UNIT = { glazingRatio: '% of wall', storeyHeightFt: 'ft', foundationHeightFt: 'ft, 0 = none', partyWalls: 'long sides', waterHeaterGal: 'gal' }
const metres = ft => ftToM(Number(ft) || 0).toFixed(1)

// Accepted ranges for the typed fields (ruling R40). A value outside them is never stored.
const VALID = {
  lengthFt: n => n > 0, widthFt: n => n > 0, storeyHeightFt: n => n > 0,
  doors: n => n >= 0, foundationHeightFt: n => n >= 0, partyWalls: n => n >= 0,
  glazingRatio: n => n >= 0 && n <= 60,   // typed as a percentage
  designedAirflowLs: n => n > 0,
}

// A number input with a local draft (R40): an empty or invalid draft calls nothing; on blur the stored value shows.
function NumberInput({ id, k, stored, toStored = n => n, onCommit, label, ...attrs }) {
  const [draft, setDraft] = useState(null)
  const onChange = e => {
    const s = e.target.value
    setDraft(s)
    const n = Number(s)
    if (s.trim() !== '' && Number.isFinite(n) && VALID[k](n)) onCommit(k, toStored(n))
  }
  return <input id={id} type="number" aria-label={label} {...attrs} value={draft ?? stored ?? ''} onChange={onChange} onBlur={() => setDraft(null)} />
}

function inputFor(k, value, onChange) {
  const id = `hf-${k}`
  const label = FULL[k]
  if (k === 'storeys') return <select id={id} aria-label={label} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[1, 1.5, 2, 2.5, 3].map(v => <option key={v} value={v}>{v}</option>)}</select>
  if (k === 'bedrooms') return <select id={id} aria-label={label} value={value} onChange={e => onChange(k, e.target.value === MORE_THAN_5 ? MORE_THAN_5 : Number(e.target.value))}>{[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}<option value={MORE_THAN_5}>more than 5</option></select>
  if (k === 'partyWalls') return <select id={id} aria-label={label} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[0, 1, 2].map(v => <option key={v} value={v}>{v}</option>)}</select>
  if (k === 'waterHeaterGal') return <select id={id} aria-label={label} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[40, 50, 60, 80].map(v => <option key={v} value={v}>{v}</option>)}</select>
  if (k === 'glazingRatio') return <NumberInput id={id} k={k} label={label} min="0" max="60" step="1" stored={Math.round(value * 100)} toStored={n => n / 100} onCommit={onChange} />
  return <NumberInput id={id} k={k} label={label} min="0" step="any" stored={value} onCommit={onChange} />
}

function ChangedMark({ k, changed, onChange }) {
  return changed ? <span className="field-state">changed <button type="button" className="link-button" onClick={() => onChange(k, undefined)}>reset</button></span> : null
}

function Field({ k, value, changed, onChange }) {
  return (
    <div className={`house-field ${changed ? 'changed' : ''}`}>
      <span className="fl" aria-hidden="true">{SHORT[k]}</span>
      <span className="fv">{inputFor(k, value, onChange)}{UNIT[k] && <span className="unit">{UNIT[k]}</span>}<ChangedMark k={k} changed={changed} onChange={onChange} /></span>
    </div>
  )
}

export const moreSummary = f => [
  `${f.storeyHeightFt} ft storeys`,
  f.foundationHeightFt ? `${f.foundationHeightFt} ft foundation wall` : 'no foundation wall',
  plural(f.doors, 'door'),
  f.partyWalls ? plural(f.partyWalls, 'party wall') : 'no party walls',
  `${f.waterHeaterGal} gal water heater`,
].join(', ')

export const houseSummary = (typeName, f) =>
  `${typeName}, ${plural(f.storeys, 'storey')}, ${f.lengthFt} x ${f.widthFt} ft, ${Math.round(f.glazingRatio * 100)}% glazing, ${f.bedrooms === MORE_THAN_5 ? 'more than 5 bedrooms' : plural(f.bedrooms, 'bedroom')}`

export default function HouseFields({ houseType, typeName, fields, overriddenKeys, onTypeChange, onFieldChange, notice, moreOpen, onToggleMore, showTitle = true }) {
  const changed = k => overriddenKeys.includes(k)
  const name = typeName ?? ARCHETYPES.find(a => a.type === houseType)?.name
  const footprintChanged = changed('lengthFt') || changed('widthFt')
  return (
    <div className="house-fields">
      {showTitle && <h3 className="card-title">House</h3>}
      <p className="card-sub">Filled in for a {houseNoun(name)}. Change anything that differs.</p>
      <div className="house-field">
        <span className="fl" aria-hidden="true">Type</span>
        <span className="fv"><select id="hf-type" aria-label="Type" value={houseType} onChange={e => onTypeChange(e.target.value)}>{ARCHETYPES.map(a => <option key={a.type} value={a.type}>{a.name}</option>)}</select></span>
      </div>
      {notice && <p className="costing-notice">{notice}</p>}
      <Field k="storeys" value={fields.storeys} changed={changed('storeys')} onChange={onFieldChange} />
      <div className={`house-field ${footprintChanged ? 'changed' : ''}`}>
        <span className="fl" aria-hidden="true">Footprint</span>
        <span className="fv">
          {inputFor('lengthFt', fields.lengthFt, onFieldChange)}<span className="unit">x</span>{inputFor('widthFt', fields.widthFt, onFieldChange)}<span className="unit">ft</span>
          <ChangedMark k="lengthFt" changed={changed('lengthFt')} onChange={onFieldChange} />
          <ChangedMark k="widthFt" changed={changed('widthFt')} onChange={onFieldChange} />
        </span>
      </div>
      <p className="costing-note footprint-metric">({metres(fields.lengthFt)} x {metres(fields.widthFt)} m)</p>
      {VISIBLE_FIELD_KEYS.filter(k => !['storeys', 'lengthFt', 'widthFt'].includes(k)).map(k => <Field key={k} k={k} value={fields[k]} changed={changed(k)} onChange={onFieldChange} />)}
      {fields.bedrooms === MORE_THAN_5 && (
        <div className="house-field">
          <span className="fl" aria-hidden="true">Designed airflow</span>
          <span className="fv"><NumberInput id="hf-airflow" k="designedAirflowLs" label="Designed airflow (L/s)" min="1" stored={fields.designedAirflowLs} onCommit={onFieldChange} /><span className="unit">L/s</span></span>
        </div>
      )}
      <Disclosure className="more-house" label="More about this house" summary={moreSummary(fields)} open={Boolean(moreOpen)} onToggle={onToggleMore}>
        {HIDDEN_FIELD_KEYS.map(k => <Field key={k} k={k} value={fields[k]} changed={changed(k)} onChange={onFieldChange} />)}
      </Disclosure>
    </div>
  )
}
