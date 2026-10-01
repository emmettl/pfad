// Exercise the reported national replay in the production app and observe worker
// lifetimes. Desktop WebKit checks behaviour; it does not reproduce iOS jetsam.
import { preview } from 'vite'
import { webkit, expect } from '@playwright/test'
import { dirname } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

const base = process.argv[2]
const output = process.argv[3] ?? '.cache/mobile-memory/phone-proof.json'
const server = base ? null : await preview({ build: { outDir: process.env.PFAD_PROOF_DIST ?? 'dist' }, preview: { host: '127.0.0.1', port: 4199, strictPort: true } })
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
const errors = [], analyticsErrors = []
page.on('pageerror', error => (error.message.includes('cloudflareinsights.com/cdn-cgi/rum') ? analyticsErrors : errors).push(error.message))
await page.addInitScript(() => {
  localStorage.setItem('pfad-country-warning:de', '1')
  const NativeWorker = window.Worker
  window.memoryProof = { workers: [], results: [] }
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args)
      const record = { terminated: false, requests: [], geometryChunks: 0 }
      this.record = record; window.memoryProof.workers.push(record)
      this.addEventListener('message', ({ data }) => {
        if (data.type === 'geometry') record.geometryChunks++
        if (data.type === 'ready') record.loading = data.measurements
        if (data.type === 'result') {
          const r = data.result
          const result = { algorithm: r.algorithm, routeMetres: r.routeMetres, events: r.trace.length, drawingVertices: document.querySelector('canvas')?.dataset.roadVertices }
          window.memoryProof.results.push(result)
          crypto.subtle.digest('SHA-256', r.trace).then(hash => { result.traceSha256 = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('') })
        }
      })
    }
    postMessage(request, ...args) { this.record.requests.push({ type: request.type, topologyOnly: request.topologyOnly, roadUploads: document.querySelector('canvas')?.dataset.roadUploads }); super.postMessage(request, ...args) }
    terminate() { this.record.terminated = true; super.terminate() }
  }
})
try {
  await page.goto(new URL('?country=de&from=berlin&to=munich&algorithm=bidirectional&duration=15', base || 'http://127.0.0.1:4199/').href)
  const ready = async algorithm => {
    await expect(page.locator('.study')).toHaveAttribute('data-algorithm', algorithm, { timeout: 180000 })
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeEnabled({ timeout: 180000 })
    await expect(page.locator('canvas')).toHaveAttribute('data-road-vertices', '32951556')
    await expect(page.locator('canvas')).toHaveAttribute('data-road-uploads', 'resident')
    const workers = await page.evaluate(() => window.memoryProof.workers)
    if (workers.some(worker => !worker.terminated)) throw Error('A national routing worker remains alive during replay')
    const pause = page.getByRole('button', { name: 'Pause', exact: true })
    if (await pause.isVisible()) await pause.click()
    await page.getByRole('slider', { name: 'Search replay' }).fill('0')
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.locator('.route-caption em')).toBeVisible({ timeout: 25000 })
    await page.getByRole('slider', { name: 'Search replay' }).fill('7.5')
    await page.getByRole('slider', { name: 'Search replay' }).fill('15')
    await expect(page.locator('.route-caption em')).toBeVisible()
  }
  await ready('bidirectional-dijkstra/1')
  await page.getByRole('combobox', { name: 'Search algorithm' }).selectOption('astar')
  await ready('astar/1')
  await page.getByRole('combobox', { name: 'Search algorithm' }).selectOption('bidirectional')
  await ready('bidirectional-dijkstra/1')
  await expect.poll(() => page.evaluate(() => window.memoryProof.results.every(result => result.traceSha256))).toBe(true)
  const proof = await page.evaluate(() => window.memoryProof)
  if (proof.results[0].traceSha256 !== proof.results[2].traceSha256) throw Error('Repeated bidirectional trace changed')
  if (proof.results.some(result => result.routeMetres !== proof.results[0].routeMetres)) throw Error('Route costs differ')
  if (proof.workers.length !== 3 || proof.workers[0].requests[0].topologyOnly || proof.workers.slice(1).some(worker => !worker.requests[0].topologyOnly)) throw Error('Worker reload did not preserve the existing drawing')
  if (proof.workers.some(worker => worker.requests.find(request => request.type === 'search').roadUploads !== 'deferred')) throw Error('Road GPU uploads overlap a national search')
  if (proof.workers.slice(1).some(worker => worker.geometryChunks !== 0 || worker.loading.networkBytes !== 0)) throw Error('Topology reload redownloaded cached data or duplicated drawing')
  if (errors.length) throw Error(errors.join('; '))
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(), url: page.url(), note: 'Desktop WebKit touch viewport, not a physical iPhone or a measurement of process peak memory.', ...proof, errors, analyticsErrors }, null, 2) + '\n')
  console.log(JSON.stringify(proof))
} finally { await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve)) }
