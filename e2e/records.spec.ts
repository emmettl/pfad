import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { COUNTRIES } from '../src/countries.ts'
import { readStudyLink, studyUrl } from '../src/records/link.ts'
test.setTimeout(120000)

test('native URL follows journey and camera edits, stays fixed during replay, and reloads with autoplay', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let release!: () => void
  const loadingGate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/nodes-000-*', async route => { await loadingGate; await route.continue() })
  await page.goto('./')
  const parameters = async () => readStudyLink(await page.evaluate(() => location.href)).study!
  await expect.poll(parameters).toMatchObject({ country: 'ch', dataset: COUNTRIES[0].identity, progress: 0 })
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'loading')
  release()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  const historyLength = await page.evaluate(() => history.length)
  const playingUrl = page.url()
  expect(new URL(playingUrl).search).toBe('?from=zurich&to=geneve')
  const playingFrame = Number(await page.locator('.study').getAttribute('data-progress'))
  await expect.poll(async () => Number(await page.locator('.study').getAttribute('data-progress'))).toBeGreaterThan(playingFrame)
  expect(page.url()).toBe(playingUrl)
  await page.getByRole('combobox', { name: 'Start place' }).selectOption('Basel')
  await expect.poll(async () => (await parameters()).start.name).toBe('Basel')
  expect((await parameters()).progress).toBe(0)
  await page.getByRole('combobox', { name: 'Search algorithm' }).selectOption('astar')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'astar/1', { timeout: 45000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('combobox', { name: 'Replay duration' }).selectOption('15')
  await page.getByRole('slider', { name: 'Search replay' }).fill('7.5')
  await page.getByRole('button', { name: 'Show border and lake outlines' }).click()
  await expect.poll(parameters).toMatchObject({ algorithm: 'astar', duration: 15, progress: 0, outlines: false, start: { name: 'Basel' }, dataset: COUNTRIES[0].identity })
  const beforeView = (await parameters()).view ?? { x: 0, y: 0, zoom: 1 }
  const renderedView = async () => {
    const view = JSON.parse((await page.locator('canvas').getAttribute('data-view'))!)
    return { x: Number(view.x.toFixed(6)), y: Number(view.y.toFixed(6)), zoom: Number(view.zoom.toFixed(6)) }
  }
  const bounds = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * .45)
  // Playwright cannot send a native wheel in mobile WebKit; exercise the same
  // DOM handler there, then use real pointer input for the pan in both engines.
  if (isMobile) await page.locator('canvas').dispatchEvent('wheel', { deltaY: -300, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height * .45 })
  else await page.mouse.wheel(0, -300)
  await expect.poll(async () => (await renderedView()).zoom).toBeGreaterThan(beforeView.zoom)
  const zoomedView = await renderedView()
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height * .45 + 20); await page.mouse.up()
  await expect.poll(async () => (await renderedView()).x).toBeLessThan(zoomedView.x)
  // The URL writes at most twice a second. Wait for the pan, not only the
  // earlier zoom, to be represented before reloading the shared study.
  await expect.poll(async () => (await parameters()).view).toEqual(await renderedView())
  const shared = await parameters()
  expect(await page.evaluate(() => history.length)).toBe(historyLength)
  await page.reload()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  const openingFrame = Number(await page.locator('.study').getAttribute('data-progress'))
  expect(openingFrame).toBeLessThan(.5)
  await expect.poll(async () => Number(await page.locator('.study').getAttribute('data-progress'))).toBeGreaterThan(openingFrame)
  await expect(page.locator('canvas')).toHaveAttribute('data-view', JSON.stringify(shared.view))
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'astar/1')
  await expect(page.getByRole('combobox', { name: 'Start place' })).toHaveValue('Basel')
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Show whole network' }).click()
  await expect.poll(async () => (await parameters()).view).toBeUndefined()
  expect(errors).toEqual([])
})

