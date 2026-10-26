import React from 'react'
import { Legend } from './SpecificsTable'
import { variantRows } from '../costing/variantRows'
import { dollars, signedDollars, diffClass } from '../costing/specifics'

// Round 1 variants A (assemblies) and B (trades) of the specifics: one three-column table per category.
// Reads variantRows(); nothing is priced here.
const perSqFt = n => `$${n.toFixed(2)}`
const signedPerSqFt = n => { const r = Math.round(n * 100) / 100; return r === 0 ? '$0.00' : `${r > 0 ? '+' : '-'}$${Math.abs(r).toFixed(2)}` }
const perSqFtClass = n => (n >= 0.005 ? 'more' : n <= -0.005 ? 'less' : '')

const Diff = ({ value, total, same }) => {
  if (same) return <span className="diff">-</span>
  const c = total ? diffClass(value) : perSqFtClass(value)
  return <span className={`diff ${c}`}>{total ? signedDollars(value) : signedPerSqFt(value)}</span>
}

export default function VariantTable({ variant, model, line, baselineName }) {
  const { kind, rows, footer: f } = variantRows(variant, model, line)
  const per = kind === 'perSqFt'
  const money = v => (v === null ? 'none' : per ? perSqFt(v) : dollars(v))
  return (
    <div className="specifics variant-table" data-testid={`variant-${variant}-${model.categoryId}`}>
      <table className="specifics-table variant">
        <thead><tr><th>{variant === 'a' ? 'Item' : 'Trade'}</th><th className="col-design">This design</th><th className="col-baseline">{baselineName}</th><th className="r">Difference</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} aria-label={r.item} className={r.same ? 'same' : 'differs'}>
              <td>{r.item}{r.sub && <small>{r.sub}</small>}</td>
              <td>{money(r.design)}</td>
              <td>{r.same ? 'same' : money(r.baseline)}</td>
              <td className="r"><Diff value={r.diff} total={r.diffIsTotal} same={r.same} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {per && (
            <tr>
              <td>Per sq ft installed</td><td>{perSqFt(f.designPerUnit)}</td><td>{perSqFt(f.baselinePerUnit)}</td>
              <td className="r"><Diff value={f.designPerUnit - f.baselinePerUnit} total={false} same={false} /></td>
            </tr>
          )}
          <tr className="tot" aria-label="total">
            <td>{per ? f.quantityText : 'Total'}</td><td>{dollars(f.designCost)}</td><td>{dollars(f.baselineCost)}</td>
            <td className="r"><Diff value={f.diff} total same={false} /></td>
          </tr>
        </tfoot>
      </table>
      {model.lineNote && <p className="costing-note line-note">{model.lineNote}</p>}
      <Legend baselineName={baselineName} />
    </div>
  )
}
