import { chromium, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { COUNTRIES } from '../src/countries.ts'
import { studyUrl } from '../src/records/link.ts'

// Manual artwork release: capture the production renderer, never invent roads
// or run this during build. Published graph bytes remain pinned and unchanged.
const base = process.argv[2] ?? 'http://127.0.0.1:4191/'
const country = COUNTRIES[0]
const study = { schema: 'pfad-study-link/1', country: country.id, dataset: country.identity,
  profile: 'road-connectivity-distance-v1', start: country.places[0], goal: country.places[1],
  algorithm: 'dijkstra', duration: 30, progress: 1, outlines: true }
const browser = await chromium.launch(process.platform === 'darwin' ? { args: ['--use-angle=metal'] } : {})
try {
  const context = await browser.newContext({ viewport: { width: 940, height: 560 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const Native = Worker
    window.Worker = class extends Native {
      constructor(...args) {
        super(...args)
        this.addEventListener('message', ({ data }) => {
          if (data.type !== 'result') return
          const r = data.result
          window.cardRecord = { dataset: r.dataset, algorithm: r.algorithm, tieBreak: r.tieBreak,
            snapping: r.snapping, start: r.start, goal: r.goal, routeMetres: r.routeMetres,
            events: r.trace.length, exploredNodes: r.exploredNodes, examinedArcs: r.examinedArcs }
        })
      }
    }
  })
  await page.goto(studyUrl(base, study))
  await expect(page.locator('.study')).toHaveAttribute('data-progress', '1', { timeout: 45000 })
  await expect(page.locator('canvas')).toHaveAttribute('data-route-phase', 'complete')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'dijkstra/1')
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '.study-header, .route-panel, .playback-panel, footer, .reset-view, .map-markers { display: none !important }' })
  const roads = await page.locator('canvas').screenshot()
  const record = await page.evaluate(() => window.cardRecord)
  const view = JSON.parse(await page.locator('canvas').getAttribute('data-view'))
  if (record.dataset.identity !== country.identity || record.routeMetres === null || errors.length) throw new Error('A verified completed study is required for the share artwork')

  // Resolve the public stylesheet and its declared assets rather than reaching
  // into unexported package paths. The same Latin faces produce the card text.
  const fontsUrl = new URL(import.meta.resolve('@motionstudies/web/fonts.css'))
  const fontFaces = [...(await readFile(fontsUrl, 'utf8')).matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match => match[1])
  async function fontData(family, weight) {
    const face = fontFaces.find(css => css.includes(`font-family: '${family}'`) && css.includes(`font-weight: ${weight};`) && css.includes('unicode-range: U+0000-00FF'))
    const asset = face?.match(/src:\s*url\(['"]([^'"]+)['"]\)/)?.[1]
    if (!asset) throw new Error(`Public Latin font face unavailable: ${family} ${weight}`)
    return (await readFile(new URL(asset, fontsUrl))).toString('base64')
  }
  const inter = await fontData('Inter', '400 600'), mono = await fontData('DM Mono', '400')
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter}) format('woff2'); font-weight: 400 600 }
    @font-face { font-family: Mono; src: url(data:font/woff2;base64,${mono}) format('woff2'); font-weight: 400 }
    * { box-sizing: border-box } body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #080d10; color: #d3eee2; font-family: Inter, sans-serif }
    .roads { position: absolute; left: 360px; top: 20px; width: 840px; height: 580px; object-fit: contain }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, #080d10 0%, #080d10 27%, #080d10cc 33%, #080d1000 46%) }
    .series { position: absolute; left: 58px; top: 54px; margin: 0; color: #91ab9d; font: 15px Mono, monospace; letter-spacing: 2.2px; text-transform: uppercase }
    h1 { position: absolute; left: 50px; top: 130px; margin: 0; font-size: 132px; font-weight: 400; line-height: 1; letter-spacing: -9px }
    h2 { position: absolute; left: 58px; top: 302px; margin: 0; font-size: 39px; font-weight: 400; line-height: 1.18; letter-spacing: -1.2px }
    .concept { position: absolute; left: 58px; top: 421px; margin: 0; color: #92aea0; font-size: 18px; line-height: 1.6 }
    .address { position: absolute; left: 58px; bottom: 44px; margin: 0; color: #a2bbad; font: 13px Mono, monospace }
    .journey { position: absolute; right: 46px; bottom: 64px; margin: 0; color: #a2bbad; font: 13px Mono, monospace }
    .credit { position: absolute; right: 46px; bottom: 38px; margin: 0; color: #728d7e; font: 10px Mono, monospace }
  </style></head><body>
    <img class="roads" alt="" src="data:image/png;base64,${roads.toString('base64')}"><div class="shade"></div>
    <p class="series">Motion Studies</p><h1>PFAD</h1><h2>The roads<br>not taken.</h2>
    <p class="concept">A study of time, space,<br>and the paths not taken.</p><p class="address">motionstudies.app/pfad</p>
    <p class="journey">Zürich → Genève · Dijkstra</p>
    <p class="credit">Roads © OpenStreetMap contributors · ODbL · Outlines © swisstopo, FOEN</p>
  </body></html>`)
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())) })
  const image = await page.screenshot(), sha256 = createHash('sha256').update(image).digest('hex')
  const imagePath = `share/pfad-${sha256.slice(0, 12)}.png`
  await mkdir('public/share', { recursive: true }); await writeFile(`public/${imagePath}`, image)
  const icon = await context.newPage()
  const favicon = (await readFile('public/favicon.svg')).toString('base64')
  await icon.setContent(`<style>*{margin:0}html,body,img{width:100%;height:100%;background:#080d10}</style><img src="data:image/svg+xml;base64,${favicon}">`)
  for (const [size, path] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png']]) {
    await icon.setViewportSize({ width: size, height: size }); await icon.screenshot({ path: `public/${path}` })
  }
  await mkdir('docs/evidence/sharing-2026-10-01', { recursive: true })
  await writeFile('docs/evidence/sharing-2026-10-01/social-card.json', JSON.stringify({ schema: 'pfad-social-card/1', generatedAt: new Date().toISOString(),
    image: { path: imagePath, width: 1200, height: 630, bytes: image.length, sha256 }, presentation: { ...study, view }, search: record,
    sources: { roads: '© OpenStreetMap contributors · ODbL-1.0', outlines: '© swisstopo, FOEN', fonts: '@motionstudies/web pinned public font assets · OFL' },
    note: 'A real completed production-renderer search captured at the pinned release. Typography and framing are authored; roads, considered edges and the final route are genuine. Regenerate manually against a built local preview.' }, null, 2) + '\n')
  console.log(JSON.stringify({ imagePath, bytes: image.length, sha256, dataset: record.dataset.identity, events: record.events }))
} finally { await browser.close() }
