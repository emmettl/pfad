import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { RackRenderer, MODULES, valueAt } from '@driftbox/rack'
import { Soundtrack } from '../src/music/player.ts'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(await readFile(new URL('../music/manifest.json', import.meta.url)))

test('selected music has bounded delivery, valid rack documents and retained render identity', async () => {
  assert.equal(manifest.packages['@driftbox/rack'].version, '0.1.0')
  assert.ok(manifest.totalBytes < 5 * 1024 * 1024)
  for (const track of manifest.tracks) {
    const delivery = await readFile(new URL(`../src/audio/${track.id}.m4a`, import.meta.url))
    const document = await readFile(new URL(`../music/patches/${track.id}.json`, import.meta.url))
    assert.equal(hash(delivery), track.sha256); assert.equal(delivery.length, track.bytes)
    assert.equal(hash(document), track.patchSha256)
    assert.ok(track.peak < .6 && track.rms > .005 && track.stereoRms > .0001)
    const render = () => {
      const patch = JSON.parse(document), rack = new RackRenderer(MODULES, { sampleRate: 32000 })
      rack.patch = patch; rack.setTransport(patch.tempo, true)
      assert.deepEqual(rack.notes, [])
      return rack.render(3, () => { for (const lane of patch.automation) rack.setParam(...lane.target, valueAt(lane, rack.beat * 4)) })
    }
    const a = render(), b = render()
    assert.deepEqual(a.channels, b.channels)
    assert.ok(a.channels[0].some(sample => Math.abs(sample) > .0001))
  }
})

async function until(predicate) {
  const deadline = performance.now() + 1000
  while (!predicate() && performance.now() < deadline) await delay(2)
  assert.ok(predicate(), 'Asynchronous audio preparation did not finish')
}
const settled = () => delay(10)
function fixture(t) {
  const contexts = [], requests = [], statuses = [], timers = new Map()
  let tick = () => {}, fail = false, deferDecode, decoding = 0, maxDecoding = 0
  const bytes = new Uint8Array([1, 2, 3, 4])
  class Param {
    value = 0
    setValueAtTime(value) { this.value = value }
    linearRampToValueAtTime(value) { this.value = value }
    cancelAndHoldAtTime() {}
  }
  class Context {
    currentTime = 0; state = 'suspended'; sampleRate = 32000; destination = {}; onstatechange = null
    sources = []; resumes = 0
    constructor() { contexts.push(this) }
    resume() { this.state = 'running'; this.resumes++; return Promise.resolve() }
    suspend() { this.state = 'suspended'; this.onstatechange?.(); return Promise.resolve() }
    close() { this.state = 'closed'; return Promise.resolve() }
    createGain() { return { gain: new Param(), connect() {}, disconnect() {} } }
    createBufferSource() {
      const source = { buffer: null, onended: null, connect() {}, disconnect() {}, start(at) { this.at = at }, stop(at) { this.end = at }, ended: false }
      this.sources.push(source); return source
    }
    async decodeAudioData() {
      decoding++; maxDecoding = Math.max(decoding, maxDecoding)
      if (deferDecode) await deferDecode
      decoding--
      return { numberOfChannels: 2, duration: 2, length: 64000 }
    }
    advance(seconds) {
      this.currentTime += seconds
      for (const source of this.sources) if (!source.ended && source.end <= this.currentTime) { source.ended = true; source.onended?.() }
      tick()
    }
  }
  const previous = globalThis.AudioContext
  globalThis.AudioContext = Context
  t.after(() => { globalThis.AudioContext = previous })
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url)
    if (fail === true || fail === url) throw new Error('offline')
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(0) }
  })
  t.mock.method(globalThis, 'setInterval', fn => { tick = fn; return 1 })
  t.mock.method(globalThis, 'clearInterval', () => { tick = () => {} })
  t.mock.method(globalThis, 'setTimeout', fn => { const id = timers.size + 1; timers.set(id, fn); return id })
  t.mock.method(globalThis, 'clearTimeout', id => { timers.delete(id) })
  const tracks = ['A', 'B', 'C'].map(id => ({ id, title: id, url: id, seconds: 2, bytes: 4, sha256: hash(bytes) }))
  const player = new Soundtrack(tracks, status => statuses.push(status))
  t.after(() => player.dispose())
  return { player, contexts, requests, statuses, timers, setFail(value) { fail = value }, defer(promise) { deferDecode = promise }, maxDecoding: () => maxDecoding }
}

