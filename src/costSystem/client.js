// Stand-in for the cost system (spec 6.4): a synchronous lookup over the bundled price table.
// After D2 this file becomes the client for Volta's cost system API; nothing above it changes.
import rows from '../costing/data/stand-in-costs.json'

export const USING_STAND_IN = true

// LEEP regions in a row's source ('LEEP ON', 'LEEP MB/BC'), in a fixed order; [] for a placeholder row.
export const LEEP_REGION_ORDER = ['ON', 'MB', 'BC']
const REGION_NAME = { ON: 'Ontario', MB: 'Manitoba', BC: 'BC' }
export function leepRegions(source) {
  const m = /^LEEP (.+)$/.exec(source || '')
  return m ? m[1].split('/').map(s => s.trim()) : []
}
export const sortRegions = regions => LEEP_REGION_ORDER.filter(r => regions.includes(r))

// Ruling R44: the label names only the regions actually present in the table.
const tableRegions = sortRegions([...new Set(rows.flatMap(r => leepRegions(r.source)))])
const hasPlaceholders = rows.some(r => r.source === 'placeholder')
export const PRICE_SOURCE_LABEL = tableRegions.length
  ? `${hasPlaceholders ? 'placeholder and ' : ''}LEEP 2013-2016 (${tableRegions.map(r => REGION_NAME[r]).join(', ')}) data`
  : 'placeholder data'

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