test('shared journeys autoplay, legacy frames resume, reduced motion shows the result, and exports retain genuine events', async ({ page }) => {
  const musicRequests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.m4a')) musicRequests.push(request.url()) })
  await page.goto('./'); await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('slider', { name: 'Search replay' }).fill('15')
  await page.getByRole('button', { name: 'Show border and lake outlines' }).click()
  await page.getByText('About this study', { exact: true }).click()
  await page.getByRole('button', { name: 'Copy study link' }).click()
  const link = await page.getByRole('textbox', { name: 'Study link' }).inputValue()
  expect(new URL(link).search).toBe('?from=zurich&to=geneve&outlines=0')
  expect(new URL(link).hash).toBe('')
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export search record' }).click()
  const file = await download, bytes = gunzipSync(await readFile((await file.path())!))
  expect(bytes.subarray(0, 8).toString()).toBe('PFADREC1')
  const length = bytes.readUInt32LE(8), record = JSON.parse(bytes.subarray(12, 12 + length).toString())
  expect(record.search.dataset.identity).toBe(COUNTRIES[0].identity); expect(record.search.routeMetres).toBeGreaterThan(0)
  expect(record.buffers.trace.count).toBe(Number(await page.locator('canvas').getAttribute('data-total-events'))); expect(record.presentation.progress).toBe(.5); expect(record.licence).toBe('ODbL-1.0')
  await page.goto(link); await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(async () => Number(await page.locator('.study').getAttribute('data-progress'))).toBeGreaterThan(0)
  expect(Number(await page.locator('.study').getAttribute('data-progress'))).toBeLessThan(.5)
  expect(page.url()).toBe(link)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  // Exercise actual same-document back/forward, not just a fresh page load.
  await page.evaluate(() => history.pushState(history.state, '', '?from=basel&to=geneve&algorithm=astar'))
  await page.goBack(); await page.goForward()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await expect(page.getByRole('combobox', { name: 'Start place' })).toHaveValue('Basel')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'astar/1')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const legacy = new URL(link)
  legacy.hash = new URLSearchParams({ study: JSON.stringify(record.presentation) }).toString()
  await page.evaluate(url => {
    const previous = location.href
    location.hash = new URL(url).hash
    // Reproduce a pending view URL write before the hashchange is delivered.
    history.replaceState(history.state, '', previous)
  }, legacy.href)
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'dijkstra/1', { timeout: 45000 })
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect.poll(async () => Number(await page.locator('.study').getAttribute('data-progress'))).toBeGreaterThanOrEqual(.5)
  expect(Number(await page.locator('.study').getAttribute('data-progress'))).toBeLessThan(.75)
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase', 'off')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(link)
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await expect(page.locator('.study')).toHaveAttribute('data-progress', '1')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveAttribute('data-route-phase', 'complete')
  expect(page.url()).toBe(link)
  expect(musicRequests).toEqual([])
})

test('unavailable releases are explicit errors, and a UK link asks before any graph download', async ({ page }) => {
  const graphRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/data/pfad/') || request.url().includes('/pfad-data/')) graphRequests.push(request.url()) })
  const record = { schema: 'pfad-study-link/1' as const, country: 'ch', dataset: 'a'.repeat(64), profile: 'road-connectivity-distance-v1', start: COUNTRIES[0].places[0], goal: COUNTRIES[0].places[1], algorithm: 'dijkstra' as const, duration: 30, progress: 1, outlines: true }
  const base = new URL('./', test.info().project.use.baseURL).href
  await page.goto(base + '#study=' + encodeURIComponent(JSON.stringify(record))); await expect(page.getByRole('alert')).toContainText('exact road release')
  expect(graphRequests).toEqual([])
  const uk = COUNTRIES[1]
  await page.goto(studyUrl(base, { ...record, country: 'uk', dataset: uk.identity, start: uk.places[0], goal: uk.places[1], outlines: false }))
  await expect(page.getByRole('dialog')).toContainText('93 MB'); expect(graphRequests).toEqual([])
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  expect(graphRequests.every(url => url.includes('/data/pfad/ch-') || url.includes('/pfad-data/geo-ch-'))).toBe(true)
})
