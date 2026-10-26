// src/App.variant.test.jsx
import React from 'react'
import { render } from '@testing-library/react'
import App from './App'

describe('variant switch in App', () => {
  beforeEach(() => { window.localStorage.clear(); window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} })) })
  afterEach(() => { window.history.replaceState({}, '', '/'); window.localStorage.clear() })
  it('stores the variant from the url', () => {
    window.history.replaceState({}, '', '/?variant=b')
    render(<App />)
    expect(window.localStorage.getItem('ecp.costVariant')).toBe('b')
  })
  it('?variant=reset clears the stored variant', () => {
    window.localStorage.setItem('ecp.costVariant', 'a')
    window.history.replaceState({}, '', '/?variant=reset')
    render(<App />)
    expect(window.localStorage.getItem('ecp.costVariant')).toBeNull()
  })
})
