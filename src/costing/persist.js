// Browser persistence for the cost layer (spec 7.3): one versioned blob, every access guarded.
import { ARCHETYPES } from './archetypes'

export const STORAGE_KEY = 'ecp-cost-ui'
export const SCHEMA_VERSION = 1

const OBJECT_KEYS = ['fieldOverrides', 'usualHouse', 'overrides']
const BOOLEAN_KEYS = ['hasOpenedCost', 'chipHidden']
const BASELINE_CHOICES = ['codeMinimum', 'typicalTier2', 'usualHouse']

export const DEFAULT_PERSISTED = Object.freeze({
  schemaVersion: SCHEMA_VERSION, hasOpenedCost: false, chipHidden: false,
  houseType: 'singleDetached', baselineChoice: 'typicalTier2',
  fieldOverrides: Object.freeze({}), usualHouse: Object.freeze({}), overrides: Object.freeze({}),
})

// A fresh copy per load: nested objects are never shared between loads or with DEFAULT_PERSISTED.
const defaults = () => ({ ...DEFAULT_PERSISTED, fieldOverrides: {}, usualHouse: {}, overrides: {} })
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) return defaults()
    const out = { ...defaults(), ...parsed }
    // A key of the wrong shape falls back to its default, so a damaged blob never breaks the page.
    for (const k of OBJECT_KEYS) if (!isPlainObject(out[k])) out[k] = {}
    for (const k of BOOLEAN_KEYS) if (typeof out[k] !== 'boolean') out[k] = DEFAULT_PERSISTED[k]
    if (!ARCHETYPES.some(a => a.type === out.houseType)) out.houseType = DEFAULT_PERSISTED.houseType
    if (!BASELINE_CHOICES.includes(out.baselineChoice)) out.baselineChoice = DEFAULT_PERSISTED.baselineChoice
    return out
  } catch {
    return defaults()
  }
}

export function savePersisted(blob) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...blob, schemaVersion: SCHEMA_VERSION })) } catch { /* private window or quota: first-visit behaviour next time */ }
}
