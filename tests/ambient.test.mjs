import { test } from 'vitest'
import assert from 'node:assert/strict'
import { JourneySelector, AMBIENT_PLACES, distanceBand, replaySeconds, straightLineKm } from '../src/ambient/selector.ts'
import { AmbientSequence, ALGORITHM_CYCLE_VERSION } from '../src/ambient/sequence.ts'
import { UK_POOL, AMBIENT_POOLS, LU_POOL } from '../src/ambient/pools.ts'

test('UK selection spans all road regions without proposing sea crossings and exports its pool identity', t => {
  const selector = new JourneySelector(20261001, UK_POOL.places), seen = new Set(), bands = new Set()
  for (let i = 0; i < 500; i++) {
    selector.beginJourney(); const pair = selector.choose(); assert.ok(pair)
    assert.equal(pair.start.region, pair.goal.region)
    seen.add(pair.start.id); seen.add(pair.goal.id); bands.add(pair.band)
    selector.record(pair, pair.estimateKm)
  }
  assert.equal(seen.size, UK_POOL.places.length); assert.equal(bands.size, 3)
  const { sequence, pairs, result } = harness(t)
  sequence.start(20261001, true, 'astar', UK_POOL); sequence.receive(result())
  assert.equal(sequence.records.at(-1).pool, UK_POOL.version)
  assert.ok(UK_POOL.places.includes(pairs.at(-1).start))
  sequence.start(1, true); sequence.receive(result())
  assert.equal(sequence.records.at(-1).pool, 'swiss-places/1')
})

