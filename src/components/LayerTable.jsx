import React, { useState } from 'react'
import PriceCell, { formatMoney } from './PriceCell'
import { perM2ToPerSqFt } from '../costing/units'

// Level 3 of the cost disclosure (spec 4.2): both houses side by side, one row per layer or part.
//
// Callbacks are in DISPLAY units (ruling R3): onOverride and onLineOverride receive the number the builder typed,
// e.g. $/sq ft in a 'sq ft' table. Conversion back to $/m2 is the caller's job (CostTab, Task 13). Only components
// priced in m2 are shown in $/sq ft; a component in another unit (a door, each) is shown and emitted in its own unit.
//
// onOverride(side | 'both', component, priceId, field, value | undefined)  priceId = c.priceId ?? c.option (R25)
// onLineOverride(side, value | undefined)
// changedCount / onResetCard: optional per-card count of changed prices and its "reset all" (R36).

const SIDES = ['design', 'baseline']
const toDisplay = (v, unit, unitLabel) => (unitLabel === 'sq ft' && unit === 'm2' ? perM2ToPerSqFt(v) : v)
const prettyName = c => c.replace(/_/g, ' ')

export default function LayerTable({ categoryId, line, baselineName, unitLabel, onOverride, onLineOverride, quantityDisplay, onBack, changedCount = 0, onResetCard }) {
  const [showIdentical, setShowIdentical] = useState(false)
  const [sideOnly, setSideOnly] = useState({})   // component -> true when the builder chose "this house only"
  const [lineDraft, setLineDraft] = useState({ design: '', baseline: '' })
  const sides = { design: line.design, baseline: line.baseline }
  const names = { design: 'This design', baseline: baselineName }
  const byComp = {}
  for (const s of SIDES) for (const c of sides[s].components || []) (byComp[c.component] ||= {})[s] = c
  const rows = Object.entries(byComp).map(([component, bs]) => {
    const d = bs.design, b = bs.baseline
    const identical = Boolean(d && b && d.option === b.option && d.material === b.material && d.labour === b.labour)
    return { component, d, b, identical }
  })
  const identicalRows = rows.filter(r => r.identical)
  // Only components in the line's unit add into the per-unit total (R24), so only they count here.
  const identicalTotal = identicalRows.filter(r => r.d.unit === line.design.unit)
    .reduce((s, r) => s + toDisplay(r.d.material + r.d.labour, r.d.unit, unitLabel), 0)
  const perUnit = s => sides[s].state === 'priced' && sides[s].perUnit !== null ? toDisplay(sides[s].perUnit, sides[s].unit, unitLabel) : null
  // A component in the line's unit is dormant while that side's line override is active: its value does not reach the cost.
  const isDormant = (side, c) => Boolean(sides[side].lineKey) && c.unit === sides[side].unit
  const unitSuffix = c => (c.unit !== line.design.unit ? <small> {c.unit}</small> : null)
  const cell = (row, side, field) => {
    const c = row[side === 'design' ? 'd' : 'b']
    if (!c) return <td className="r">-</td>
    const target = row.identical && !sideOnly[row.component] ? 'both' : side
    return (
      <td className="r">
        <PriceCell name={`${names[side]} ${prettyName(row.component)} ${field}`} value={toDisplay(c[field], c.unit, unitLabel)} overridden={c.overridden[field]}
          dormant={isDormant(side, c)}
          onSet={v => onOverride(target, row.component, c.priceId ?? c.option, field, v)} />
      </td>
    )
  }
  const totalCell = c => <td className="r">{c ? <>{formatMoney(toDisplay(c.material + c.labour, c.unit, unitLabel), 2)}{unitSuffix(c)}</> : '-'}</td>
  const renderRow = row => (
    <tr key={row.component} className={row.identical ? 'same' : 'differs'} aria-label={prettyName(row.component)}>
      <td>{prettyName(row.component)}{!row.identical && row.d && row.b && row.d.option !== row.b.option ? <small> {row.d.label} vs {row.b.label}</small> : null}
        {row.identical && <button type="button" className="link-button" onClick={() => setSideOnly(p => ({ ...p, [row.component]: !p[row.component] }))}>{sideOnly[row.component] ? 'editing one house' : 'this house only'}</button>}</td>
      {cell(row, 'design', 'material')}{cell(row, 'design', 'labour')}{totalCell(row.d)}
      {cell(row, 'baseline', 'material')}{cell(row, 'baseline', 'labour')}{totalCell(row.b)}
    </tr>
  )
  const lineInput = side => (
    <label className="line-override">
      <span>I pay this much per {unitLabel} for {names[side]}</span>
      <input type="number" min="0" step="any" aria-label={`I pay this much per ${unitLabel} for ${names[side]}`} value={lineDraft[side]}
        onChange={e => setLineDraft(p => ({ ...p, [side]: e.target.value }))}
        onBlur={() => { if (lineDraft[side] !== '') onLineOverride(side, Number(lineDraft[side])) }} />
      {sides[side].lineOverride !== null && sides[side].lineOverride !== undefined && <button type="button" className="link-button" onClick={() => { setLineDraft(p => ({ ...p, [side]: '' })); onLineOverride(side, undefined) }}>reset</button>}
      {sides[side].lineKey && <small className="muted">line price in use</small>}
    </label>
  )
  return (
    <div className="layer-table" data-testid={`layer-table-${categoryId}`}>
      <div className="layer-table-head"><span>Layers . $ per {unitLabel} . {quantityDisplay}</span>{onBack && <button type="button" className="link-button" onClick={onBack}>back to summary</button>}</div>
      {changedCount > 0 && (
        <p className="changed-count">You've changed {changedCount} price{changedCount === 1 ? '' : 's'} on this card .{' '}
          <button type="button" className="link-button" onClick={onResetCard}>reset all</button></p>
      )}
      <div className="line-overrides">{lineInput('design')}{lineInput('baseline')}</div>
      <table>
        <thead>
          <tr><th>layer</th><th colSpan={3}>This design . {line.design.description}</th><th colSpan={3}>{baselineName} . {line.baseline.description}</th></tr>
          <tr><th></th><th className="r">material</th><th className="r">labour</th><th className="r">per {unitLabel}</th><th className="r">material</th><th className="r">labour</th><th className="r">per {unitLabel}</th></tr>
        </thead>
        <tbody>
          {rows.filter(r => !r.identical).map(renderRow)}
          {identicalRows.length > 0 && (
            <tr className="identical-toggle"><td colSpan={7}><button type="button" className="link-button" onClick={() => setShowIdentical(s => !s)}>
              {identicalRows.length} identical layer{identicalRows.length === 1 ? '' : 's'}, {formatMoney(identicalTotal, 2)} per {unitLabel} ({showIdentical ? 'hide' : 'show'})</button></td></tr>
          )}
          {showIdentical && identicalRows.map(renderRow)}
          <tr className="tot"><td>per {unitLabel} installed</td><td colSpan={3} className="r">{perUnit('design') === null ? '-' : formatMoney(perUnit('design'), 2)}</td><td colSpan={3} className="r">{perUnit('baseline') === null ? '-' : formatMoney(perUnit('baseline'), 2)}</td></tr>
          <tr className="tot"><td>x {quantityDisplay}</td><td colSpan={3} className="r">{formatMoney(line.design.cost)}</td><td colSpan={3} className="r">{formatMoney(line.baseline.cost)}</td></tr>
        </tbody>
      </table>
      <p className="costing-note">Pencil = type your own price for that layer; it is kept on this device until you reset it. A price changed on an identical layer applies to both houses unless you choose "this house only".</p>
    </div>
  )
}
