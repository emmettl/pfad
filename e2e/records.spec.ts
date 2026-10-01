import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { COUNTRIES } from '../src/countries.ts'
import { studyUrl } from '../src/records/link.ts'
test.setTimeout(120000)

test('a share link restores the exact paused study, and export contains its genuine events', async ({ page }) => {
  await page.goto('./'); await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('slider', { name: 'Search replay' }).fill('15')
  await page.getByRole('button', { name: 'Show border and lake outlines' }).click()
  await page.getByText('About this study', { exact: true }).click()
  await page.getByRole('button', { name: 'Copy study link' }).click()
  const link = await page.getByRole('textbox', { name: 'Study link' }).inputValue()
  const state = JSON.parse(new URLSearchParams(new URL(link).hash.slice(1)).get('study')!)
  expect(state.dataset).toBe(COUNTRIES[0].identity); expect(state.progress).toBe(.5); expect(state.outlines).toBe(false)
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export search record' }).click()
  const file = await download, bytes = gunzipSync(await readFile((await file.path())!))
  expect(bytes.subarray(0, 8).toString()).toBe('PFADREC1')
  const length = bytes.readUInt32LE(8), record = JSON.parse(bytes.subarray(12, 12 + length).toString())
  expect(record.search.dataset.identity).toBe(COUNTRIES[0].identity); expect(record.search.routeMetres).toBe(262733.98)
  expect(record.buffers.trace.count).toBe(4993816); expect(record.presentation.progress).toBe(.5); expect(record.licence).toBe('ODbL-1.0')
  await page.goto(link.split('#')[0]); await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await page.goto(link)
  await expect(page.locator('.study')).toHaveAttribute('data-progress', '0.5', { timeout: 45000 })
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase', 'off')
})

test('unavailable releases are explicit errors, and a UK link asks before any graph download', async ({ page }) => {
  const graphRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/data/pfad/') || request.url().includes('/pfad-data/')) graphRequests.push(request.url()) })
  const record = { schema: 'pfad-study-link/1' as const, country: 'ch', dataset: 'a'.repeat(64), profile: 'road-connectivity-distance-v1', start: COUNTRIES[0].places[0], goal: COUNTRIES[0].places[1], algorithm: 'dijkstra' as const, duration: 30, progress: 1, outlines: true }
  const base = new URL('./', test.info().project.use.baseURL).href
  await page.goto(studyUrl(base, record)); await expect(page.getByRole('alert')).toContainText('exact road release')
  expect(graphRequests).toEqual([])
  const uk = COUNTRIES[1]
  await page.goto(studyUrl(base, { ...record, country: 'uk', dataset: uk.identity, start: uk.places[0], goal: uk.places[1], outlines: false }))
  await expect(page.getByRole('dialog')).toContainText('93 MB'); expect(graphRequests).toEqual([])
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  expect(graphRequests.every(url => url.includes('/data/pfad/ch-'))).toBe(true)
})
