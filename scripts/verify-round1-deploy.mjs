// Verifies the deployed dev site for round 1: variants A/B figures, persistence across reload, reset to C.
// Usage: node scripts/verify-round1-deploy.mjs [baseUrl] [outDir]
//   env PLAYWRIGHT_DIR overrides the Playwright module path; CHROME_PATH the browser executable.
// Prints PASS, or the first failing assertion (exit 1).
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_DIR || `${process.env.HOME}/.npm/_npx/9833c18b2d85bc59/node_modules/playwright`)

const BASE = (process.argv[2] || 'https://ecp-dev.up.railway.app').replace(/\/$/, '')
const OUT = process.argv[3] || process.env.OUT_DIR || path.join(process.cwd(), 'round1-shots')
const house = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/costing/data/round1-test-house.json'), 'utf8'))
const WALL = house.lines.aboveGroundWalls
const DESIGN = `$${WALL.designPerSqFt.toFixed(2)}`
const BASELINE = `$${WALL.baselinePerSqFt.toFixed(2)}`
const VERSION = 'v1.9.0-round1-variants'
const SECOND_LINE = house.secondLine
mkdirSync(OUT, { recursive: true })

const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`) }

async function pickHouse(page) {
  await page.getByRole('button', { name: 'Select RSI' }).first().click()
  await page.getByRole('button', { name: /4\.73/ }).first().click()
  await page.getByRole('button', { name: /≤ 1\.22/ }).first().click()
  await page.getByRole('button', { name: /≥ 2\.35/ }).first().click()
}
async function openWalls(page) {
  await page.getByRole('tab', { name: 'Cost' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Above-ground walls/ }).first().click()
  await page.waitForTimeout(400)
}
const perSqFtRows = (page, v) =>
  page.locator(`[data-testid="variant-${v}-aboveGroundWalls"] tr`).filter({ has: page.locator('td:first-child', { hasText: /^Per sq ft installed$/ }) })

async function checkFigures(page, v, shot) {
  const table = page.locator(`[data-testid="variant-${v}-aboveGroundWalls"]`)
  await table.waitFor({ timeout: 10000 })
  const rows = perSqFtRows(page, v)
  const n = await rows.count()
  assert(n === 1, `variant ${v}: expected exactly 1 "Per sq ft installed" row, found ${n}`)
  const cells = await rows.first().locator('td').allInnerTexts()
  assert(cells[1].trim() === DESIGN, `variant ${v}: design per sq ft is ${cells[1]}, JSON says ${DESIGN}`)
  assert(cells[2].trim() === BASELINE, `variant ${v}: baseline per sq ft is ${cells[2]}, JSON says ${BASELINE}`)
  if (v === 'b') {
    const inFooter = await table.locator('tfoot tr').filter({ hasText: 'Per sq ft installed' }).count()
    assert(inFooter === 1, 'variant b: "Per sq ft installed" row is not in the footer')
  } else {
    const inFooter = await table.locator('tfoot tr').filter({ hasText: 'Per sq ft installed' }).count()
    assert(inFooter === 0, 'variant a: "Per sq ft installed" row should be in the body, not the footer')
  }
  if (shot) await page.locator('.line-detail').first().screenshot({ path: path.join(OUT, shot) })
}
async function checkCopy(page) {
  const body = await page.evaluate(() => document.body.innerText)
  assert(body.includes(VERSION), `footer does not contain ${VERSION}`)
  const second = await page.locator('.costing-note').filter({ hasText: SECOND_LINE.slice(0, 30) }).first().innerText()
  assert(second.trim().startsWith(SECOND_LINE), `Cost tab second line is "${second}", expected to start with SECOND_LINE`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' })
try {
  const health = await fetch(`${BASE}/api/health`)
  assert(health.status === 200, `/api/health returned ${health.status}`)

  // B, then reload without the parameter in the same context
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const pb = await ctxB.newPage()
  await pb.goto(`${BASE}/?variant=b`); await pb.waitForTimeout(1000)
  await pickHouse(pb); await openWalls(pb)
  await checkFigures(pb, 'b', 'deploy-wall-b.png')
  await checkCopy(pb)
  await pb.goto(`${BASE}/`); await pb.waitForTimeout(1000)
  await pickHouse(pb); await openWalls(pb)
  await checkFigures(pb, 'b')
  await ctxB.close()

  // A in a fresh context
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const pa = await ctxA.newPage()
  await pa.goto(`${BASE}/?variant=a`); await pa.waitForTimeout(1000)
  await pickHouse(pa); await openWalls(pa)
  await checkFigures(pa, 'a', 'deploy-wall-a.png')
  await ctxA.close()

  // reset -> C
  const ctxC = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const pc = await ctxC.newPage()
  await pc.goto(`${BASE}/?variant=reset`); await pc.waitForTimeout(800)
  await pc.goto(`${BASE}/`); await pc.waitForTimeout(1000)
  await pickHouse(pc); await openWalls(pc)
  assert(await pc.getByRole('button', { name: /Layers/ }).count() > 0, 'after reset, no Layers button (not variant C)')
  await ctxC.close()

  console.log('PASS')
} catch (e) {
  console.log(e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
