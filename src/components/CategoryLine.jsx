import React from 'react'
import { formatMoney } from './PriceCell'
import { m2ToSqFt, perM2ToPerSqFt, ftToM } from '../costing/units'

// One category on the Cost tab: level 1 (the line), level 2 (This design vs the baseline, spec 4.1) and, when
// level3 is set, the children (the LayerTable, spec 4.2).
const unitLabelFor = r => (r.unit === 'm2' ? 'sq ft' : r.unit === 'house' ? 'house' : 'each')
const qtyText = r => (r.unit === 'm2' ? `${Math.round(m2ToSqFt(r.quantity)).toLocaleString('en-CA')} sq ft` : r.unit === 'house' ? 'per house' : `${r.quantity} each`)
const perUnitText = r => (r.unit === 'm2' ? `${formatMoney(perM2ToPerSqFt(r.perUnit), 2)} / sq ft` : formatMoney(r.perUnit, 0))

// Proof-of-concept price source (standing rule 3, spec 4.1).
export const SOURCE_SENTENCE = 'Prices: placeholder and LEEP 2013-2016 data, supplied and installed, before HST. Installed prices are assumed to include contractor overhead, profit and waste.'

// 'Single detached' -> 'single detached house'; names already ending in home stay as they are (R40).
export const houseNoun = typeName => {
  const n = String(typeName || 'house').toLowerCase()
  return /(home|house)$/.test(n) ? n : `${n} house`
}
const m1 = ft => ftToM(Number(ft) || 0).toFixed(1)
// The house field each sentence's "change house" link goes to (spec 3.1, R40).
const HOUSE_FIELD_FOR = { aboveGroundWalls: 'storeyHeightFt', belowGradeWalls: 'foundationHeightFt', windowsDoors: 'doors', hrv: 'bedrooms', dhw: 'waterHeaterGal' }

export default function CategoryLine({ line, baselineName, sentences, typeName, lengthFt, widthFt, open, onToggle, level3, onOpenLayers, onChangeHouse, children }) {
  const d = line.design, b = line.baseline
  const bothPriced = d.state === 'priced' && b.state === 'priced'
  const isWall = line.categoryId === 'aboveGroundWalls'
  const isBelow = line.categoryId === 'belowGradeWalls'
  const sentenceFor = {
    aboveGroundWalls: sentences.opaqueWall, belowGradeWalls: sentences.belowGrade, windowsDoors: sentences.windows, hrv: sentences.airflow,
    airTightness: 'Priced per house; the method for each airtightness level is still being settled with the cost system.',
    dhw: 'Priced per heater at the size from your house fields; fuel supply to the house is not priced.',
  }[line.categoryId]
  return (
    <div className={`category-line ${open ? 'open' : ''} state-${line.state}`}>
      <button type="button" className="line-row" aria-expanded={open} onClick={onToggle} disabled={line.state === 'notCosted' || line.state === 'notApplicable'}>
        <span className="line-name">{line.name}<small>{line.smallPrint}</small></span>
        <span className={`line-delta ${line.delta < 0 ? 'neg' : ''} ${line.delta === 0 ? 'z' : ''}`}>{line.deltaText || (line.state === 'notCosted' ? 'not costed' : line.state === 'notApplicable' ? 'n/a' : 'not priced')}</span>
      </button>
      {open && (
        <div className="line-detail">
          {bothPriced ? (
            <table className="comparison"><thead><tr><th></th><th>This design</th><th>{baselineName}</th></tr></thead><tbody>
              <tr><td>option</td><td>{d.description}</td><td>{b.description}</td></tr>
              <tr><td>installed</td><td>{perUnitText(d)}</td><td>{perUnitText(b)}</td></tr>
              <tr><td>quantity</td><td>{qtyText(d)}</td><td>{qtyText(b)}</td></tr>
              <tr><td>cost</td><td>{formatMoney(d.cost)}</td><td>{formatMoney(b.cost)}</td></tr>
            </tbody></table>
          ) : <p className="costing-note">{line.reason || line.smallPrint}</p>}
          <ul className="assumptions">
            {sentenceFor && <li>{sentenceFor} {onChangeHouse && line.categoryId !== 'airTightness' && <button type="button" className="link-button" onClick={() => onChangeHouse(HOUSE_FIELD_FOR[line.categoryId])}>change house</button>}</li>}
            {/* Spec 4.5: a Select RSI wall can be built on Points; a below-grade pick cannot (no builder on main). */}
            {d.assumed && isWall && <li>This design is priced as an assumed assembly. Build the assembly on Points to price your own.</li>}
            {b.assumed && isWall && <li>{baselineName} is priced as an assumed assembly for its level.</li>}
            {isBelow && d.assumed && <li>This design is priced as an assumed foundation assembly for its level.</li>}
            {isBelow && <li>Your own foundation assembly cannot be priced in this version.</li>}
            {bothPriced && <li>Both priced {isWall || isBelow ? 'layer by layer' : 'part by part'}; only what differs changes the total. <button type="button" className="link-button" onClick={onOpenLayers}>{isWall || isBelow ? 'see layers' : 'see parts'}</button></li>}
            {bothPriced && <li>Items identical on both sides are priced and cancel in the difference.</li>}
            <li>{SOURCE_SENTENCE}</li>
            <li>{`Based on a ${houseNoun(typeName)}, ${lengthFt} x ${widthFt} ft (${m1(lengthFt)} x ${m1(widthFt)} m); other shapes will differ.`}</li>
          </ul>
          {level3 && children}
        </div>
      )}
    </div>
  )
}
export { unitLabelFor, qtyText }