test('sound is inert until requested and shares one context through mute and rapid resume', async t => {
  const f = fixture(t)
  assert.equal(f.contexts.length, 0); assert.equal(f.requests.length, 0)
  await f.player.start(); await until(() => f.contexts[0].sources.length === 2)
  assert.equal(f.player.state, 'on'); assert.equal(f.contexts.length, 1)
  const context = f.contexts[0]
  assert.equal(context.sources.length, 2)
  f.player.stop(); assert.equal(f.player.state, 'off')
  await f.player.start(); await until(() => f.contexts[0].sources.length === 2)
  assert.equal(f.timers.size, 0); assert.equal(context.state, 'running')
  assert.equal(context.sources.length, 2); assert.equal(f.contexts.length, 1)
  f.player.stop(true); assert.equal(context.state, 'suspended')
  await f.player.start(); assert.equal(context.state, 'running')
})

test('crossfades cycle the repertoire with two retained voices over sustained use', async t => {
  const f = fixture(t)
  await f.player.start(); await settled()
  const context = f.contexts[0]
  assert.ok(Math.abs(context.sources[1].at - context.sources[0].at - 1.5) < .000001)
  for (let i = 0; i < 12; i++) {
    context.advance(1.6); await until(() => context.sources.filter(source => !source.ended).length === 2)
    assert.equal(f.player.state, 'on')
    assert.ok(context.sources.filter(source => !source.ended).length <= 2)
  }
  assert.ok(f.requests.length >= 10)
  assert.deepEqual(f.requests.slice(0, 6), ['A', 'B', 'C', 'A', 'B', 'C'])
})

test('cancelling a pending decode never starts obsolete sound and decodes stay serialized', async t => {
  const f = fixture(t)
  let release
  f.defer(new Promise(resolve => { release = resolve }))
  const first = f.player.start(); await settled()
  f.player.stop(true)
  const resumed = f.player.start(); await settled()
  assert.equal(f.contexts[0].sources.length, 0)
  release(); await Promise.all([first, resumed]); await until(() => f.contexts[0].sources.length === 2)
  assert.equal(f.maxDecoding(), 1); assert.equal(f.player.state, 'on')
  assert.equal(f.contexts[0].sources.length, 2)
})

test('download failure allows retry, and disposal prevents delayed playback', async t => {
  const f = fixture(t)
  f.setFail(true); await f.player.start()
  assert.equal(f.player.state, 'error'); assert.equal(f.contexts[0].state, 'suspended')
  f.setFail(false); await f.player.start(); await settled()
  assert.equal(f.player.state, 'on')
  f.player.dispose(); assert.equal(f.contexts[0].state, 'closed')
  await f.player.start(); assert.equal(f.contexts.length, 1)
})

test('next-piece failure suspends sound and retry preserves the current musical position', async t => {
  const f = fixture(t)
  f.setFail('B'); await f.player.start(); await settled()
  assert.equal(f.player.state, 'error'); assert.equal(f.contexts[0].state, 'suspended')
  assert.equal(f.contexts[0].sources.length, 1)
  f.setFail(false); await f.player.start(); await until(() => f.contexts[0].sources.length === 2)
  assert.equal(f.player.state, 'on'); assert.equal(f.contexts.length, 1)
  assert.deepEqual(f.requests, ['A', 'B', 'B'])
})
