import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { COUNTRIES } from '../src/countries.ts'
import { studyUrl } from '../src/records/link.ts'
test.setTimeout(120000)

test('the address bar follows edits, replay and camera without Copy, and reload restores it paused', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let release!: () => void
  const loadingGate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/nodes-000-*', async route => { await loadingGate; await route.continue() })
  await page.goto('./')
  const parameters = () => page.evaluate(() => JSON.parse(new URLSearchParams(location.hash.slice(1)).get('study')!))
  await expect.poll(parameters).toMatchObject({ country: 'ch', dataset: COUNTRIES[0].identity, progress: 0 })
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'loading')
  release()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  const historyLength = await page.evaluate(() => history.length)
  await expect.poll(async () => (await parameters()).progress).toBeGreaterThan(0)
  const playingFrame = (await parameters()).progress
  await expect.poll(async () => (await parameters()).progress).toBeGreaterThan(playingFrame)
  await page.getByRole('combobox', { name: 'Start place' }).selectOption('Basel')
  await expect.poll(async () => (await parameters()).start.name).toBe('Basel')
  expect((await parameters()).progress).toBe(0)
  await page.getByRole('combobox', { name: 'Search algorithm' }).selectOption('astar')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'astar/1', { timeout: 45000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('combobox', { name: 'Replay duration' }).selectOption('15')
  await page.getByRole('slider', { name: 'Search replay' }).fill('7.5')
  await page.getByRole('button', { name: 'Show border and lake outlines' }).click()
  await expect.poll(parameters).toMatchObject({ algorithm: 'astar', duration: 15, progress: .5, outlines: false, start: { name: 'Basel' }, dataset: COUNTRIES[0].identity })
  const beforeView = (await parameters()).view
  const bounds = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * .45)
  // Playwright cannot send a native wheel in mobile WebKit; exercise the same
  // DOM handler there, then use real pointer input for the pan in both engines.
  if (isMobile) await page.locator('canvas').dispatchEvent('wheel', { deltaY: -300, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height * .45 })
  else await page.mouse.wheel(0, -300)
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height * .45 + 20); await page.mouse.up()
  await expect.poll(async () => (await parameters()).view.zoom).toBeGreaterThan(1)
  await expect.poll(async () => (await parameters()).view.x).not.toBe(beforeView.x)
  const shared = await parameters()
  expect(await page.evaluate(() => history.length)).toBe(historyLength)
  await page.reload()
  await expect(page.locator('.study')).toHaveAttribute('data-progress', '0.5', { timeout: 45000 })
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveAttribute('data-view', JSON.stringify(shared.view))
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'astar/1')
  await expect(page.getByRole('combobox', { name: 'Start place' })).toHaveValue('Basel')
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Show whole network' }).click()
  await expect.poll(async () => (await parameters()).view.zoom).toBe(1)
  expect(errors).toEqual([])
})

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
  expect(record.search.dataset.identity).toBe(COUNTRIES[0].identity); expect(record.search.routeMetres).toBeGreaterThan(0)
  expect(record.buffers.trace.count).toBe(Number(await page.locator('canvas').getAttribute('data-total-events'))); expect(record.presentation.progress).toBe(.5); expect(record.licence).toBe('ODbL-1.0')
  await page.goto(link.split('#')[0]); await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await page.evaluate(url => {
    const previous = location.href
    location.hash = new URL(url).hash
    // Reproduce a pending replay URL write before the hashchange is delivered.
    history.replaceState(history.state, '', previous)
  }, link)
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
