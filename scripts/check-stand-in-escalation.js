// Checks a stand-in-costs.json built with STAND_IN_ESCALATION against the factors file and the HTAP rows.
// Run: node scripts/check-stand-in-escalation.js <stand-in-costs.json> <factors.json> <htap.json>
import fs from 'node:fs'

const SQFT_PER_M2 = 10.76391042
const TOL = 0.01
const REGION_SOURCES = { ON: ['LEEP-ON-Ottawa'], MB: ['LEEP-MB-Winnipeg'], BC: ['LEEP-BC-Vancouver', 'LEEP-BC-KamloopsChesnut'] }
const [outPath, factorsPath, htapPath] = process.argv.slice(2)
if (!outPath || !factorsPath || !htapPath) { console.error('usage: check-stand-in-escalation.js <stand-in-costs.json> <factors.json> <htap.json>'); process.exit(1) }
const load = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const out = load(outPath), factors = load(factorsPath), htap = load(htapPath).rows
const fail = msg => { console.error(`FAIL: ${msg}`); process.exit(1) }
// priced_item names the first row used; the build's median also takes same-item rows whose description adds ' - <note>' (e.g. ' - Hanscomb').
const label = r => `${r.component}/${r.option} (${r.priced_item})`

let leep = 0, derived = 0
for (const r of out) {
  if (r.source.startsWith('LEEP')) {
    if (r.escalated !== true) fail(`LEEP row lacks escalated: ${label(r)}`)
    leep++
    const sources = r.source.replace(/^LEEP\s*/, '').split('/').flatMap(g => REGION_SOURCES[g] || fail(`unknown region ${g} in ${label(r)}`))
    const hits = htap.filter(h => (h.description === r.priced_item || h.description.startsWith(`${r.priced_item} - `)) && sources.includes(h.source))
    const fs_ = hits.map(h => factors.find(f => f.source === h.source && f.description === h.description))
    if (!hits.length || fs_.some(f => !f)) fail(`no factor rows for ${label(r)} in ${sources.join(', ')}`)
    for (const k of ['material', 'labour']) {
      const vals = fs_.map(f => f[`${k}_escalated`])
      if (vals.some(v => typeof v !== 'number')) fail(`null escalated ${k} for ${label(r)}`)
      const v = r[k] / SQFT_PER_M2, lo = Math.min(...vals), hi = Math.max(...vals)
      if (v < lo - TOL || v > hi + TOL) fail(`${k} ${v.toFixed(4)} $/sf outside escalated range ${lo}..${hi} for ${label(r)}`)
    }
  } else if (r.escalated === true) derived++
}
console.log(`checked ${leep} LEEP rows, ${derived} derived rows flagged, PASS`)
