import fs from 'node:fs'
import path from 'node:path'

// Spec rev 3 section 7: each --viz-* text colour is at least 4.5:1 on the card background, light and dark.
const css = fs.readFileSync(path.join(__dirname, 'App.css'), 'utf8')
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const tokens = selector => {
  const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*--viz-design[^}]*\\}`))
  expect(block, `${selector} block with --viz-design`).not.toBeNull()
  return Object.fromEntries([...block[0].matchAll(/--(viz-[a-z]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]))
}

describe('data-viz colours', () => {
  it('light: design, baseline and more pass on white', () => {
    const t = tokens(':root')
    for (const k of ['viz-design', 'viz-baseline', 'viz-more']) expect(ratio(t[k], '#ffffff'), k).toBeGreaterThanOrEqual(4.5)
  })
  it('dark: design, baseline and more pass on the dark card', () => {
    const t = tokens('.dark')
    for (const k of ['viz-design', 'viz-baseline', 'viz-more']) expect(ratio(t[k], '#1f2937'), k).toBeGreaterThanOrEqual(4.5)
  })
})
