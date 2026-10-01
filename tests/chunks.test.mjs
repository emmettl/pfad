import test from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { loadChunks, decodeChunk } from '../src/search/chunks.ts'

class MemoryCache {
  values = new Map()
  async keys() { return [...this.values.keys()].map(url => new Request(url)) }
  async match(key) { return this.values.get(typeof key === 'string' ? key : key.url)?.clone() }
  async put(key, response) { this.values.set(typeof key === 'string' ? key : key.url, response.clone()) }
  async delete(key) { return this.values.delete(typeof key === 'string' ? key : key.url) }
}
function fixture() {
  const bodies = new Map(), chunks = []
  for (const kind of ['nodes', 'edges', 'geometry']) for (let i = 0; i < 3; i++) {
    const body = gzipSync(Buffer.from([chunks.length, 1, 2, 3]))
    const path = `${kind}-${i}`; bodies.set(path, body)
    chunks.push({ kind, path, start: i, count: 1, stride: 4, bytes: body.length, decodedBytes: 4, sha256: createHash('sha256').update(body).digest('hex') })
  }
  return { bodies, manifest: { identity: 'a'.repeat(64), downloadBytes: chunks.reduce((n, c) => n + c.bytes, 0), chunks } }
}
function install(t, body) {
  const originalFetch = globalThis.fetch, originalCaches = globalThis.caches
  const cache = new MemoryCache(), requests = []
  globalThis.caches = { open: async () => cache }
  globalThis.fetch = async url => { const path = new URL(url).pathname.split('/').at(-1); requests.push(path); return body(path) }
  t.after(() => { globalThis.fetch = originalFetch; globalThis.caches = originalCaches })
  return { cache, requests }
}
test('cold and warm records have identical ordered bytes; warm chunks are reverified without network', async t => {
  const { manifest, bodies } = fixture(), { requests } = install(t, path => new Response(bodies.get(path)))
  const run = async () => {
    const output = [], progress = []
    const measurements = await loadChunks(manifest, 'https://example.org/manifest', (loaded) => progress.push(loaded), (chunk, bytes) => output.push([chunk.path, ...new Uint8Array(bytes)]))
    assert.equal(progress.at(-1), manifest.downloadBytes)
    return { output, measurements }
  }
  const cold = await run(), warm = await run()
  assert.deepEqual(warm.output, cold.output)
  assert.equal(cold.measurements.networkBytes, manifest.downloadBytes)
  assert.equal(warm.measurements.cachedBytes, manifest.downloadBytes)
  assert.equal(warm.measurements.networkBytes, 0)
  assert.equal(requests.length, manifest.chunks.length)
})
test('a damaged cache entry alone is refetched and repaired', async t => {
  const { manifest, bodies } = fixture(), { cache, requests } = install(t, path => new Response(bodies.get(path)))
  const run = () => loadChunks(manifest, 'https://example.org/manifest', () => {}, () => {})
  await run(); requests.length = 0
  const key = [...cache.values.keys()].find(k => k.endsWith(manifest.chunks[1].sha256))
  await cache.put(key, new Response('broken'))
  await run(); assert.deepEqual(requests, [manifest.chunks[1].path])
  requests.length = 0; await run(); assert.equal(requests.length, 0)
})
test('failed chunks retry twice; a later retry retains the completed groups', async t => {
  const { manifest, bodies } = fixture(); let fail = true
  const { requests } = install(t, path => path === 'geometry-0' && fail ? new Response('', { status: 503 }) : new Response(bodies.get(path)))
  const run = () => loadChunks(manifest, 'https://example.org/manifest', () => {}, () => {})
  await assert.rejects(run(), /incomplete graph cannot be searched/)
  assert.equal(requests.filter(p => p === 'geometry-0').length, 2)
  fail = false; requests.length = 0; await run()
  assert.equal(requests.some(p => p.startsWith('nodes') || p.startsWith('edges')), false)
})
test('storage refusal falls back to verified network, with two outstanding chunks and group boundaries', async t => {
  const { manifest, bodies } = fixture(); let active = 0, peak = 0, nodesConsumed = 0, edgesConsumed = 0
  install(t, async path => {
    if (path.startsWith('edges')) assert.equal(nodesConsumed, 3)
    if (path.startsWith('geometry')) assert.equal(edgesConsumed, 3)
    active++; peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, path.endsWith('0') ? 15 : 1))
    active--; return new Response(bodies.get(path))
  })
  globalThis.caches.open = async () => { throw new Error('Storage denied') }
  const result = await loadChunks(manifest, 'https://example.org/manifest', () => {}, chunk => { if (chunk.kind === 'nodes') nodesConsumed++; if (chunk.kind === 'edges') edgesConsumed++ })
  assert.equal(peak, 2); assert.equal(result.cacheAvailable, false)
  assert.equal(result.networkBytes, manifest.downloadBytes)
})
test('gzip expansion and truncated layouts cannot exceed the declared allocation', async () => {
  const bytes = new Uint8Array(gzipSync(Buffer.alloc(32)))
  await assert.rejects(decodeChunk(bytes, { decodedBytes: 4, stride: 0 }), /exceeds/)
  await assert.rejects(decodeChunk(bytes, { decodedBytes: 40, stride: 0 }), /Incomplete/)
  await assert.rejects(decodeChunk(bytes, { decodedBytes: 32, stride: 3, count: 10 }), /layout/)
})
test('versioned storage retains at most two releases and stays within the compressed budget', async t => {
  const { manifest, bodies } = fixture(), { cache } = install(t, path => new Response(bodies.get(path)))
  let clock = 0; t.mock.method(Date, 'now', () => ++clock)
  const run = (id, bytes) => loadChunks({ ...manifest, identity: id.repeat(64), downloadBytes: bytes }, 'https://example.org/manifest', () => {}, () => {})
  await run('a', 80 * 1024 * 1024); await run('b', 50 * 1024 * 1024)
  let keys = await cache.keys(); assert.equal(keys.some(k => k.url.includes('a'.repeat(64))), false)
  await run('c', 16 * 1024 * 1024); await run('d', 16 * 1024 * 1024)
  keys = await cache.keys()
  assert.equal(keys.filter(k => k.url.endsWith('/record')).length, 2)
  assert.equal(keys.some(k => k.url.includes('b'.repeat(64))), false)
  assert.ok(keys.some(k => k.url.includes('c'.repeat(64))) && keys.some(k => k.url.includes('d'.repeat(64))))
})
test('an IndexedDB permission refusal uses verified network instead of creating a second cache budget', async t => {
  const { manifest, bodies } = fixture(), { cache } = install(t, path => new Response(bodies.get(path)))
  const previous = globalThis.indexedDB
  globalThis.indexedDB = { open() { throw new Error('Permission refused') } }
  t.after(() => { globalThis.indexedDB = previous })
  const result = await loadChunks(manifest, 'https://example.org/manifest', () => {}, () => {})
  assert.equal(result.cacheAvailable, false); assert.equal(result.networkBytes, manifest.downloadBytes)
  assert.equal((await cache.keys()).length, 0)
})
