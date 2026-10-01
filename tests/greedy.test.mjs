import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, dijkstra, countsAt } from '../src/search/engine.ts'
import { greedy, prepareProximity } from '../src/search/greedy.ts'
const endpoint = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
const graph = (xy, edges) => compileGraph({ xy: Int32Array.from(xy.flat()), from: Uint32Array.from(edges, e => e[0]), to: Uint32Array.from(edges, e => e[1]), length: Uint32Array.from(edges, e => e[2]), direction: Uint8Array.from(edges, e => e[3] ?? 1), category: new Uint8Array(edges.length) })

// Independent small reference: sort an ordinary frontier array, retain the
// first-discovery tree, and stop on expansion of the destination.
function reference(g, h, start, goal) {
  const queue = [start], costs = Array(h.length).fill(Infinity), order = []; costs[start] = 0
  while (queue.length) {
    queue.sort((a, b) => h[a] - h[b] || a - b)
    const u = queue.shift(); order.push(u)
    if (u === goal) break
    for (let a = g.offsets[u]; a < g.offsets[u + 1]; a++) {
      const v = g.arcTo[a]
      if (Number.isFinite(costs[v])) continue
      costs[v] = costs[u] + g.length[g.arcEdge[a]]; queue.push(v)
    }
  }
  return { order, cost: Number.isFinite(costs[goal]) ? costs[goal] / 100 : null }
}

test('greedy follows proximity alone and honestly returns a longer first-found route', () => {
  const g = graph([[0, 0], [900, 0], [0, 1000], [1000, 0]], [[0, 1, 10000], [1, 3, 10000], [0, 2, 1], [2, 3, 1]])
  const r = greedy(g, endpoint(0), endpoint(3))
  assert.equal(r.routeMetres, 200); assert.equal(dijkstra(g, endpoint(0), endpoint(3)).routeMetres, .02)
  assert.deepEqual([...r.routeNodes], [0, 1, 3])
  assert.equal(r.routeGuarantee, 'first-found'); assert.equal(r.proximityHeuristic.version, 'great-circle-proximity/1')
  assert.equal(r.heuristic, undefined)
})

test('greedy agrees with an independent frontier implementation on directed, disconnected, tied and zero-cost graphs', () => {
  let seed = 1759
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed }
  for (let sample = 0; sample < 40; sample++) {
    const n = 10, g = graph(Array.from({ length: n }, () => [random() % 100, random() % 100]), Array.from({ length: 21 }, () => [random() % n, random() % n, random() % 100, random() % 3]))
    for (let start = 0; start < n; start++) for (let goal = 0; goal < n; goal++) {
      const h = prepareProximity(g, start, goal).potential, expected = reference(g, h, start, goal)
      const r = greedy(g, endpoint(start), endpoint(goal)), optimum = dijkstra(g, endpoint(start), endpoint(goal))
      assert.equal(r.routeMetres, expected.cost)
      assert.deepEqual([...r.trace].filter(word => (word & 3) === 0).map(word => word >>> 2), expected.order)
      assert.equal(r.routeMetres === null, optimum.routeMetres === null)
      if (r.routeMetres === null) { assert.equal(r.routeEdges.length, 0); continue }
      assert.ok(r.routeMetres >= optimum.routeMetres)
      assert.equal([...r.routeLengths].reduce((sum, cost) => sum + cost, 0) / 100, r.routeMetres)
      assert.equal(r.routeNodes[0], start); assert.equal(r.routeNodes.at(-1), goal)
      r.routeEdges.forEach((e, i) => {
        const reversed = r.routeReversed[i]
        assert.equal(r.routeNodes[i], reversed ? g.to[e] : g.from[e])
        assert.equal(r.routeNodes[i + 1], reversed ? g.from[e] : g.to[e])
        assert.notEqual(g.direction[e], reversed ? 1 : 2)
      })
    }
  }
})

test('greedy records only real examinations, exact palette timestamps and reversible checkpoint counts', () => {
  const xy = [], edges = []
  for (let i = 0; i < 4000; i++) { xy.push([i, 0]); if (i) edges.push([i - 1, i, 0, 0]) }
  const g = graph(xy, edges), r = greedy(g, endpoint(0), endpoint(3999)), h = prepareProximity(g, 0, 3999).potential
  const seen = new Set(); let current = -1, examined = -1, focus = 0
  for (const [i, word] of r.trace.entries()) {
    const kind = word & 3, id = word >>> 2
    if (kind === 0) { current = id; assert.equal(r.focusEvents[focus], i + 1); assert.deepEqual(r.focusCoordinates.slice(focus * 2, focus * 2 + 2), g.xy.slice(id * 2, id * 2 + 2)); focus++ }
    if (kind === 1) {
      assert.ok(id >= g.offsets[current] && id < g.offsets[current + 1]); examined = id
      const road = g.arcEdge[id]
      if (!seen.has(road)) {
        assert.equal(r.edgeTimes[road * 2], i + 1)
        assert.equal(r.goalProximity[road], Math.round(255 * (1 - Math.min(1, h[g.arcTo[id]] / Math.max(1, h[0])))))
        seen.add(road)
      }
    }
    if (kind === 2) { assert.equal(id, examined); assert.equal(r.edgeTimes[g.arcEdge[id] * 2 + 1], i + 1) }
  }
  assert.equal(r.focusEvents.length, r.exploredNodes); assert.equal(r.focusVersion, 'expanded-node-focus/1')
  assert.equal(r.routeMetres, 0)
  assert.deepEqual(r.trace, greedy(g, endpoint(0), endpoint(3999)).trace)
  for (const stop of [0, 4095, 4096, 4097, r.trace.length, 2000, 0]) {
    const expected = [0, 0, 0]; for (let i = 0; i < stop; i++) expected[r.trace[i] & 3]++
    assert.deepEqual(countsAt(r, (stop + .1) / r.trace.length), expected)
  }
})

test('great-circle proximity respects longitude wrapping and destination zero', () => {
  const g = graph([[17990000, 0], [-17990000, 0], [0, 0]], [])
  const h = prepareProximity(g, 0, 1).potential
  assert.equal(h[1], 0); assert.ok(h[0] / 100 > 22000 && h[0] / 100 < 23000)
  assert.ok(h[0] < h[2])
})
