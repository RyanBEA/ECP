// src/costing/variant.js
// The hidden presentation switch for the Cost tab: 'a' | 'b' | 'c'. Resolved once at app start.
export const VARIANT_KEY = 'ecp.costVariant'
export const VARIANTS = ['a', 'b', 'c']

const DEFAULT = 'c'

export function readVariant(search = window.location.search, storage = window.localStorage) {
  let param = null
  try { param = new URLSearchParams(search).get('variant') } catch { /* no usable query string */ }
  const asked = param == null ? null : param.trim().toLowerCase()
  if (asked === 'reset') {
    try { storage.removeItem(VARIANT_KEY) } catch { /* storage unavailable */ }
    return DEFAULT
  }
  if (asked && VARIANTS.includes(asked)) {
    try { storage.setItem(VARIANT_KEY, asked) } catch { /* storage unavailable */ }
    return asked
  }
  try {
    const stored = storage.getItem(VARIANT_KEY)
    if (VARIANTS.includes(stored)) return stored
  } catch { /* storage unavailable */ }
  return DEFAULT
}
