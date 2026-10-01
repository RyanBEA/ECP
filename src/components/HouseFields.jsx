import React, { useState } from 'react'
import { ARCHETYPES, VISIBLE_FIELD_KEYS, HOUSE_FIELD_KEYS } from '../costing/archetypes'
import { MORE_THAN_5 } from '../costing/quantities'
import { ftToM } from '../costing/units'

// The Cost tab sidebar's house inputs (spec 3.1). Values describe both the design and the baseline.
const LABELS = { storeys: 'Storeys', lengthFt: 'Length (ft)', widthFt: 'Width (ft)', glazingRatio: 'Glazing ratio (%)', bedrooms: 'Bedrooms',
  storeyHeightFt: 'Storey height (ft)', foundationHeightFt: 'Foundation wall height (ft, 0 = none)', doors: 'Exterior doors', partyWalls: 'Party walls (long sides)', waterHeaterGal: 'Water heater (gal)' }
const HIDDEN_KEYS = HOUSE_FIELD_KEYS.slice(5)
const metres = ft => ftToM(Number(ft) || 0).toFixed(1)

// Accepted ranges for the typed fields (ruling R40). A value outside them is never stored.
const VALID = {
  lengthFt: n => n > 0, widthFt: n => n > 0, storeyHeightFt: n => n > 0,
  doors: n => n >= 0, foundationHeightFt: n => n >= 0, partyWalls: n => n >= 0,
  glazingRatio: n => n >= 0 && n <= 60,   // typed as a percentage
  designedAirflowLs: n => n > 0,
}

// A number input with a local draft (R40): an empty or invalid draft calls nothing and is shown as typed; the
// stored value stays as it was. On blur the field shows the stored value again.
function NumberInput({ id, k, stored, toStored = n => n, onCommit, ...attrs }) {
  const [draft, setDraft] = useState(null)   // null = show the stored value
  const onChange = e => {
    const s = e.target.value
    setDraft(s)
    const n = Number(s)
    if (s.trim() !== '' && Number.isFinite(n) && VALID[k](n)) onCommit(k, toStored(n))
  }
  return <input id={id} type="number" {...attrs} value={draft ?? stored ?? ''} onChange={onChange} onBlur={() => setDraft(null)} />
}

function Field({ k, value, changed, onChange }) {
  const id = `hf-${k}`
  let input
  if (k === 'storeys') input = <select id={id} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[1, 1.5, 2, 2.5, 3].map(v => <option key={v} value={v}>{v}</option>)}</select>
  else if (k === 'bedrooms') input = <select id={id} value={value} onChange={e => onChange(k, e.target.value === MORE_THAN_5 ? MORE_THAN_5 : Number(e.target.value))}>{[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}<option value={MORE_THAN_5}>more than 5</option></select>
  else if (k === 'partyWalls') input = <select id={id} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[0, 1, 2].map(v => <option key={v} value={v}>{v}</option>)}</select>
  else if (k === 'waterHeaterGal') input = <select id={id} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[40, 50, 60, 80].map(v => <option key={v} value={v}>{v}</option>)}</select>
  else if (k === 'glazingRatio') input = <NumberInput id={id} k={k} min="0" max="60" step="1" stored={Math.round(value * 100)} toStored={n => n / 100} onCommit={onChange} />
  else input = <NumberInput id={id} k={k} min="0" step="any" stored={value} onCommit={onChange} />
  return (
    <div className={`house-field ${changed ? 'changed' : ''}`}>
      <label htmlFor={id}>{LABELS[k]}</label>
      {input}
      <span className="field-state">{changed ? <>changed <button type="button" className="link-button" onClick={() => onChange(k, undefined)}>reset</button></> : 'assumed'}</span>
    </div>
  )
}

export default function HouseFields({ houseType, fields, overriddenKeys, onTypeChange, onFieldChange, notice }) {
  const changed = k => overriddenKeys.includes(k)
  return (
    <div className="house-fields">
      <h3>House</h3>
      <div className="house-field"><label htmlFor="hf-type">Type</label>
        <select id="hf-type" value={houseType} onChange={e => onTypeChange(e.target.value)}>{ARCHETYPES.map(a => <option key={a.type} value={a.type}>{a.name}</option>)}</select></div>
      {notice && <p className="costing-notice">{notice}</p>}
      {VISIBLE_FIELD_KEYS.map(k => (
        <React.Fragment key={k}>
          <Field k={k} value={fields[k]} changed={changed(k)} onChange={onFieldChange} />
          {/* Spec 3.1: footprint in ft, metres in brackets */}
          {k === 'widthFt' && <p className="costing-note footprint-metric">({metres(fields.lengthFt)} x {metres(fields.widthFt)} m)</p>}
        </React.Fragment>
      ))}
      {fields.bedrooms === MORE_THAN_5 && (
        <div className="house-field"><label htmlFor="hf-airflow">Designed airflow (L/s)</label>
          <NumberInput id="hf-airflow" k="designedAirflowLs" min="1" stored={fields.designedAirflowLs} onCommit={onFieldChange} /></div>
      )}
      <details className="more-house"><summary>More about this house</summary>
        {HIDDEN_KEYS.map(k => <Field key={k} k={k} value={fields[k]} changed={changed(k)} onChange={onFieldChange} />)}
      </details>
    </div>
  )
}
