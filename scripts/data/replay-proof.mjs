import { chromium, webkit } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { cpus, platform } from 'node:os'

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4199', '--strictPort'], { stdio: 'ignore' })
for (let attempt = 0; attempt < 100; attempt++) {
  try { if ((await fetch('http://127.0.0.1:4199/')).ok) break } catch { /* Server is starting. */ }
  if (attempt === 99) { server.kill('SIGTERM'); throw new Error('Preview did not start') }
  await new Promise(resolve => setTimeout(resolve, 100))
}
const report = { measuredAt: new Date().toISOString(), host: { cpu: cpus()[0].model, platform: platform() }, note: 'Desktop-host browser measurements, local static serving. WebKit mobile viewport does not measure a physical phone. Frame intervals include rendering and main-thread UI. No total browser peak-memory claim.', browsers: [] }
try {
  for (const [name, engine, viewport, args] of [['chromium-default', chromium, { width: 1440, height: 900 }, []], ['chromium-metal', chromium, { width: 1440, height: 900 }, ['--use-angle=metal']], ['webkit-mobile-viewport', webkit, { width: 390, height: 844 }, []]]) {
    const browser = await engine.launch({ args })
    try {
      const page = await browser.newPage({ viewport })
      await page.addInitScript(() => {
        window.__pfadProof = null
        const NativeWorker = window.Worker
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args)
            this.addEventListener('message', ({ data }) => {
              if (data.type === 'result') {
                const r = data.result
                window.__pfadProof = { dataset: r.dataset, algorithm: r.algorithm, tieBreak: r.tieBreak, searchMs: r.searchMs, snapMs: r.snapMs, events: r.trace.length, traceBytes: r.trace.byteLength, edgeTextureBytes: r.edgeTimes.byteLength, nodesSettled: r.exploredNodes, arcsExamined: r.examinedArcs, routeMetres: r.routeMetres }
              }
            })
          }
        }
      })
      const begun = performance.now()
      await page.goto('http://127.0.0.1:4199/', { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => window.__pfadProof !== null, null, { timeout: 45000 })
      const readyMs = performance.now() - begun
      const frames = await page.evaluate(() => new Promise(resolve => {
        const intervals = []; let previous = performance.now()
        function sample(now) { intervals.push(now - previous); previous = now; if (intervals.length < 90) requestAnimationFrame(sample); else resolve(intervals) }
        requestAnimationFrame(sample)
      }))
      frames.sort((a, b) => a - b)
      const renderer = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) })
      const record = { name, renderer, readyMs, ...(await page.evaluate(() => window.__pfadProof)), frameIntervalMedianMs: frames[Math.floor(frames.length / 2)], frameIntervalP95Ms: frames[Math.floor(frames.length * .95)] }
      report.browsers.push(record); console.log(JSON.stringify(record))
    } finally { await browser.close() }
  }
} finally { server.kill('SIGTERM') }
await mkdir('docs/evidence/first-study-2026-09-30', { recursive: true })
await writeFile('docs/evidence/first-study-2026-09-30/replay-report.json', JSON.stringify(report, null, 2) + '\n')
