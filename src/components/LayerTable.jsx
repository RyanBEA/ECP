import React, { useEffect, useState } from 'react'
import PriceCell, { formatMoney, draftOf } from './PriceCell'
import { perM2ToPerSqFt } from '../costing/units'

// Level 3 of the cost disclosure (spec 4.2): both houses side by side, one row per layer or part.
//
// Callbacks are in DISPLAY units (rulings R3, R37): onOverride and onLineOverride receive the number the builder
// typed, e.g. $/sq ft in a 'sq ft' table. Conversion back to $/m2 is the caller's job (CostTab, Task 13). Only
// components priced in m2 are shown in $/sq ft; a component in another unit (doors, each) is shown and emitted in
// its own unit, as its own "+ N each" row, so per-unit x quantity + those rows = the line's cost (R24).
//
// onOverride(side | 'both', component, priceId, field, value | undefined)  priceId = c.priceId ?? c.option (R25).
//   A reset (undefined) names the key that supplied the value (c.overrideKeys[field]), once per distinct key.
// onLineOverride(side, value | undefined)
// changedCount / onResetCard: optional per-card count of changed prices and its "reset all" (R36).

const SIDES = ['design', 'baseline']
const toDisplay = (v, unit, unitLabel) => (unitLabel === 'sq ft' && unit === 'm2' ? perM2ToPerSqFt(v) : v)
const prettyName = c => c.replace(/_/g, ' ')
const itemId = c => c.priceId ?? c.option
const prefixOf = key => key.split('/')[0]

