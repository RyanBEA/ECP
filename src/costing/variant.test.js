// src/costing/variant.test.js
import { describe, it, expect } from 'vitest'
import { readVariant, VARIANT_KEY, VARIANTS } from './variant'

function fakeStorage(initial) {
  const m = new Map(initial === undefined ? [] : [[VARIANT_KEY, initial]])
  return {
    m,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: k => { m.delete(k) },
  }
}

describe('readVariant', () => {
  it('exports the key and values', () => {
    expect(VARIANT_KEY).toBe('ecp.costVariant')
    expect(VARIANTS).toEqual(['a', 'b', 'c'])
  })
  it('url wins over storage', () => {
    const s = fakeStorage('a')
    expect(readVariant('?variant=b', s)).toBe('b')
    expect(s.getItem(VARIANT_KEY)).toBe('b')
  })
  it('case-insensitive', () => {
    expect(readVariant('?variant=A', fakeStorage())).toBe('a')
  })
  it('stored value without url', () => {
    expect(readVariant('', fakeStorage('b'))).toBe('b')
  })
  it('default', () => {
    const s = fakeStorage()
    expect(readVariant('', s)).toBe('c')
    expect(s.m.size).toBe(0)
  })
  it('reset clears', () => {
    const s = fakeStorage('a')
    expect(readVariant('?variant=reset', s)).toBe('c')
    expect(s.m.has(VARIANT_KEY)).toBe(false)
  })
  it('unknown value ignored', () => {
    expect(readVariant('?variant=zz', fakeStorage('a'))).toBe('a')
  })
  it('storage throwing is survived', () => {
    const boom = () => { throw new Error('denied') }
    expect(readVariant('?variant=b', { getItem: boom, setItem: boom, removeItem: boom })).toBe('b')
  })
  it('window.localStorage access throwing is survived', () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
    try {
      expect(readVariant('?variant=b')).toBe('b')
      expect(readVariant('')).toBe('c')
    } finally {
      if (desc) Object.defineProperty(window, 'localStorage', desc)
      else delete window.localStorage
    }
  })
})
