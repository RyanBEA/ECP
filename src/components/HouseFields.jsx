import React from 'react'
import { ARCHETYPES, VISIBLE_FIELD_KEYS, HOUSE_FIELD_KEYS } from '../costing/archetypes'
import { MORE_THAN_5 } from '../costing/quantities'
import { ftToM } from '../costing/units'

// The Cost tab sidebar's house inputs (spec 3.1). Values describe both the design and the baseline.
const LABELS = { storeys: 'Storeys', lengthFt: 'Length (ft)', widthFt: 'Width (ft)', glazingRatio: 'Glazing ratio (%)', bedrooms: 'Bedrooms',
  storeyHeightFt: 'Storey height (ft)', foundationHeightFt: 'Foundation wall height (ft, 0 = none)', doors: 'Exterior doors', partyWalls: 'Party walls (long sides)', waterHeaterGal: 'Water heater (gal)' }
const HIDDEN_KEYS = HOUSE_FIELD_KEYS.slice(5)
const metres = ft => ftToM(Number(ft) || 0).toFixed(1)

function Field({ k, value, changed, onChange }) {
  const id = `hf-${k}`
  let input
  if (k === 'storeys') input = <select id={id} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[1, 1.5, 2, 2.5, 3].map(v => <option key={v} value={v}>{v}</option>)}</select>
  else if (k === 'bedrooms') input = <select id={id} value={value} onChange={e => onChange(k, e.target.value === MORE_THAN_5 ? MORE_THAN_5 : Number(e.target.value))}>{[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}<option value={MORE_THAN_5}>more than 5</option></select>
  else if (k === 'partyWalls') input = <select id={id} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[0, 1, 2].map(v => <option key={v} value={v}>{v}</option>)}</select>
  else if (k === 'waterHeaterGal') input = <select id={id} value={value} onChange={e => onChange(k, Number(e.target.value))}>{[40, 50, 60, 80].map(v => <option key={v} value={v}>{v}</option>)}</select>
  else if (k === 'glazingRatio') input = <input id={id} type="number" min="0" max="60" step="1" value={Math.round(value * 100)} onChange={e => onChange(k, Number(e.target.value) / 100)} />
  else input = <input id={id} type="number" min="0" step="any" value={value} onChange={e => onChange(k, Number(e.target.value))} />
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
          <input id="hf-airflow" type="number" min="1" value={fields.designedAirflowLs ?? ''} onChange={e => onFieldChange('designedAirflowLs', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
      )}
      <details className="more-house"><summary>More about this house</summary>
        {HIDDEN_KEYS.map(k => <Field key={k} k={k} value={fields[k]} changed={changed(k)} onChange={onFieldChange} />)}
      </details>
    </div>
  )
}
