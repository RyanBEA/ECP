// Stand-in for the cost system (spec 6.4): a synchronous lookup over the bundled price table.
// After D2 this file becomes the client for Volta's cost system API; nothing above it changes.
import rows from '../costing/data/stand-in-costs.json'

export const USING_STAND_IN = true
export const PRICE_SOURCE_LABEL = 'placeholder and LEEP 2013-2016 (Ontario, Manitoba, BC) data'

const key = r => `${r.category}|${r.component}|${r.option}|${r.fuel ?? ''}|${r.size ?? ''}`
const index = new Map(rows.map(r => [key(r), r]))

// Row and key counts of the bundled table; equal when no two rows share a match key.
export const STAND_IN_ROW_COUNT = rows.length
export const STAND_IN_KEY_COUNT = index.size

// request: { category, component, option, fuel?, size? } -> { material, labour, priced_item, source, unit } | null
export function lookupCost(request) {
  const r = index.get(key({ fuel: null, size: null, ...request }))
  return r ? { material: r.material, labour: r.labour, priced_item: r.priced_item, source: r.source, unit: r.unit } : null
}

// Promise form for callers that still want one (spec 6.4).
export const requestCosts = request => Promise.resolve(lookupCost(request))
