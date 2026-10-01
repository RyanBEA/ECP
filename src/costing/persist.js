// Browser persistence for the cost layer (spec 7.3): one versioned blob, every access guarded.
export const STORAGE_KEY = 'ecp-cost-ui'
export const SCHEMA_VERSION = 1

export const DEFAULT_PERSISTED = Object.freeze({
  schemaVersion: SCHEMA_VERSION, hasOpenedCost: false, chipHidden: false,
  houseType: 'singleDetached', baselineChoice: 'typicalTier2',
  fieldOverrides: {}, usualHouse: {}, overrides: {},
})

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PERSISTED }
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return { ...DEFAULT_PERSISTED }
    return { ...DEFAULT_PERSISTED, ...parsed }
  } catch {
    return { ...DEFAULT_PERSISTED }
  }
}

export function savePersisted(blob) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...blob, schemaVersion: SCHEMA_VERSION })) } catch { /* private window or quota: first-visit behaviour next time */ }
}
