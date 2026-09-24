import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import WallSection from './WallSection'
import { buildFoundationLayers, FOUNDATION_DEFAULTS } from './BelowGradeWallBuilder'
import { calculateBelowGradeAssembly } from '../data/ecpData'

// Foundation mode consumes the layer list that BelowGradeWallBuilder builds, so the tests use
// the real builder output rather than a hand-typed shape.
const layersFor = sel => buildFoundationLayers(sel, calculateBelowGradeAssembly(sel))

const textsIn = container => Array.from(container.querySelectorAll('svg text')).map(t => t.textContent.trim())

function expectOneTextPerLayer(container, layers) {
  const texts = textsIn(container)
  const wanted = layers.map(l => l.label)
  for (const label of new Set(wanted)) {
    const expected = wanted.filter(w => w === label).length
    expect(texts.filter(t => t === label), `label "${label}"`).toHaveLength(expected)
  }
  expect(texts).toContain('soil (not counted)')
  expect(texts).toContain('INTERIOR')
  expect(texts).toContain('EXTERIOR')
}

describe('WallSection foundation mode', () => {
  it('concrete + exterior foam + interior foam + stud wall + gypsum: one label per layer, soil hatched at the bottom', () => {
    const sel = {
      ...FOUNDATION_DEFAULTS.concrete,
      extInsType: 'XPS', extInsThickness: '2"',
      intInsType: 'EPS', intInsThickness: '1"',
    }
    const layers = layersFor(sel)
    expect(layers.map(l => l.kind)).toEqual(['soil', 'ext_ins', 'concrete', 'int_ins', 'frame', 'gypsum'])

    const { container } = render(<WallSection wallType="foundation" foundationLayers={layers} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expectOneTextPerLayer(container, layers)

    // Drawing order is inside at the top: the gypsum rect sits above the soil rect.
    const rects = Array.from(svg.querySelectorAll('rect'))
    const gypsum = rects.find(r => r.getAttribute('fill') === '#e5e7eb')
    const soil = rects.find(r => (r.getAttribute('fill') || '').startsWith('url(#foundation-soil-hatch)'))
    expect(gypsum).toBeTruthy()
    expect(soil).toBeTruthy()
    expect(Number(gypsum.getAttribute('y'))).toBeLessThan(Number(soil.getAttribute('y')))

    // Studs at 16" o.c. draw a dimension line; total thickness 2+2+8+1+5.5+0.5 = 19" at 10 px/in.
    expect(textsIn(container)).toContain('16" o.c.')
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${24 * 10 + 280} ${19 * 10 + 80}`)
  })

  it('ICF: foam / concrete core / foam / gypsum, two texts for the two identical form labels', () => {
    const layers = layersFor({ foundationType: 'icf', icfFormThickness: '2-1/2"', finish: 'gypsum' })
    expect(layers.map(l => l.kind)).toEqual(['soil', 'icf_foam', 'concrete', 'icf_foam', 'gypsum'])
    const { container } = render(<WallSection wallType="foundation" foundationLayers={layers} />)
    expectOneTextPerLayer(container, layers)
    // No stud wall, so no spacing dimension.
    expect(textsIn(container).some(t => /o\.c\./.test(t))).toBe(false)
  })

  it('PWF: sheathing / studs / gypsum with the 2x8 R28 batt', () => {
    const layers = layersFor(FOUNDATION_DEFAULTS.pwf)
    expect(layers.map(l => l.kind)).toEqual(['soil', 'sheathing', 'frame', 'gypsum'])
    const { container } = render(<WallSection wallType="foundation" foundationLayers={layers} />)
    expectOneTextPerLayer(container, layers)
    expect(textsIn(container)).toContain('16" o.c.')
    // Batt pattern present (clip paths are only emitted with the batt pattern).
    expect(container.querySelectorAll('clipPath').length).toBeGreaterThan(0)
  })

  it('block: draws block units with cores; an empty cavity draws studs without the batt pattern', () => {
    const layers = layersFor({ ...FOUNDATION_DEFAULTS.block, cavityMaterial: 'None (empty)', cavityType: undefined, studDepth: '2x4' })
    expect(layers.map(l => l.kind)).toEqual(['soil', 'block', 'frame', 'gypsum'])
    const { container } = render(<WallSection wallType="foundation" foundationLayers={layers} />)
    expectOneTextPerLayer(container, layers)
    expect(container.querySelectorAll('clipPath').length).toBe(0)
    expect(container.querySelectorAll('rect[rx="2"]').length).toBeGreaterThan(0)
  })

  it('renders an empty svg, not a crash, when the layer list is missing', () => {
    const { container } = render(<WallSection wallType="foundation" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(textsIn(container)).toEqual(['INTERIOR', 'EXTERIOR'])
  })

  it('wood mode still renders the above-ground drawing', () => {
    const { container } = render(
      <WallSection wallType="wood" studDepth="2x6" studSpacing={16} continuousIns={1.5}
        cavityInsLabel="2x6 R20" continuousInsLabel={'1-1/2" XPS'} />
    )
    const texts = textsIn(container)
    expect(texts).toContain('2x6 R20')
    expect(texts).toContain('1-1/2" XPS')
    expect(texts).toContain('16" o.c.')
    expect(texts).not.toContain('soil (not counted)')
  })
})
