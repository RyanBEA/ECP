import { loadPersisted, savePersisted, DEFAULT_PERSISTED, SCHEMA_VERSION, STORAGE_KEY } from './persist'

describe('persist', () => {
  beforeEach(() => { localStorage.clear() })
  it('returns defaults when nothing is stored', () => {
    expect(loadPersisted()).toEqual(DEFAULT_PERSISTED)
    expect(DEFAULT_PERSISTED.houseType).toBe('singleDetached')
    expect(DEFAULT_PERSISTED.baselineChoice).toBe('typicalTier2')
  })
  it('round-trips a blob', () => {
    const blob = { ...DEFAULT_PERSISTED, hasOpenedCost: true, houseType: 'miniHome', usualHouse: { miniHome: { cards: { hrv: 75 }, wall: null } } }
    savePersisted(blob)
    expect(loadPersisted()).toEqual(blob)
  })
  it('discards a blob with another schema version (Review Focus 4)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, schemaVersion: SCHEMA_VERSION + 1, hasOpenedCost: true }))
    expect(loadPersisted()).toEqual(DEFAULT_PERSISTED)
  })
  it('survives blocked storage and bad JSON (Review Focus 4)', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadPersisted()).toEqual(DEFAULT_PERSISTED)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => savePersisted(DEFAULT_PERSISTED)).not.toThrow()
    spy.mockRestore()
    const spy2 = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadPersisted()).toEqual(DEFAULT_PERSISTED)
    spy2.mockRestore()
  })
})
