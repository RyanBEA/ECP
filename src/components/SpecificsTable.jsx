import React, { useEffect, useState } from 'react'
import PriceInput from './PriceInput'
import { draftOf } from './PriceCell'
import { signedDollars, diffClass, dollars } from '../costing/specifics'
import { perM2ToPerSqFt } from '../costing/units'

// The specifics table (spec rev 3 section 5): read mode and "Use my own prices" edit mode, wide and narrow.
// Edit callbacks are in DISPLAY units ($/sq ft for m2 components); CostTab converts to $/m2 (R3 amended).
const itemId = c => c.priceId ?? c.option
const prefixOf = key => key.split('/')[0]
const shown = (c, v) => (c.unit === 'm2' ? perM2ToPerSqFt(v) : v)
const decimalsFor = c => (c.unit === 'm2' ? 2 : 0)
const lower = s => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)   // 'HRV unit' keeps its capitals

const Diff = ({ value, same }) => (same ? <span className="diff">-</span> : <span className={`diff ${diffClass(value)}`}>{signedDollars(value)}</span>)
const Cell = ({ cell }) => (cell ? <><span className="opt">{cell.text}</span><span className="price">{cell.price}</span></> : <span className="opt">none</span>)

function Legend({ baselineName }) {
  return (
    <p className="specifics-legend">
      <span className="key key-design">This design</span><span className="key key-baseline">{baselineName}</span>
      <span className="key key-more">costs more</span><span className="key key-less">costs less</span>
    </p>
  )
}

