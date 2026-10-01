import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { COUNTRIES } from '../src/countries.ts'
import { validateManifest, manifestIdentityPayload } from '../src/search/manifest.ts'
import worker from '../hosting/data-worker/index.mjs'
const uk = JSON.parse(await readFile('docs/evidence/uk-release-2026-10-01/manifest.json'))
const swiss = JSON.parse(await readFile('public/data/pfad/ch-20260929-6a17f71de78c/manifest.json'))
test('Switzerland stays bundled and default; external releases are pinned and have country endpoints', () => {
  assert.equal(COUNTRIES[0].id, 'ch'); assert.equal(COUNTRIES[0].identity, swiss.identity)
  assert.ok(COUNTRIES[0].manifest.startsWith('./data/')); assert.equal(COUNTRIES[0].large, false)
  for (const c of COUNTRIES) {
    assert.match(c.identity, /^[a-f0-9]{64}$/); assert.ok(c.places.length >= 2)
    assert.ok(c.manifest.includes(c.identity.slice(0, 12))); assert.ok(c.places.every(p => Number.isFinite(p.lon) && Number.isFinite(p.lat)))
  }
  assert.equal(createHash('sha256').update(manifestIdentityPayload(uk)).digest('hex'), COUNTRIES[1].identity)
  validateManifest(uk)
  assert.equal(COUNTRIES[1].outlines, true); assert.equal(COUNTRIES[1].large, true)
})
test('national manifests reject unsafe paths, resource excess and malformed decoded layouts', () => {
  validateManifest(swiss)
  assert.equal(createHash('sha256').update(manifestIdentityPayload(swiss)).digest('hex'), swiss.identity)
  const changed = (edit) => { const copy = structuredClone(swiss); edit(copy); assert.throws(() => validateManifest(copy)) }
  changed(m => m.chunks[0].path = '../other.bin.gz.bin')
  changed(m => m.chunks[0].decodedBytes++)
  changed(m => m.counts.nodes = 10000001)
  changed(m => m.counts.edges = NaN)
  changed(m => m.projection.scaleMetres = 0)
  changed(m => m.projection.longitudeWrapping = 'unknown/1')
})
const key = '/pfad-data/uk-20260929-0555cf638ba1/manifest.json'
const object = () => ({ body: 'immutable graph', size: 15, uploaded: new Date('2026-10-01'), httpEtag: '"hash"' })
const request = (path = key, method = 'GET', h = {}) => new Request('https://motionstudies.app' + path, { method, headers: h })
test('data Worker exposes only read-only release keys with opaque bytes and CORS', async () => {
  let calls = 0
  const env = { DATA: { get: async () => { calls++; return object() }, head: async () => { calls++; return object() } } }
  const ctx = { waitUntil() {} }
  for (const [path, method, status] of [['/pfad-data/../../private', 'GET', 404], ['/pfad-data/latest/manifest.json', 'GET', 404], [key, 'PUT', 405], [key, 'OPTIONS', 204]]) {
    assert.equal((await worker.fetch(request(path, method), env, ctx)).status, status)
  }
  assert.equal(calls, 0)
  const r = await worker.fetch(request(), env, ctx)
  assert.equal(await r.text(), 'immutable graph'); assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*')
  assert.equal(r.headers.get('Content-Encoding'), null); assert.match(r.headers.get('Cache-Control'), /immutable/)
  const head = await worker.fetch(request(key, 'HEAD'), env, ctx); assert.equal(await head.text(), '')
  env.DATA.get = async () => null
  const missing = await worker.fetch(request(), env, ctx); assert.equal(missing.status, 404); assert.equal(missing.headers.get('Cache-Control'), 'no-store')
})
test('data Worker handles conditional reads and byte ranges without caching partial bodies', async () => {
  const env = { DATA: { get: async () => { const o = object(); delete o.body; return o } } }
  assert.equal((await worker.fetch(request(key, 'GET', { 'If-None-Match': '"hash"' }), env, {})).status, 304)
  env.DATA.get = async () => ({ ...object(), range: { offset: 0, length: 4 }, body: 'data' })
  const r = await worker.fetch(request(key, 'GET', { Range: 'bytes=0-3' }), env, {})
  assert.equal(r.status, 206); assert.equal(r.headers.get('Content-Range'), 'bytes 0-3/15'); assert.equal(await r.text(), 'data')
})

test('additional country manifests retain selected identities and verified layout', async () => {
  for (const country of COUNTRIES.filter(c => !['ch', 'uk'].includes(c.id))) {
    const manifest = JSON.parse(await readFile(country.id === 'ie' ? 'docs/evidence/ireland-release-2026-10-01/manifest.json' : `docs/evidence/countries-2026-10-01/${country.id}/manifest.json`))
    validateManifest(manifest)
    assert.equal(manifest.identity, country.identity)
    assert.equal(createHash('sha256').update(manifestIdentityPayload(manifest)).digest('hex'), country.identity)
    assert.ok(country.outlines && country.ambient.places.length >= 10)
  }
})
