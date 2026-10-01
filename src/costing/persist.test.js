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
    const errorSpy = vi.spyOn(console, 'error')
    const warnSpy = vi.spyOn(console, 'warn')
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadPersisted()).toEqual(DEFAULT_PERSISTED)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => savePersisted(DEFAULT_PERSISTED)).not.toThrow()
    spy.mockRestore()
    const spy2 = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadPersisted()).toEqual(DEFAULT_PERSISTED)
    spy2.mockRestore()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })
  it('uses the default for a nested key that is not a plain object (Task 15 notes)', () => {
    for (const bad of [null, [], 'x', 3, true]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, hasOpenedCost: true, fieldOverrides: bad, usualHouse: bad, overrides: bad }))
      const got = loadPersisted()
      expect(got.fieldOverrides).toEqual({})
      expect(got.usualHouse).toEqual({})
      expect(got.overrides).toEqual({})
      expect(got.hasOpenedCost).toBe(true)
    }
  })
  it('uses the default for an unknown house type or compared-with choice', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PERSISTED, houseType: 'castle', baselineChoice: 'mansion' }))
    const got = loadPersisted()
    expect(got.houseType).toBe('singleDetached')
    expect(got.baselineChoice).toBe('typicalTier2')
  })
  it('returns fresh nested objects on every load, never shared with the defaults', () => {
    const a = loadPersisted()
    const b = loadPersisted()
    expect(a.usualHouse).not.toBe(b.usualHouse)
    expect(a.overrides).not.toBe(DEFAULT_PERSISTED.overrides)
    a.overrides.x = { line: 1 }
    a.fieldOverrides.singleDetached = { storeys: 2 }
    expect(loadPersisted().overrides).toEqual({})
    expect(loadPersisted().fieldOverrides).toEqual({})
    expect(DEFAULT_PERSISTED.overrides).toEqual({})
  })
})
