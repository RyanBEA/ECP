// Writes src/costing/data/stand-in-costs.json before a build when it is missing.
// The price table is gitignored (it holds LEEP rows), so hosted builds get it from the
// STAND_IN_COSTS_GZ_B64 environment variable: the JSON file, gzipped, then base64-encoded.
//   Make the value: gzip -9c src/costing/data/stand-in-costs.json | base64 -w0
// Locally the file already exists (npm run build:costs) and this script does nothing.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(here, '..', 'src', 'costing', 'data', 'stand-in-costs.json')

if (fs.existsSync(OUT)) process.exit(0)

const encoded = process.env.STAND_IN_COSTS_GZ_B64
if (!encoded) {
  console.error(`Missing ${path.relative(process.cwd(), OUT)} and STAND_IN_COSTS_GZ_B64 is not set.`)
  console.error('Run npm run build:costs locally, or set STAND_IN_COSTS_GZ_B64 on the host.')
  process.exit(1)
}

const json = zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8')
JSON.parse(json) // fail the build on a corrupt value rather than ship it
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, json)
console.log(`Wrote ${path.relative(process.cwd(), OUT)} from STAND_IN_COSTS_GZ_B64`)