function ReadWide({ model, baselineName }) {
  const hasSpec = model.specRows.length > 0
  const f = model.footer
  return (
    <table className="specifics-table">
      <thead><tr><th>{model.firstCol}</th><th className="col-design">This design</th><th className="col-baseline">{baselineName}</th><th className="r">Difference</th></tr></thead>
      <tbody>
        {hasSpec && <tr className="group"><td colSpan={4}>Specification</td></tr>}
        {model.specRows.map(r => (
          <tr key={`spec-${r.key}`} className={`spec ${r.same ? 'same' : 'differs'}`} aria-label={r.item}>
            <td>{r.item}</td><td><span className="opt">{r.design}</span></td><td>{r.same ? 'same' : <span className="opt">{r.baseline}</span>}</td><td className="r" />
          </tr>
        ))}
        {hasSpec && <tr className="group"><td colSpan={4}>Priced, supplied and installed</td></tr>}
        {model.rows.map(r => (
          <tr key={r.key} className={r.same ? 'same' : 'differs'} aria-label={r.item}>
            <td>{r.item}{r.sub && <small>{r.sub}</small>}</td>
            <td><Cell cell={r.design} /></td>
            <td>{r.same ? 'same' : <Cell cell={r.baseline} />}</td>
            <td className="r"><Diff value={r.diff} same={r.same} /></td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        {f.kind === 'perSqFt' && <tr><td>Per sq ft installed</td><td>{`$${f.designPerUnit.toFixed(2)}`}</td><td>{`$${f.baselinePerUnit.toFixed(2)}`}</td><td /></tr>}
        <tr className="tot" aria-label="total">
          <td>{f.kind === 'perSqFt' ? f.quantityText : 'Total'}</td><td>{dollars(f.designCost)}</td><td>{dollars(f.baselineCost)}</td>
          <td className="r"><Diff value={f.diff} same={false} /></td>
        </tr>
      </tfoot>
    </table>
  )
}

function ReadNarrow({ model, baselineName }) {
  const two = (key, item, right, d, b) => (
    <div key={key} data-row={key} className="narrow-row differs">
      <div className="narrow-top"><span>{item}</span>{right}</div>
      <div className="narrow-side"><span className="who who-design">This design</span><span>{d}</span></div>
      <div className="narrow-side"><span className="who who-baseline">{baselineName}</span><span>{b}</span></div>
    </div>
  )
  const one = (key, item, text) => (
    <div key={key} data-row={key} className="narrow-row same"><span><b>{item}</b> {text}</span><span>same</span></div>
  )
  const cellText = c => (c ? `${c.text}, ${c.price}` : 'none')
  const f = model.footer
  return (
    <div className="specifics-narrow">
      {model.specRows.length > 0 && <p className="narrow-group">Specification</p>}
      {model.specRows.map(r => (r.same ? one(`spec-${r.key}`, r.item, r.design) : two(`spec-${r.key}`, r.item, null, r.design, r.baseline)))}
      {model.specRows.length > 0 && <p className="narrow-group">Priced, supplied and installed</p>}
      {model.rows.map(r => (r.same ? one(r.key, r.item, cellText(r.design)) : two(r.key, r.item, <Diff value={r.diff} same={false} />, cellText(r.design), cellText(r.baseline))))}
      <div className="narrow-total">
        <span /><span className="h">This design</span><span className="h">{baselineName}</span>
        {f.kind === 'perSqFt' && <><span>Per sq ft</span><span>{`$${f.designPerUnit.toFixed(2)}`}</span><span>{`$${f.baselinePerUnit.toFixed(2)}`}</span></>}
        <span className="t">{f.kind === 'perSqFt' ? f.quantityText : 'Total'}</span><span className="t">{dollars(f.designCost)}</span><span className="t">{dollars(f.baselineCost)}</span>
        <span>Difference</span><span /><span><Diff value={f.diff} same={false} /></span>
      </div>
    </div>
  )
}

function EditTable({ model, line, baselineName, narrow, onOverride, onLineOverride, changedCount, onResetCard }) {
  const [sideOnly, setSideOnly] = useState({})
  const [lineDraft, setLineDraft] = useState({ design: null, baseline: null })
  const sides = { design: line.design, baseline: line.baseline }
  const names = { design: 'This design', baseline: baselineName }
  useEffect(() => { if (line.design.lineOverride == null) setLineDraft(p => ({ ...p, design: null })) }, [line.design.lineOverride])
  useEffect(() => { if (line.baseline.lineOverride == null) setLineDraft(p => ({ ...p, baseline: null })) }, [line.baseline.lineOverride])

  const linePerUnit = side => (sides[side].unit === 'm2' ? perM2ToPerSqFt(sides[side].perUnit) : sides[side].perUnit)
  const lineStart = side => (sides[side].lineOverride == null ? '' : draftOf(linePerUnit(side), 2))
  const commitLine = side => {
    const draft = lineDraft[side]
    setLineDraft(p => ({ ...p, [side]: null }))
    if (draft === null || draft === '' || draft === lineStart(side)) return
    const n = Number(draft)
    if (Number.isFinite(n) && n >= 0) onLineOverride(side, n)
  }
  const lineLabel = side => `I pay this much per ${model.per} for ${names[side]}`
  const lineInput = side => (
    <label className="line-override">
      <span>{lineLabel(side)}</span>
      <input type="number" min="0" step="any" aria-label={lineLabel(side)} value={lineDraft[side] ?? lineStart(side)}
        onChange={e => setLineDraft(p => ({ ...p, [side]: e.target.value }))} onBlur={() => commitLine(side)}
        onKeyDown={e => { if (e.key === 'Enter') commitLine(side); if (e.key === 'Escape') setLineDraft(p => ({ ...p, [side]: null })) }} />
      {sides[side].lineOverride != null && <button type="button" className="link-button" onClick={() => { setLineDraft(p => ({ ...p, [side]: null })); onLineOverride(side, undefined) }}>reset</button>}
      {sides[side].lineKey && <small>line price in use</small>}
    </label>
  )

  const editsBoth = r => r.same && !sideOnly[r.key]
  // The override keys to clear on reset: the key that supplied the value, or on a same row edited as one,
  // every distinct key supplying either side (R37).
  const resetTargets = (r, side, field, cell) => {
    const key = cell.overrideKeys?.[field]
    return key ? [prefixOf(key)] : [editsBoth(r) ? 'both' : side]
  }
  const isDormant = (side, c) => Boolean(sides[side].lineKey) && c.unit === sides[side].unit
  // A shared field is dormant if either house's line price covers it.
  const dormantFor = (r, side, c) => (editsBoth(r) ? ['design', 'baseline'].some(s => r[s]?.comp && isDormant(s, r[s].comp)) : isDormant(side, c))
  const input = (r, side, field) => {
    const c = r[side]?.comp
    if (!c) return <span className="none">-</span>
    const onSet = v => {
      if (v === undefined) {
        // Clear every (key prefix, price id) pair behind the shown value; on a both-edited row that is each house's own id.
        const cells = editsBoth(r) ? [r.design.comp, r.baseline.comp] : [c]
        const seen = new Set()
        for (const cell of cells) for (const t of resetTargets(r, side, field, cell)) {
          const k = `${t}|${itemId(cell)}`
          if (!seen.has(k)) { seen.add(k); onOverride(t, r.key, itemId(cell), field, undefined) }
        }
      } else if (editsBoth(r)) {
        // Same on screen but possibly priced under two ids: write each distinct id so both houses move together.
        for (const id of new Set([itemId(r.design.comp), itemId(r.baseline.comp)])) onOverride('both', r.key, id, field, v)
      } else onOverride(side, r.key, itemId(c), field, v)
    }
    return <PriceInput name={`${names[side]} ${lower(r.item)} ${field}`} value={shown(c, c[field])} decimals={decimalsFor(c)}
      overridden={c.overridden[field]} dormant={dormantFor(r, side, c)} onSet={onSet} />
  }
  const subOf = r => (r.same ? r.design.text : `${r.design?.text ?? 'none'} vs ${r.baseline?.text ?? 'none'}`)
  const bothToggle = r => (r.same
    ? (sideOnly[r.key]
      ? <button type="button" className="link-button" onClick={() => setSideOnly(p => ({ ...p, [r.key]: false }))}>apply to both</button>
      : <button type="button" className="link-button" onClick={() => setSideOnly(p => ({ ...p, [r.key]: true }))}>this house only</button>)
    : null)

  const wide = (
    <table className="specifics-table edit">
      <thead>
        <tr><th rowSpan={2}>{model.firstCol === 'Layer' ? 'Layer' : 'Part'}</th><th colSpan={2} className="col-design">This design</th><th colSpan={2} className="col-baseline">{baselineName}</th></tr>
        <tr><th className="r">material</th><th className="r">labour</th><th className="r">material</th><th className="r">labour</th></tr>
      </thead>
      <tbody>
        {model.rows.map(r => (
          <tr key={r.key} className={r.same ? 'same' : 'differs'} aria-label={r.item}>
            <td>{r.item}<small>{subOf(r)}</small></td>
            <td className="r">{input(r, 'design', 'material')}</td><td className="r">{input(r, 'design', 'labour')}</td>
            {editsBoth(r)
              ? <td colSpan={2} className="both">applies to both {bothToggle(r)}</td>
              : <><td className="r">{input(r, 'baseline', 'material')}</td><td className="r">{input(r, 'baseline', 'labour')}{bothToggle(r)}</td></>}
          </tr>
        ))}
      </tbody>
    </table>
  )
  const blocks = (
    <div className="specifics-narrow edit">
      {model.rows.map(r => (
        <div key={r.key} className={`edit-block ${r.same ? 'same' : 'differs'}`} aria-label={r.item}>
          <div className="edit-top">{r.item}<small>{subOf(r)}</small></div>
          <div className="edit-side"><span className="who who-design">{editsBoth(r) ? 'Both houses' : 'This design'}</span>{input(r, 'design', 'material')}{input(r, 'design', 'labour')}</div>
          {!editsBoth(r) && r.baseline && <div className="edit-side"><span className="who who-baseline">{baselineName}</span>{input(r, 'baseline', 'material')}{input(r, 'baseline', 'labour')}</div>}
          {bothToggle(r)}
        </div>
      ))}
    </div>
  )
  return (
    <div className="specifics-edit">
      {changedCount > 0 && (
        <p className="changed-count">You've changed {changedCount} price{changedCount === 1 ? '' : 's'} on this card .{' '}
          <button type="button" className="link-button" onClick={onResetCard}>reset all</button></p>
      )}
      <div className="line-overrides">{lineInput('design')}{lineInput('baseline')}</div>
      {narrow ? blocks : wide}
      <p className="costing-note">{`Supplied and installed. What you type is kept on this device until you reset it. On ${model.categoryId === 'aboveGroundWalls' ? 'a layer' : 'a part'} that is the same in both houses it applies to both, unless you pick "this house only".`}</p>
    </div>
  )
}

export default function SpecificsTable({ model, line, baselineName, narrow = false, editing = false, onOverride = () => {}, onLineOverride = () => {}, changedCount = 0, onResetCard }) {
  return (
    <div className="specifics" data-testid={`specifics-${model.categoryId}`}>
      {editing
        ? <EditTable model={model} line={line} baselineName={baselineName} narrow={narrow} onOverride={onOverride} onLineOverride={onLineOverride} changedCount={changedCount} onResetCard={onResetCard} />
        : <>
            {narrow ? <ReadNarrow model={model} baselineName={baselineName} /> : <ReadWide model={model} baselineName={baselineName} />}
            {model.lineNote && <p className="costing-note line-note">{model.lineNote}</p>}
            <Legend baselineName={baselineName} />
          </>}
    </div>
  )
}
