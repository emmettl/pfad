import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, countsAt, dijkstra } from '../src/search/engine.ts'
import { compileReverse, bidirectional } from '../src/search/bidirectional.ts'
import { astar, prepareHeuristic } from '../src/search/astar.ts'

const endpoint = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
const graph = (xy, edges) => compileGraph({ xy: Int32Array.from(xy.flat()), from: Uint32Array.from(edges, e => e[0]), to: Uint32Array.from(edges, e => e[1]), length: Uint32Array.from(edges, e => e[2]), direction: Uint8Array.from(edges, e => e[3] ?? 1), category: new Uint8Array(edges.length) })

test('A* has a feasible integer bound and optimal cost on directed, disconnected and zero-cost graphs', () => {
  let seed = 1729
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed }
  for (let sample = 0; sample < 35; sample++) {
    const n = 9, g = graph(Array.from({ length: n }, () => [600000 + random() % 500, 470000 + random() % 500]), Array.from({ length: 19 }, () => [random() % n, random() % n, random() % 1000, random() % 3]))
    const reverse = compileReverse(g)
    for (let t = 0; t < n; t++) {
      const { potential: h } = prepareHeuristic(g, reverse, 0, t)
      assert.equal(h[t], 0)
      for (let u = 0; u < n; u++) {
        assert.ok(Number.isInteger(h[u]) && h[u] >= 0)
        for (let a = g.offsets[u]; a < g.offsets[u + 1]; a++) assert.ok(h[u] <= g.length[g.arcEdge[a]] + h[g.arcTo[a]])
      }
      for (let s = 0; s < n; s++) {
        const distance = Array(n).fill(Infinity); distance[s] = 0
        for (let j = 0; j < n; j++) for (let u = 0; u < n; u++) for (let a = g.offsets[u]; a < g.offsets[u + 1]; a++) distance[g.arcTo[a]] = Math.min(distance[g.arcTo[a]], distance[u] + g.length[g.arcEdge[a]])
        const r = astar(g, reverse, endpoint(s), endpoint(t))
        assert.equal(r.routeMetres, Number.isFinite(distance[t]) ? distance[t] / 100 : null)
        if (r.routeMetres === null) { assert.equal(r.routeNodes.length, 0); continue }
        assert.equal(r.routeNodes[0], s); assert.equal(r.routeNodes.at(-1), t)
        assert.equal([...r.routeLengths].reduce((a, b) => a + b, 0) / 100, r.routeMetres)
        r.routeEdges.forEach((e, i) => {
          const u = r.routeNodes[i], v = r.routeNodes[i + 1], reversed = g.from[e] !== u
          assert.equal(r.routeReversed[i], Number(reversed)); assert.equal(reversed ? g.to[e] : g.from[e], u)
          assert.equal(reversed ? g.from[e] : g.to[e], v); assert.notEqual(g.direction[e], reversed ? 1 : 2)
        })
      }
    }
  }
})

test('shortcuts and independently rounded coordinates cannot make A* return the early longer answer', () => {
  const g = graph([[0, 0], [1000, 0], [0, 1]], [[0, 2, 100], [0, 1, 1], [1, 2, 1]])
  const r = astar(g, compileReverse(g), endpoint(0), endpoint(2))
  assert.equal(r.routeMetres, .02); assert.deepEqual([...r.routeNodes], [0, 1, 2])
  assert.ok(r.heuristic.correctedNodes > 0)
  const zero = graph([[0, 0], [1, 0], [2, 0]], [[0, 1, 0], [1, 2, 0]])
  assert.equal(astar(zero, compileReverse(zero), endpoint(0), endpoint(2)).routeMetres, 0)
})

test('goal-directed search settles less work on a branching corridor and records only real events and tones', () => {
  const xy = [], edges = []
  for (let i = 0; i < 1600; i++) { xy.push([i * 10, 0], [i * 10, 10]); if (i) edges.push([(i - 1) * 2, i * 2, 1112, 0]); edges.push([i * 2, i * 2 + 1, 1112, 0]) }
  const g = graph(xy, edges), reverse = compileReverse(g), h = prepareHeuristic(g, reverse, 0, 3198).potential
  const r = astar(g, reverse, endpoint(0), endpoint(3198)), reference = dijkstra(g, endpoint(0), endpoint(3198))
  assert.equal(r.routeMetres, reference.routeMetres); assert.ok(r.exploredNodes < reference.exploredNodes)
  assert.deepEqual(r.trace, astar(g, reverse, endpoint(0), endpoint(3198)).trace)
  let current = -1, examined = -1; const settled = new Set(), seen = new Set()
  for (const [i, word] of r.trace.entries()) {
    const kind = word & 3, id = word >>> 2
    if (kind === 0) { assert.equal(settled.has(id), false); settled.add(id); current = id }
    if (kind === 1) {
      assert.ok(id >= g.offsets[current] && id < g.offsets[current + 1]); examined = id
      const e = g.arcEdge[id]
      if (!seen.has(e)) {
        assert.equal(r.edgeTimes[e * 2], i + 1)
        assert.equal(r.goalProximity[e], Math.round(255 * (1 - Math.min(1, h[g.arcTo[id]] / Math.max(1, h[0])))))
        seen.add(e)
      }
    }
    if (kind === 2) assert.equal(id, examined)
  }
  for (const stop of [0, 4095, 4096, 4097, r.trace.length, 2000, 0]) {
    const expected = [0, 0, 0]; for (let i = 0; i < stop; i++) expected[r.trace[i] & 3]++
    assert.deepEqual(countsAt(r, (stop + .1) / r.trace.length), expected)
  }
})

 test('balanced bidirectional A* keeps reduced costs feasible and focuses a branching corridor', () => {
  const xy = [], edges = []
  for (let i = 0; i < 800; i++) {
    xy.push([i * 10, 0], [i * 10, 10])
    if (i) edges.push([(i - 1) * 2, i * 2, 1112, 0])
    edges.push([i * 2, i * 2 + 1, 1112, 0])
  }
  const g = graph(xy, edges), reverse = compileReverse(g)
  const f = prepareHeuristic(g, reverse, 0, 1598).potential
  const b = prepareHeuristic(g, reverse, 1598, 0, true).potential
  const p = Array.from(f, (h, u) => (h - b[u]) / 2)
  for (let u = 0; u < p.length; u++) for (let a = g.offsets[u]; a < g.offsets[u + 1]; a++) {
    assert.ok(g.length[g.arcEdge[a]] + p[g.arcTo[a]] - p[u] >= 0)
  }
  const r = bidirectional(g, reverse, endpoint(0), endpoint(1598), 0, true)
  assert.equal(r.routeMetres, dijkstra(g, endpoint(0), endpoint(1598)).routeMetres)
  assert.ok(r.exploredNodes < bidirectional(g, reverse, endpoint(0), endpoint(1598)).exploredNodes)
  assert.deepEqual(r.trace, bidirectional(g, reverse, endpoint(0), endpoint(1598), 0, true).trace)
  assert.equal(r.balancedHeuristic.version, 'balanced-feasible-planar-distance/1')
})
