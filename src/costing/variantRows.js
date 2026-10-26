// Regroups the Cost tab's specifics model (buildSpecifics) into variant A (one row per category) and
// variant B (one row per trade). Pure: it only groups and sums what the model already holds; no price is recomputed.
import { perM2ToPerSqFt } from './units'
import { TRADES, OTHER, tradeFor } from './trades'

export const A_LABELS = {
  aboveGroundWalls: 'Per sq ft installed', belowGradeWalls: 'Per sq ft installed', windowsDoors: 'Windows and doors',
  dhw: 'Heater, installed with its parts', hrv: 'HRV, installed', airTightness: 'Target and testing',
}

const r2 = n => Math.round(n * 100) / 100
const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0)
const dollarsOf = (rows, side) => sum(rows, r => r[side]?.cost || 0)
// Same rounding as the footer in specifics.js: the sum of the rounded per-sq-ft row prices, in-line rows only.
const perSqFtOf = (rows, side) => sum(rows.filter(r => r[side] && r.inLine), r => Number(perM2ToPerSqFt(r[side].comp.material + r[side].comp.labour).toFixed(2)))
const has = (rows, side) => rows.some(r => r[side])

// The dollars on the house behind a row's value for one side ('design' | 'baseline').
export const rowDollars = (row, side) => row.dollars[side]

const lowerFirst = s => (/^HRV/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1))

function rowA(model, line) {
  const f = model.footer
  const dollars = { design: dollarsOf(model.rows, 'design'), baseline: dollarsOf(model.rows, 'baseline') }
  const base = { key: model.categoryId, item: A_LABELS[model.categoryId] || model.categoryId, sub: '', same: model.rows.every(r => r.same), dollars }
  if (model.categoryId === 'windowsDoors') {
    const w = model.rows.find(r => r.key === 'windows'), d = model.rows.find(r => r.key === 'doors')
    if (w && d) base.sub = `${w.sub} of windows, ${d.sub}`
  }
  if (f.kind === 'perSqFt') {
    return { ...base, design: f.designPerUnit, baseline: f.baselinePerUnit, diff: r2(f.designPerUnit - f.baselinePerUnit), diffIsTotal: false }
  }
  return { ...base, design: f.designCost, baseline: f.baselineCost, diff: f.diff, diffIsTotal: true }
}

function rowsB(model) {
  const id = model.categoryId, perSqFt = model.footer.kind === 'perSqFt'
  const groups = new Map()
  for (const r of model.rows) {
    const t = tradeFor(id, r.key)
    if (!groups.has(t.id)) groups.set(t.id, { trade: t, rows: [] })
    groups.get(t.id).rows.push(r)
  }
  const ordered = [...TRADES, OTHER].filter(t => groups.has(t.id)).map(t => groups.get(t.id))
  return ordered.map(({ trade, rows }) => {
    const dollars = { design: dollarsOf(rows, 'design'), baseline: dollarsOf(rows, 'baseline') }
    const sub = trade.sub?.[id] ?? [...new Set(rows.map(r => lowerFirst(r.item)))].join(', ')
    const side = s => (!has(rows, s) ? null : perSqFt ? perSqFtOf(rows, s) : dollars[s])
    return { key: trade.id, item: trade.label, sub, same: rows.every(r => r.same), design: side('design'), baseline: side('baseline'), diff: sum(rows, r => r.diff), diffIsTotal: true, dollars }
  })
}

export function variantRows(variant, model, line) {
  return {
    kind: model.footer.kind,
    rows: variant === 'a' ? [rowA(model, line)] : rowsB(model),
    footer: model.footer,
  }
}