export default function LayerTable({ categoryId, line, baselineName, unitLabel, onOverride, onLineOverride, quantityDisplay, onBack, changedCount = 0, onResetCard }) {
  const [showIdentical, setShowIdentical] = useState(false)
  const [sideOnly, setSideOnly] = useState({})   // component -> true when the builder chose "this house only"
  const [lineDraft, setLineDraft] = useState({ design: null, baseline: null })   // null = not being edited
  const sides = { design: line.design, baseline: line.baseline }
  const names = { design: 'This design', baseline: baselineName }
  const per = unitLabel === 'each' ? 'unit' : unitLabel   // 'per sq ft', 'per unit', 'per house'
  const lineUnit = line.design.unit ?? line.baseline.unit

  // A line override that goes away (reset, or the card's reset all) drops whatever was typed in its field.
  useEffect(() => { if (line.design.lineOverride == null) setLineDraft(p => ({ ...p, design: null })) }, [line.design.lineOverride])
  useEffect(() => { if (line.baseline.lineOverride == null) setLineDraft(p => ({ ...p, baseline: null })) }, [line.baseline.lineOverride])

  const byComp = {}
  for (const s of SIDES) for (const c of sides[s].components || []) (byComp[c.component] ||= {})[s] = c
  const rows = Object.entries(byComp).map(([component, bs]) => {
    const d = bs.design, b = bs.baseline
    const identical = Boolean(d && b && itemId(d) === itemId(b) && d.unit === b.unit && d.material === b.material && d.labour === b.labour)
    const inLine = (d || b).unit === lineUnit
    return { component, d, b, identical, inLine }
  })
  const lineRows = rows.filter(r => r.inLine)
  const offRows = rows.filter(r => !r.inLine)
  const identicalRows = lineRows.filter(r => r.identical)
  const identicalTotal = identicalRows.reduce((s, r) => s + toDisplay(r.d.material + r.d.labour, r.d.unit, unitLabel), 0)
  const perUnit = s => sides[s].state === 'priced' && sides[s].perUnit !== null ? toDisplay(sides[s].perUnit, sides[s].unit, unitLabel) : null
  // A component in the line's unit is dormant while that side's line override is active: its value does not reach the cost.
  const isDormant = (side, c) => Boolean(sides[side].lineKey) && c.unit === sides[side].unit
  const editsBoth = row => row.identical && !sideOnly[row.component]
  // Which override keys to clear when this cell is reset: the key that supplied the value, or on an identical row
  // edited as one, every distinct key supplying either side.
  const resetTargets = (row, side, field) => {
    const own = row[side === 'design' ? 'd' : 'b']
    const cells = editsBoth(row) ? [row.d, row.b] : [own]
    const prefixes = [...new Set(cells.map(c => c.overrideKeys?.[field]).filter(Boolean).map(prefixOf))]
    return prefixes.length ? prefixes : [editsBoth(row) ? 'both' : side]
  }
  const suffix = c => (c.unit !== lineUnit ? <small> {c.unit}</small> : null)
  const cell = (row, side, field) => {
    const c = row[side === 'design' ? 'd' : 'b']
    if (!c) return <td className="r">-</td>
    const onSet = v => {
      if (v === undefined) for (const t of resetTargets(row, side, field)) onOverride(t, row.component, itemId(c), field, undefined)
      else onOverride(editsBoth(row) ? 'both' : side, row.component, itemId(c), field, v)
    }
    return (
      <td className="r">
        <PriceCell name={`${names[side]} ${prettyName(row.component)} ${field}`} value={toDisplay(c[field], c.unit, unitLabel)} overridden={c.overridden[field]}
          dormant={isDormant(side, c)} onSet={onSet} />
        {suffix(c)}
      </td>
    )
  }
  const totalCell = (c, inLine) => {
    if (!c) return <td className="r">-</td>
    const each = c.material + c.labour
    if (inLine) return <td className="r">{formatMoney(toDisplay(each, c.unit, unitLabel), 2)}</td>
    return <td className="r">{`${c.quantity} ${c.unit} x ${formatMoney(each, 2)} = ${formatMoney(each * c.quantity)}`}</td>
  }
  const renderRow = row => (
    <tr key={row.component} className={[row.identical ? 'same' : 'differs', row.inLine ? '' : 'part'].filter(Boolean).join(' ')} aria-label={prettyName(row.component)}>
      <td>{row.inLine ? '' : '+ '}{prettyName(row.component)}{!row.identical && row.d && row.b && itemId(row.d) !== itemId(row.b) ? <small> {row.d.label} vs {row.b.label}</small> : null}
        {row.identical && <button type="button" className="link-button" onClick={() => setSideOnly(p => ({ ...p, [row.component]: !p[row.component] }))}>{sideOnly[row.component] ? 'editing one house' : 'this house only'}</button>}</td>
      {cell(row, 'design', 'material')}{cell(row, 'design', 'labour')}{totalCell(row.d, row.inLine)}
      {cell(row, 'baseline', 'material')}{cell(row, 'baseline', 'labour')}{totalCell(row.b, row.inLine)}
    </tr>
  )
  const lineStart = side => (sides[side].lineOverride == null ? '' : draftOf(perUnit(side), 2))
  const commitLine = side => {
    const draft = lineDraft[side]
    setLineDraft(p => ({ ...p, [side]: null }))
    if (draft === null || draft === '' || draft === lineStart(side)) return
    const n = Number(draft)
    if (Number.isFinite(n) && n >= 0) onLineOverride(side, n)
  }
  const lineInput = side => (
    <label className="line-override">
      <span>I pay this much per {per} for {names[side]}</span>
      <input type="number" min="0" step="any" aria-label={`I pay this much per ${per} for ${names[side]}`} value={lineDraft[side] ?? lineStart(side)}
        onChange={e => setLineDraft(p => ({ ...p, [side]: e.target.value }))}
        onBlur={() => commitLine(side)}
        onKeyDown={e => { if (e.key === 'Enter') commitLine(side); if (e.key === 'Escape') setLineDraft(p => ({ ...p, [side]: null })) }} />
      {sides[side].lineOverride != null && <button type="button" className="link-button" onClick={() => { setLineDraft(p => ({ ...p, [side]: null })); onLineOverride(side, undefined) }}>reset</button>}
      {sides[side].lineKey && <small className="muted">line price in use</small>}
    </label>
  )
  return (
    <div className="layer-table" data-testid={`layer-table-${categoryId}`}>
      <div className="layer-table-head"><span>Layers . $ per {per} . {quantityDisplay}</span>{onBack && <button type="button" className="link-button" onClick={onBack}>back to summary</button>}</div>
      {changedCount > 0 && (
        <p className="changed-count">You've changed {changedCount} price{changedCount === 1 ? '' : 's'} on this card .{' '}
          <button type="button" className="link-button" onClick={onResetCard}>reset all</button></p>
      )}
      <div className="line-overrides">{lineInput('design')}{lineInput('baseline')}</div>
      <table>
        <thead>
          <tr><th>layer</th><th colSpan={3}>This design . {line.design.description}</th><th colSpan={3}>{baselineName} . {line.baseline.description}</th></tr>
          <tr><th></th><th className="r">material</th><th className="r">labour</th><th className="r">per {per}</th><th className="r">material</th><th className="r">labour</th><th className="r">per {per}</th></tr>
        </thead>
        <tbody>
          {lineRows.filter(r => !r.identical).map(renderRow)}
          {identicalRows.length > 0 && (
            <tr className="identical-toggle"><td colSpan={7}><button type="button" className="link-button" onClick={() => setShowIdentical(s => !s)}>
              {identicalRows.length} identical layer{identicalRows.length === 1 ? '' : 's'}, {formatMoney(identicalTotal, 2)} per {per} ({showIdentical ? 'hide' : 'show'})</button></td></tr>
          )}
          {showIdentical && identicalRows.map(renderRow)}
          <tr className="tot"><td>per {per} installed</td><td colSpan={3} className="r">{perUnit('design') === null ? '-' : formatMoney(perUnit('design'), 2)}</td><td colSpan={3} className="r">{perUnit('baseline') === null ? '-' : formatMoney(perUnit('baseline'), 2)}</td></tr>
          {offRows.map(renderRow)}
          <tr className="tot"><td>x {quantityDisplay}{offRows.length > 0 ? ' + parts' : ''}</td><td colSpan={3} className="r">{formatMoney(line.design.cost)}</td><td colSpan={3} className="r">{formatMoney(line.baseline.cost)}</td></tr>
        </tbody>
      </table>
      <p className="costing-note">Pencil = type your own price for that layer; it is kept on this device until you reset it. A price changed on an identical layer applies to both houses unless you choose "this house only".</p>
    </div>
  )
}