test('seeded, balanced selection preserves six undirected pairs and uses all curated places', () => {
  const first = new JourneySelector(12345), second = new JourneySelector(12345), recent = [], seen = new Set(), bands = new Set()
  for (let i = 0; i < 500; i++) {
    first.beginJourney(); second.beginJourney()
    const a = first.choose(), b = second.choose(); assert.deepEqual(a, b); assert.ok(a)
    const key = [a.start.id, a.goal.id].sort().join('/')
    assert.equal(recent.includes(key), false)
    assert.ok(straightLineKm(a.start, a.goal) >= 30)
    assert.equal(distanceBand(a.estimateKm), a.band)
    assert.deepEqual(first.record(a, a.estimateKm), second.record(b, b.estimateKm))
    recent.push(key); if (recent.length > 6) recent.shift()
    seen.add(a.start.id); seen.add(a.goal.id); bands.add(a.band)
  }
  assert.equal(seen.size, AMBIENT_PLACES.length); assert.equal(bands.size, 3)
})
test('actual distance validates selection; no route and detours cannot silently change bands', () => {
  const selector = new JourneySelector(9); selector.beginJourney()
  const first = selector.choose()
  assert.equal(selector.record(first, null).accepted, false)
  assert.equal(selector.record(first, first.band === 'regional' ? 300 : 50).accepted, false)
  assert.equal(selector.record(first, NaN).accepted, false)
  const next = selector.choose()
  assert.notDeepEqual([next.start.id, next.goal.id].sort(), [first.start.id, first.goal.id].sort())
  assert.equal(next.band, first.band)
  assert.equal(new JourneySelector(1, [AMBIENT_PLACES[0]]).choose(), null)
})
test('replay duration follows road distance with bounded ends, independently of event count', () => {
  assert.equal(replaySeconds(50), 25); assert.equal(replaySeconds(100), 30)
  assert.ok(Math.abs(replaySeconds(200) - 42.4264) < .001)
  assert.equal(replaySeconds(10000), 65)
})
function harness(t) {
  const originalRAF = globalThis.requestAnimationFrame, originalCancel = globalThis.cancelAnimationFrame, originalPerformance = globalThis.performance
  const frames = new Map(), pairs = [], algorithms = []; let now = 0, id = 0
  globalThis.performance = { now: () => now }
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  t.onTestFinished(() => { globalThis.requestAnimationFrame = originalRAF; globalThis.cancelAnimationFrame = originalCancel; globalThis.performance = originalPerformance })
  const sequence = new AmbientSequence(() => {}, (pair, algorithm) => { pairs.push(pair); algorithms.push(algorithm) })
  const step = ms => { for (let i = 0; i < ms; i += 100) { now += 100; const due = [...frames.values()]; frames.clear(); due.forEach(fn => fn(now)) } }
  const result = (km = pairs.at(-1).estimateKm) => ({ routeMetres: km === null ? null : km * 1000, algorithm: algorithms.at(-1) === 'bidirectional' ? 'bidirectional-dijkstra/1' : `${algorithms.at(-1)}/1`, searchMs: 10, trace: new Uint32Array(10), dataset: { identity: 'verified' } })
  return { sequence, pairs, algorithms, step, result, frames }
}
test('ambient rotates from the selected algorithm once per journey and keeps retries in the same mode', t => {
  const { sequence, algorithms, result, step } = harness(t)
  sequence.start(42, false, 'astar'); sequence.receive(result(null))
  assert.deepEqual(algorithms, ['astar', 'astar'])
  assert.equal(sequence.receive(result()), true); sequence.complete(); step(8000)
  assert.deepEqual(algorithms, ['astar', 'astar', 'dijkstra'])
  sequence.receive(result()); sequence.next(); sequence.receive(result()); sequence.next(); sequence.receive(result())
  assert.deepEqual(algorithms, ['astar', 'astar', 'dijkstra', 'bidirectional', 'astar'])
  assert.deepEqual(sequence.records.map(record => record.journey), [1, 1, 2, 3, 4])
  assert.ok(sequence.records.every(record => record.cycle === ALGORITHM_CYCLE_VERSION))
  sequence.exit(); sequence.start(99, true, 'bidirectional'); assert.equal(algorithms.at(-1), 'bidirectional')
})
test('hold, fade, pause, next and exit preserve a single sequence clock', t => {
  const { sequence, pairs, step, result, frames } = harness(t)
  sequence.start(42, false); assert.equal(sequence.receive(result()), true)
  sequence.complete(); assert.equal(sequence.state.phase, 'hold')
  step(5900); sequence.pause(); step(9000); assert.equal(sequence.state.phase, 'hold')
  sequence.resume(); step(200); assert.equal(sequence.state.phase, 'fade')
  step(600); sequence.pause(); const opacity = sequence.state.opacity
  step(10000); assert.equal(sequence.state.opacity, opacity)
  sequence.resume(); step(2000); assert.equal(sequence.state.phase, 'preparing'); assert.equal(pairs.length, 2)
  sequence.receive(result()); sequence.inspect(); assert.equal(sequence.state.running, false)
  sequence.exit(); step(20000); assert.equal(sequence.state.active, false); assert.equal(frames.size, 0); assert.equal(pairs.length, 2)
})
test('failed candidates stop within five attempts, and metadata history cannot retain traces', t => {
  const { sequence, pairs, result } = harness(t)
  sequence.start(5, false)
  while (sequence.state.phase === 'preparing') sequence.receive(result(null))
  assert.ok(pairs.length <= 5); assert.equal(sequence.state.phase, 'stopped'); assert.equal(sequence.state.running, false)
  for (let i = 0; i < 50; i++) { sequence.next(); sequence.receive(result()) }
  assert.equal(sequence.records.length, 12)
  assert.equal(sequence.records.some(record => 'trace' in record), false)
  assert.equal(sequence.records.at(-1).pool, 'swiss-places/1'); assert.equal(sequence.records.at(-1).seed, 5)
})
test('reduced motion requires deliberate Next and preference changes cancel choreography', t => {
  const { sequence, pairs, step, result, frames } = harness(t)
  sequence.start(3, true); sequence.receive(result()); assert.equal(sequence.state.phase, 'still')
  step(60000); assert.equal(pairs.length, 1); assert.equal(frames.size, 0)
  sequence.next(); sequence.receive(result()); assert.equal(pairs.length, 2)
  sequence.start(4, false); sequence.receive(result()); sequence.complete(); step(6100)
  sequence.setReduced(true); assert.equal(sequence.state.phase, 'still'); assert.equal(sequence.state.opacity, 1); assert.equal(sequence.state.running, false)
  step(60000); assert.equal(pairs.length, 3)
})

test('every country pool supplies all distance bands without crossing road regions', () => {
  for (const pool of Object.values(AMBIENT_POOLS)) {
    const selector = new JourneySelector(20261001, pool.places, pool.distance), bands = new Set(), places = new Set()
    for (let i = 0; i < 500; i++) {
      selector.beginJourney(); const pair = selector.choose(); assert.ok(pair, pool.version)
      assert.equal(pair.start.region, pair.goal.region)
      assert.equal(distanceBand(pair.estimateKm, pool.distance), pair.band)
      bands.add(pair.band); places.add(pair.start.id); places.add(pair.goal.id)
      selector.record(pair, pair.estimateKm)
    }
    assert.equal(bands.size, 3, pool.version); assert.equal(places.size, pool.places.length, pool.version)
  }
  assert.equal(distanceBand(55, LU_POOL.distance), 'national')
  assert.equal(distanceBand(55), 'regional')
})
