import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, dijkstra, snapEndpoints } from '../src/search/engine.ts'

function graph(longitudes, edges, categories = new Uint8Array(edges.length)) {
  return compileGraph({ xy: Int32Array.from(longitudes.flatMap(lon => [lon, 4700000])),
    from: Uint32Array.from(edges, e => e[0]), to: Uint32Array.from(edges, e => e[1]),
    length: Uint32Array.from(edges, e => e[2] ?? 10000), direction: Uint8Array.from(edges, e => e[3] ?? 0), category: categories })
}
const a = { name: 'A', lon: 8, lat: 47 }, b = { name: 'B', lon: 8.05, lat: 47 }

test('closer fragments at either end cannot trap a journey, and reversing preserves the snapped pair', () => {
  const g = graph([800010, 804990, 800000, 800001, 805000, 805001], [[0, 1], [2, 3], [4, 5]])
  const forward = snapEndpoints(g, a, b), backward = snapEndpoints(g, b, a)
  assert.deepEqual([forward.start.node, forward.goal.node], [0, 1])
  assert.deepEqual([backward.start.node, backward.goal.node], [1, 0])
  assert.ok(forward.start.snapMetres < 10 && forward.goal.snapMetres < 10)
  assert.equal(dijkstra(g, forward.start, forward.goal).routeMetres, 100)
  assert.equal(dijkstra(g, backward.start, backward.goal).routeMetres, 100)
  assert.deepEqual(forward.snapping, { version: 'nearby-shared-component/1', requestedStart: a, requestedGoal: b })
})

test('a small local component stays usable rather than always snapping to the largest network', () => {
  const g = graph([800000, 800010, 800100, 800110, 800120], [[0, 1], [2, 3], [3, 4]])
  const r = snapEndpoints(g, a, { ...b, lon: 8.0001 })
  assert.deepEqual([r.start.node, r.goal.node], [0, 1])
  assert.equal(r.start.snapMetres + r.goal.snapMetres, 0)
})

test('disconnected components and blocked one-way journeys remain real no-route searches', () => {
  const separate = graph([800000, 800001, 805000, 805001], [[0, 1], [2, 3]])
  const disconnected = snapEndpoints(separate, a, b)
  assert.deepEqual([disconnected.start.node, disconnected.goal.node], [0, 2])
  assert.equal(dijkstra(separate, disconnected.start, disconnected.goal).routeMetres, null)
  const directed = graph([800000, 800001, 805000, 805001], [[0, 1], [2, 3], [1, 2, 10000, 1]])
  const blocked = snapEndpoints(directed, b, a)
  assert.deepEqual([blocked.start.node, blocked.goal.node], [2, 0])
  assert.equal(dijkstra(directed, blocked.start, blocked.goal).routeMetres, null)
  const allowed = snapEndpoints(directed, a, b)
  assert.equal(dijkstra(directed, allowed.start, allowed.goal).routeMetres, 200)
})

test('snapping keeps the two-kilometre bound and excludes service-only endpoints', () => {
  const g = graph([800000, 800001, 805000, 805001], [[0, 1], [2, 3]], Uint8Array.from([12, 0]))
  assert.throws(() => snapEndpoints(g, a, b), /No road within 2 km of A/)
  assert.throws(() => snapEndpoints(g, b, a), /No road within 2 km of A/)
})

test('equal-distance choices use reproducible node ties in both orientations', () => {
  const g = graph([800000, 805000, 800000, 805000], [[2, 3], [0, 1]])
  const forward = snapEndpoints(g, a, b), reverse = snapEndpoints(g, b, a)
  assert.deepEqual([reverse.start.node, reverse.goal.node], [forward.goal.node, forward.start.node])
  assert.deepEqual([forward.start.node, forward.goal.node], [0, 1])
  const again = snapEndpoints(g, a, b)
  assert.deepEqual([again.start, again.goal, again.snapping], [forward.start, forward.goal, forward.snapping])
})
