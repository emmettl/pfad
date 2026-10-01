import { test } from 'vitest'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { clearStudyUrl, readStudyLink, shareView, studyUrl, StudyUrlBinding } from '../src/records/link.ts'
import { COUNTRIES } from '../src/countries.ts'
import { exportRecord } from '../src/records/export.ts'
const study = { schema: 'pfad-study-link/1', country: 'ch', dataset: 'a'.repeat(64), profile: 'road-connectivity-distance-v1', start: { name: 'Genève', lon: 6.1432, lat: 46.2044 }, goal: { name: 'Zürich', lon: 8.5417, lat: 47.3769 }, algorithm: 'astar', duration: 42.4, progress: .37, outlines: false, view: { x: .2, y: -.1, zoom: 4 } }
const legacy = value => '#study=' + encodeURIComponent(JSON.stringify(value))
test('native links retain the journey and presentation on either host without a frame or graph hash', () => {
  for (const base of ['https://motionstudies.app/pfad/', 'https://emmettl.github.io/pfad/']) {
    const url = new URL(studyUrl(base, study)); assert.equal(url.origin, new URL(base).origin)
    assert.equal(url.search, '?from=geneve&to=zurich&algorithm=astar&duration=42.4&outlines=0&view=0.2,-0.1,4')
    assert.equal(url.hash, '')
    assert.deepEqual(readStudyLink(url.href), { study: { ...study, dataset: COUNTRIES[0].identity, progress: 0 } })
  }
})
test('defaults are omitted and simple journey links stay readable', () => {
  const defaults = { ...study, start: COUNTRIES[0].places[0], goal: COUNTRIES[0].places[1], algorithm: 'dijkstra', duration: 30, outlines: true, view: { x: 0, y: 0, zoom: 1 } }
  assert.equal(studyUrl('https://motionstudies.app/pfad/', defaults), 'https://motionstudies.app/pfad/?from=zurich&to=geneve')
  assert.equal(studyUrl('https://motionstudies.app/pfad/', { ...defaults, progress: 1, dataset: 'b'.repeat(64) }), studyUrl('https://motionstudies.app/pfad/', defaults))
  assert.deepEqual(readStudyLink('?country=is').study.start, { name: 'Reykjavík', lon: -21.9426, lat: 64.1466 })
  assert.deepEqual(readStudyLink('?ref=review#context=hello'), {})
})
test('custom coordinates preserve requested locations and optional names without JSON', () => {
  const custom = { ...study, start: { name: 'Point A', lon: 8.5432101234567, lat: 47.3769 }, goal: { name: 'A & B, café', lon: 6.1, lat: 46.2 } }
  const url = studyUrl('https://motionstudies.app/pfad/', custom)
  assert.ok(url.includes('from=8.5432101234567,47.3769'))
  assert.deepEqual(readStudyLink(url).study, { ...custom, dataset: COUNTRIES[0].identity, progress: 0 })
  // A familiar name at different coordinates must not snap back to the curated city.
  const moved = { ...custom, start: { ...study.start, lon: 6.15 } }
  assert.deepEqual(readStudyLink(studyUrl('https://example.org/', moved)).study.start, moved.start)
})
test('the fitted country camera is omitted while deliberate pans and zooms retain a compact view', () => {
  const bounds = [-.5, -.8, .7, .4], home = { x: .1, y: -.2, zoom: 1 }
  assert.equal(shareView(home, bounds), undefined)
  assert.equal(shareView({ ...home, x: .1000003 }, bounds), undefined)
  const pan = { ...home, x: .2 }, zoom = { ...home, zoom: 2 }
  assert.deepEqual(shareView(pan, bounds), pan); assert.deepEqual(shareView(zoom, bounds), zoom)
  assert.equal(new URL(studyUrl('https://example.org/', { ...study, view: { x: .123456789, y: -.987654321, zoom: 2.3456789 } })).searchParams.get('view'), '0.123457,-0.987654,2.345679')
  assert.equal(new URL(studyUrl('https://example.org/', { ...study, duration: 46.39362523264739 })).searchParams.get('duration'), '46.39')
})
test('invalid, duplicated, out-of-range or empty native parameters give an explicit error', () => {
  for (const query of ['country=unknown', 'from=missing', 'from=zurich&from=basel', 'to=181,47', 'from=8,91', 'from=NaN,47', 'from=Infinity,47', 'from=,47', 'from=0x10,47', 'from=8,47,1', 'from=', 'algorithm=fastest', 'algorithm=', 'duration=', 'duration=4.9', 'duration=121', 'outlines=false', 'view=0,0,25', 'view=0,0', 'view=101,0,1', 'from-name=orphan', 'from=zurich&from-name=renamed', `from=${'a'.repeat(201)}`]) {
    assert.ok(readStudyLink('?' + query).error, query)
  }
})
test('legacy fragments retain exact records and reject unsupported or malformed identities and settings', () => {
  assert.deepEqual(readStudyLink(legacy(study)), { study })
  assert.deepEqual(readStudyLink('https://example.org/?from=basel' + legacy(study)), { study })
  const rejected = value => assert.ok(readStudyLink(legacy(value)).error)
  rejected({ ...study, dataset: 'latest' }); rejected({ ...study, profile: 'fastest' }); rejected({ ...study, duration: 999 })
  rejected({ ...study, view: { x: 0, y: 0, zoom: 1000 } }); rejected({ ...study, start: { ...study.start, lon: Infinity } })
  rejected({ ...study, goal: { ...study.goal, name: 'a'.repeat(5000) } })
  assert.ok(readStudyLink('#study=%7Bbad').error); assert.deepEqual(readStudyLink('#something-else'), {})
  assert.ok(readStudyLink(legacy(study) + '&study=%7B%7D').error)
})
test('automatic URL binding ignores replay ticks, throttles journey/view changes and cancels stale work', t => {
  const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout, originalPerformance = globalThis.performance
  const tasks = new Map(); let now = 0, id = 0, url = 'https://motionstudies.app/pfad/?ref=test#context=review', writes = 0
  globalThis.performance = { now: () => now }
  globalThis.setTimeout = fn => { tasks.set(++id, fn); return id }
  globalThis.clearTimeout = id => tasks.delete(id)
  t.onTestFinished(() => { globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; globalThis.performance = originalPerformance })
  const binding = new StudyUrlBinding(() => url, next => { url = next; writes++ })
  binding.update(study); assert.equal(writes, 1)
  for (let i = 0; i < 30; i++) binding.update({ ...study, progress: i / 30 })
  assert.equal(writes, 1); assert.equal(tasks.size, 0)
  for (let i = 0; i < 30; i++) binding.update({ ...study, duration: 30 + i })
  assert.equal(writes, 1); assert.equal(tasks.size, 1)
  now = 500; const task = [...tasks.values()][0]; tasks.clear(); task()
  assert.equal(writes, 2); assert.equal(readStudyLink(url).study.duration, 59)
  assert.equal(readStudyLink(url).study.progress, 0)
  assert.equal(new URL(url).searchParams.get('ref'), 'test'); assert.equal(new URLSearchParams(new URL(url).hash.slice(1)).get('context'), 'review')
  binding.update({ ...study, duration: 60 }); binding.update(null); assert.equal(tasks.size, 0); binding.flush(); assert.equal(writes, 2)
  binding.update({ ...study, duration: 61 }); binding.dispose(); assert.equal(tasks.size, 0)
  binding.update(study); binding.flush(); assert.equal(writes, 2); assert.equal(tasks.size, 0)
})
test('writing and clearing native links preserve unrelated state and remove the old JSON payload', () => {
  const base = 'https://example.org/pfad/?ref=review&country=uk&from=london#context=hello&' + legacy(study).slice(1)
  const url = new URL(studyUrl(base, study))
  assert.equal(url.searchParams.get('ref'), 'review'); assert.equal(url.searchParams.has('country'), false)
  assert.equal(url.hash, '#context=hello')
  assert.equal(clearStudyUrl(url.href), 'https://example.org/pfad/?ref=review#context=hello')
  assert.equal(clearStudyUrl('https://example.org/?from=zurich#hello'), 'https://example.org/#hello')
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

test('all curated manual and ambient places round-trip as unique slugs across all six countries', () => {
  for (const country of COUNTRIES) {
    for (const place of [...country.places, ...country.ambient.places]) {
      const clean = p => ({ name: p.name, lon: p.lon, lat: p.lat })
      const record = { ...study, country: country.id, dataset: country.identity, start: clean(place), goal: clean(country.places[1]), progress: 0 }
      const url = studyUrl('https://motionstudies.app/pfad/', record)
      assert.deepEqual(readStudyLink(url), { study: record }, `${country.id}: ${place.name}`)
      assert.ok(!new URL(url).searchParams.get('from').includes(','))
    }
  }
  assert.ok(readStudyLink(studyUrl('https://motionstudies.app/pfad/', { ...study, country: 'unknown' })).error)
})
