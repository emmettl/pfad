import { test, expect } from '@playwright/test'
import { readdirSync, writeFileSync } from 'node:fs'

test.setTimeout(90000)
async function instrument(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const Native = window.AudioContext
    const probe = { contexts: [] as AudioContext[], starts: [] as number[], decoded: [] as { seconds: number; channels: number; sampleRate: number; length: number; peak: number; rms: number; edge: number }[] }
    Object.assign(window, { musicProbe: probe })
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this) }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source)
        source.start = (...args: Parameters<AudioBufferSourceNode['start']>) => { probe.starts.push(args[0] ?? 0); start(...args) }
        return source
      }
      async decodeAudioData(bytes: ArrayBuffer) {
        const buffer = await super.decodeAudioData(bytes)
        let peak = 0, energy = 0, edge = 0
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const data = buffer.getChannelData(c)
          for (let i = 0; i < data.length; i++) {
            if (!Number.isFinite(data[i])) throw new Error('Non-finite decoded music')
            peak = Math.max(peak, Math.abs(data[i])); energy += data[i] ** 2
            if (i < 20 || i >= data.length - 20) edge = Math.max(edge, Math.abs(data[i]))
          }
        }
        probe.decoded.push({ seconds: buffer.duration, channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, length: buffer.length, peak, rms: Math.sqrt(energy / (buffer.length * buffer.numberOfChannels)), edge })
        return buffer
      }
    }
  })
}

test('real audio is opt-in, bounded and independent of search replay', async ({ page }) => {
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().endsWith('.m4a')) requests.push(request.url()) })
  await instrument(page); await page.goto('./')
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  expect(requests).toEqual([])
  expect(await page.evaluate(() => (window as any).musicProbe.contexts.length)).toBe(0)
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'on', { timeout: 15000 })
  await expect(page.locator('.sound-note')).toHaveText('Plateau')
  await expect.poll(() => page.evaluate(() => (window as any).musicProbe.decoded.length)).toBe(2)
  const music = await page.evaluate(() => {
    const probe = (window as any).musicProbe
    return { contexts: probe.contexts.length, state: probe.contexts[0].state, starts: probe.starts, decoded: probe.decoded }
  })
  expect(music.contexts).toBe(1); expect(music.state).toBe('running')
  expect(music.starts[1] - music.starts[0]).toBeCloseTo(112, 1)
  let retained = 0
  for (const buffer of music.decoded) {
    expect(buffer.channels).toBe(2); expect(buffer.sampleRate).toBe(32000)
    expect(buffer.seconds).toBeCloseTo(120, 1)
    expect(buffer.peak).toBeLessThan(.5); expect(buffer.rms).toBeGreaterThan(.025)
    expect(buffer.edge).toBeLessThan(.002)
    retained += buffer.length * 8
  }
  expect(retained).toBeLessThan(64 * 1024 * 1024)
  await page.screenshot({ path: `test-results/music-on-${test.info().project.name}.png` })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('slider', { name: 'Search replay' }).fill('15')
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'on')
  await page.getByRole('slider', { name: 'Music volume' }).fill('0')
  await expect(page.getByRole('slider', { name: 'Music volume' })).toHaveAttribute('aria-valuetext', '0 percent')
  await page.getByRole('slider', { name: 'Music volume' }).fill('50')
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).musicProbe.contexts[0].state)).toBe('suspended')
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'on')
  expect(await page.evaluate(() => (window as any).musicProbe.contexts.length)).toBe(1)
  expect(await page.evaluate(() => (window as any).musicProbe.starts.length)).toBe(2)
  // Drive the lifecycle handler deterministically; real phone backgrounding is R2 work.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'off')
  await expect.poll(() => page.evaluate(() => (window as any).musicProbe.contexts[0].state)).toBe('suspended')
  await page.evaluate(() => { delete (document as any).hidden; document.dispatchEvent(new Event('visibilitychange')) })
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'off')
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'on')
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'off')
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'off')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/music-${test.info().project.name}.png` })
  expect(errors).toEqual([])
})

test('failed music can be retried while the real map remains usable', async ({ page }) => {
  await page.route('**/*.m4a', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('./'); await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'error')
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await page.unroute('**/*.m4a'); await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'on', { timeout: 15000 })
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.locator('.sound-control')).toHaveAttribute('data-sound', 'on')
})

test('all encoded sketches and the three musical joins have headroom and no cut at the seam', async ({ page }) => {
  await page.goto('./')
  const ids = ['plateau', 'contours', 'afterglow']
  const urls = ids.map(id => `./assets/${readdirSync('dist/assets').find(name => name.startsWith(id + '-') && name.endsWith('.m4a'))}`)
  const quality = await page.evaluate(async urls => {
    const tracks = [], joins = []
    const decode = async (url: string) => {
      const context = new OfflineAudioContext(2, 1, 32000)
      return context.decodeAudioData(await (await fetch(url)).arrayBuffer())
    }
    for (let i = 0; i < urls.length; i++) {
      const current = await decode(urls[i]), next = await decode(urls[(i + 1) % urls.length])
      let peak = 0, energy = 0, maxStep = 0
      for (let channel = 0; channel < current.numberOfChannels; channel++) {
        const samples = current.getChannelData(channel)
        for (let sample = 0; sample < samples.length; sample++) {
          if (!Number.isFinite(samples[sample])) throw new Error('Non-finite encoded score')
          peak = Math.max(peak, Math.abs(samples[sample])); energy += samples[sample] ** 2
          if (sample) maxStep = Math.max(maxStep, Math.abs(samples[sample] - samples[sample - 1]))
        }
      }
      tracks.push({ url: urls[i], seconds: current.duration, channels: current.numberOfChannels, peak, rms: Math.sqrt(energy / (current.length * current.numberOfChannels)), maxStep })
      const mix = new OfflineAudioContext(2, 8 * 32000, 32000)
      for (const [buffer, entering] of [[current, false], [next, true]] as const) {
        const source = mix.createBufferSource(), gain = mix.createGain()
        source.buffer = buffer; source.connect(gain); gain.connect(mix.destination)
        gain.gain.setValueAtTime(entering ? 0 : 1, 0); gain.gain.linearRampToValueAtTime(entering ? 1 : 0, 8)
        source.start(0, entering ? 0 : buffer.duration - 8, 8)
      }
      const rendered = await mix.startRendering()
      let joinPeak = 0, joinStep = 0
      for (let channel = 0; channel < 2; channel++) {
        const samples = rendered.getChannelData(channel)
        for (let sample = 1; sample < samples.length; sample++) {
          if (!Number.isFinite(samples[sample])) throw new Error('Non-finite crossfade')
          joinPeak = Math.max(joinPeak, Math.abs(samples[sample]))
          joinStep = Math.max(joinStep, Math.abs(samples[sample] - samples[sample - 1]))
        }
      }
      joins.push({ from: i, to: (i + 1) % urls.length, peak: joinPeak, maxStep: joinStep })
    }
    return { tracks, joins }
  }, urls)
  for (const track of quality.tracks) {
    expect(track.channels).toBe(2); expect(track.seconds).toBeCloseTo(120, 1)
    expect(track.peak).toBeLessThan(.5); expect(track.rms).toBeGreaterThan(.025)
    expect(track.maxStep).toBeLessThan(.04)
  }
  for (const join of quality.joins) { expect(join.peak).toBeLessThan(.5); expect(join.maxStep).toBeLessThan(.04) }
  writeFileSync(`test-results/music-quality-${test.info().project.name}.json`, JSON.stringify(quality, null, 2) + '\n')
})
