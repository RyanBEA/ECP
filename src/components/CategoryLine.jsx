import React from 'react'
import { formatMoney } from './PriceCell'
import { m2ToSqFt, perM2ToPerSqFt, ftToM } from '../costing/units'
import { leepRegions, sortRegions } from '../costSystem/client'

// One category on the Cost tab: level 1 (the line), level 2 (This design vs the baseline, spec 4.1) and, when
// level3 is set, the children (the LayerTable, spec 4.2).
const unitLabelFor = r => (r.unit === 'm2' ? 'sq ft' : r.unit === 'house' ? 'house' : 'each')
const qtyText = r => (r.unit === 'm2' ? `${Math.round(m2ToSqFt(r.quantity)).toLocaleString('en-CA')} sq ft` : r.unit === 'house' ? 'per house' : `${r.quantity} each`)
// Components priced in another unit than the line (doors, each), added on top of per-unit x quantity (R24, R45).
const offLineText = (r, component) => {
  const c = (r.components || []).find(x => x.component === component && x.unit !== r.unit)
  return c ? `${c.quantity} each x ${formatMoney(c.material + c.labour, 0)}` : '-'
}
const perUnitText = r => (r.unit === 'm2' ? `${formatMoney(perM2ToPerSqFt(r.perUnit), 2)} / sq ft` : formatMoney(r.perUnit, 0))

// The price source, built per line from its components' sources on both sides (ruling R44, spec 4.1, 7.1).
// A layer (or part) counts as LEEP when every item priced for it, in either house, is a LEEP row.
export const OVERHEAD_SENTENCE = 'Installed prices are assumed to include contractor overhead, profit and waste.'
export function sourceSentence(line) {
  const items = [...(line.design?.components || []), ...(line.baseline?.components || [])]
  if (!items.length) return OVERHEAD_SENTENCE
  const byLayer = new Map()
  for (const c of items) (byLayer.get(c.component) || byLayer.set(c.component, []).get(c.component)).push(c)
  const leepLayers = [...byLayer.values()].filter(cs => cs.every(c => leepRegions(c.source).length > 0))
  const word = ['aboveGroundWalls', 'belowGradeWalls'].includes(line.categoryId) ? 'layers' : 'parts'
  const tail = `supplied and installed, before HST. ${OVERHEAD_SENTENCE}`
  if (!leepLayers.length) return `Prices: placeholders (no LEEP data for this item), ${tail}`
  const regions = sortRegions([...new Set(leepLayers.flat().flatMap(c => leepRegions(c.source)))]).join('/')
  if (leepLayers.length === byLayer.size) return `Prices: LEEP ${regions} rows, ${tail}`
  return `Prices: LEEP ${regions} rows for ${leepLayers.length} of ${byLayer.size} ${word}, placeholders for the rest, ${tail}`
}

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
  // Spec 4.3 and 5.1 notes that sit beside the quantity sentence (ruling R45).
  const extraFor = {
    aboveGroundWalls: 'Rim joists are the same in both houses and are not priced.',
    dhw: 'Gas heaters are priced as natural gas.',
  }[line.categoryId]
  const offLine = bothPriced
    ? [...new Set([d, b].flatMap(r => (r.components || []).filter(c => c.unit !== r.unit).map(c => c.component)))]
    : []
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
              {offLine.map(comp => <tr key={comp}><td>{comp.replace(/_/g, ' ')}</td><td>{offLineText(d, comp)}</td><td>{offLineText(b, comp)}</td></tr>)}
              <tr><td>cost</td><td>{formatMoney(d.cost)}</td><td>{formatMoney(b.cost)}</td></tr>
            </tbody></table>
          ) : <p className="costing-note">{line.reason || line.smallPrint}</p>}
          <ul className="assumptions">
            {sentenceFor && <li>{sentenceFor} {onChangeHouse && line.categoryId !== 'airTightness' && <button type="button" className="link-button" onClick={() => onChangeHouse(HOUSE_FIELD_FOR[line.categoryId])}>change house</button>}</li>}
            {extraFor && <li>{extraFor}</li>}
            {/* Spec 4.5: a Select RSI wall can be built on Points; a below-grade pick cannot (no builder on main). */}
            {d.assumed && isWall && <li>This design is priced as an assumed assembly. Build the assembly on Points to price your own.</li>}
            {b.assumed && isWall && <li>{baselineName} is priced as an assumed assembly for its level.</li>}
            {isBelow && d.assumed && <li>This design is priced as an assumed foundation assembly for its level.</li>}
            {isBelow && <li>Your own foundation assembly cannot be priced in this version.</li>}
            {bothPriced && <li>Both priced {isWall || isBelow ? 'layer by layer' : 'part by part'}; only what differs changes the total. <button type="button" className="link-button" onClick={onOpenLayers}>{isWall || isBelow ? 'see layers' : 'see parts'}</button></li>}
            {bothPriced && <li>Items identical on both sides are priced and cancel in the difference.</li>}
            <li>{sourceSentence(line)}</li>
            <li>{`Based on a ${houseNoun(typeName)}, ${lengthFt} x ${widthFt} ft (${m1(lengthFt)} x ${m1(widthFt)} m); other shapes will differ.`}</li>
          </ul>
          {level3 && children}
        </div>
      )}
    </div>
  )
}
export { unitLabelFor, qtyText }
