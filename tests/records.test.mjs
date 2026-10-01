import test from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { readStudyLink, studyUrl, StudyUrlBinding } from '../src/records/link.ts'
import { exportRecord } from '../src/records/export.ts'
const study = { schema: 'pfad-study-link/1', country: 'ch', dataset: 'a'.repeat(64), profile: 'road-connectivity-distance-v1', start: { name: 'Genève', lon: 6.1432, lat: 46.2044 }, goal: { name: 'Zürich', lon: 8.5417, lat: 47.3769 }, algorithm: 'astar', duration: 42.4, progress: .37, outlines: false, view: { x: .2, y: -.1, zoom: 4 } }
test('links retain exact graph, requested endpoints, algorithm, replay frame and camera on either host', () => {
  for (const base of ['https://motionstudies.app/pfad/', 'https://emmettl.github.io/pfad/']) {
    const url = new URL(studyUrl(base, study)); assert.equal(url.origin, new URL(base).origin)
    assert.deepEqual(readStudyLink(url.hash), { study })
  }
})
test('malformed, overlong, unknown profile and non-finite coordinates cannot become a substituted study', () => {
  const rejected = value => assert.ok(readStudyLink(new URL(studyUrl('https://example.org/', value)).hash).error)
  rejected({ ...study, dataset: 'latest' }); rejected({ ...study, profile: 'fastest' }); rejected({ ...study, duration: 999 })
  rejected({ ...study, view: { x: 0, y: 0, zoom: 1000 } }); rejected({ ...study, start: { ...study.start, lon: Infinity } })
  rejected({ ...study, goal: { ...study.goal, name: 'a'.repeat(5000) } })
  assert.ok(readStudyLink('#study=%7Bbad').error); assert.deepEqual(readStudyLink('#something-else'), {})
})
test('automatic URL binding throttles to the latest frame, preserves other parameters and cancels stale work', t => {
  const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout, originalPerformance = globalThis.performance
  const tasks = new Map(); let now = 0, id = 0, url = 'https://motionstudies.app/pfad/?ref=test#context=review', writes = 0
  globalThis.performance = { now: () => now }
  globalThis.setTimeout = fn => { tasks.set(++id, fn); return id }
  globalThis.clearTimeout = id => tasks.delete(id)
  t.after(() => { globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; globalThis.performance = originalPerformance })
  const binding = new StudyUrlBinding(() => url, next => { url = next; writes++ })
  binding.update(study); assert.equal(writes, 1)
  for (let i = 0; i < 30; i++) binding.update({ ...study, progress: i / 30 })
  assert.equal(writes, 1); assert.equal(tasks.size, 1)
  now = 500; const task = [...tasks.values()][0]; tasks.clear(); task()
  assert.equal(writes, 2); assert.equal(readStudyLink(new URL(url).hash).study.progress, 29 / 30)
  assert.equal(new URL(url).searchParams.get('ref'), 'test'); assert.equal(new URLSearchParams(new URL(url).hash.slice(1)).get('context'), 'review')
  binding.update({ ...study, progress: .8 }); binding.update(null); assert.equal(tasks.size, 0); binding.flush(); assert.equal(writes, 2)
  binding.update({ ...study, progress: .9 }); binding.dispose(); assert.equal(tasks.size, 0)
  binding.update(study); binding.flush(); assert.equal(writes, 2); assert.equal(tasks.size, 0)
})
test('record export retains exact binary events including IDs above Float32 precision and byte offsets', async () => {
  const storage = new Uint32Array([99, 16777219, 0xffffffff, 21, 98])
  const result = { dataset: { identity: study.dataset, compiler: 'fixture/1', profile: study.profile }, algorithm: 'astar/1', searchMs: 12.5, snapMs: 3,
    trace: storage.subarray(1, 4), checkpoints: new Uint32Array([1, 2, 3]), edgeTimes: new Uint32Array([5, 6]),
    routeNodes: new Uint32Array([9, 7]), routeEdges: new Uint32Array([2]), routeReversed: new Uint8Array([1]), routeLengths: new Uint32Array([1234]), goalProximity: new Uint8Array([0, 255]), routeMetres: 12.34 }
  const manifest = { identity: study.dataset, source: { attribution: '© OpenStreetMap contributors', licence: 'ODbL-1.0', licenceUrl: 'https://www.openstreetmap.org/copyright' } }
  const blob = await exportRecord(result, manifest, study, [{ seed: 42 }])
  const bytes = gunzipSync(Buffer.from(await blob.arrayBuffer()))
  assert.equal(bytes.subarray(0, 8).toString(), 'PFADREC1')
  const metadataBytes = bytes.readUInt32LE(8), record = JSON.parse(bytes.subarray(12, 12 + metadataBytes))
  assert.equal(record.schema, 'pfad-search-record/1'); assert.equal(record.licence, 'ODbL-1.0')
  assert.deepEqual(record.presentation, study); assert.equal(record.ambient[0].seed, 42)
  assert.equal(record.search.searchMs, 12.5); assert.equal(record.search.dataset.identity, study.dataset)
  assert.equal('trace' in record.search, false)
  for (const [name, descriptor] of Object.entries(record.buffers)) {
    const at = 12 + metadataBytes + descriptor.offset
    assert.equal(descriptor.offset % 4, 0)
    const values = Array.from({ length: descriptor.count }, (_, i) => descriptor.type === 'uint32-le' ? bytes.readUInt32LE(at + i * 4) : bytes[at + i])
    assert.deepEqual(values, [...result[name]])
  }
})
