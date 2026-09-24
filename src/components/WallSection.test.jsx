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
const clipIdsIn = container => Array.from(container.querySelectorAll('clipPath')).map(c => c.getAttribute('id'))
// Same formula as the component: 4.8 px per character of the longest label, 200 px floor.
const labelBudget = layers => Math.max(200, Math.ceil(Math.max(...layers.map(l => l.label.length)) * 4.8))

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
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${24 * 10 + 100 + labelBudget(layers)} ${19 * 10 + 80}`)
  })

  it('ICF: foam / concrete core / foam / gypsum, the two form bands say which side they are', () => {
    const layers = layersFor({ foundationType: 'icf', icfFormThickness: '2-1/2"', finish: 'gypsum' })
    expect(layers.map(l => l.kind)).toEqual(['soil', 'icf_foam', 'concrete', 'icf_foam', 'gypsum'])
    expect(layers.map(l => l.label)).toEqual(expect.arrayContaining(['2-1/2" EPS form (exterior)', '2-1/2" EPS form (interior)']))
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

  it('block: units with cores clipped to the wall; an empty cavity is light grey with no batt pattern', () => {
    const layers = layersFor({ ...FOUNDATION_DEFAULTS.block, cavityMaterial: 'None (empty)', cavityType: undefined, studDepth: '2x4' })
    expect(layers.map(l => l.kind)).toEqual(['soil', 'block', 'frame', 'gypsum'])
    const { container } = render(<WallSection wallType="foundation" foundationLayers={layers} />)
    expectOneTextPerLayer(container, layers)
    // No batt clip paths; exactly one clip path, the block one, and the units sit inside it.
    expect(clipIdsIn(container)).toEqual([expect.stringMatching(/^fd-block-clip-/)])
    const clipped = container.querySelector('g[clip-path]')
    expect(clipped).toBeTruthy()
    expect(clipped.querySelectorAll('rect[rx="2"]').length).toBeGreaterThan(0)
    // Empty cavity: the cavity rect is not insulation pink.
    const cavityFills = Array.from(container.querySelectorAll('rect')).map(r => r.getAttribute('fill'))
    expect(cavityFills).toContain('#f9fafb')
    expect(cavityFills).not.toContain('#fce7f3')
  })

  it('block at 24" o.c.: every block unit and core is inside the clip group, none painted over the labels', () => {
    const layers = layersFor({ ...FOUNDATION_DEFAULTS.block, blockType: 'medium_vermiculite', studSpacing: '24"' })
    const { container } = render(<WallSection wallType="foundation" foundationLayers={layers} />)
    const svg = container.querySelector('svg')
    const wallWidthPx = 24 * 1.5 * 10
    const outsideClip = Array.from(svg.querySelectorAll('rect'))
      .filter(r => !r.closest('g[clip-path]') && !r.closest('clipPath'))
      .filter(r => Number(r.getAttribute('x')) + Number(r.getAttribute('width')) > wallWidthPx + 0.5)
    expect(outsideClip).toHaveLength(0)
    // Longest label gets a wider viewBox than the 200 px floor.
    const longest = 'Medium-weight block (190 mm), cores filled with vermiculite'
    expect(layers.map(l => l.label)).toContain(longest)
    expect(labelBudget(layers)).toBeGreaterThan(200)
    expect(svg.getAttribute('viewBox').split(' ')[2]).toBe(String(wallWidthPx + 100 + labelBudget(layers)))
  })

  it('clip-path ids never collide with the above-ground drawing on the same page', () => {
    const fd = render(<WallSection wallType="foundation" foundationLayers={layersFor(FOUNDATION_DEFAULTS.concrete)} />)
    const wood = render(<WallSection wallType="wood" studDepth="2x4" studSpacing={16} cavityInsLabel="2x4 R14" />)
    const fdIds = clipIdsIn(fd.container)
    const woodIds = clipIdsIn(wood.container)
    expect(fdIds.length).toBeGreaterThan(0)
    expect(woodIds.length).toBeGreaterThan(0)
    expect(fdIds.every(id => id.startsWith('fd-'))).toBe(true)
    expect(fdIds.filter(id => woodIds.includes(id))).toEqual([])
    // Both frame layers start at y = 35, so without the prefix the ids would be identical.
    expect(woodIds).toContain('cavity-clip-15-35')
    expect(fdIds).toContain('fd-cavity-clip-15-35')
  })

  it('held-off 2x6 R20 draws an air gap band between the studs and the concrete, and its label fits', () => {
    for (const spacing of ['16"', '19"', '24"']) {
      const sel = { ...FOUNDATION_DEFAULTS.concrete, cavityType: '2x6 R20', studOffset: true, studSpacing: spacing }
      const layers = layersFor(sel)
      expect(layers.map(l => l.kind)).toEqual(['soil', 'concrete', 'air_gap', 'frame', 'gypsum'])
      expect(layers.find(l => l.kind === 'frame').label).toMatch(/held off the wall/)
      const { container, unmount } = render(<WallSection wallType="foundation" foundationLayers={layers} />)
      expectOneTextPerLayer(container, layers)
      expect(textsIn(container)).toContain('air gap (not counted)')
      const gap = Array.from(container.querySelectorAll('rect')).find(r => r.getAttribute('stroke-dasharray') === '3 2')
      expect(gap).toBeTruthy()
      expect(gap.getAttribute('fill')).toBe('#fff')
      // Label column budget follows the longest label (the held-off frame label, 51 chars).
      const w = Number(container.querySelector('svg').getAttribute('viewBox').split(' ')[2])
      expect(w).toBe(parseInt(spacing, 10) * 1.5 * 10 + 100 + labelBudget(layers))
      unmount()
    }
    // Without the offset there is no air gap.
    expect(layersFor({ ...FOUNDATION_DEFAULTS.concrete, cavityType: '2x6 R20' }).map(l => l.kind)).toEqual(['soil', 'concrete', 'frame', 'gypsum'])
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
