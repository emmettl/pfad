import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, dijkstra, countsAt } from '../src/search/engine.ts'
function graph(n, edges) {
  return compileGraph({ xy: new Int32Array(n * 2), from: Uint32Array.from(edges, e => e[0]), to: Uint32Array.from(edges, e => e[1]), length: Uint32Array.from(edges, e => e[2]), direction: Uint8Array.from(edges, e => e[3] ?? 0), category: new Uint8Array(edges.length) })
}
const endpoint = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
function reference(g, source, target) {
  const d = Array(g.xy.length / 2).fill(Infinity); d[source] = 0
  for (let i = 0; i < d.length; i++) for (let u = 0; u < d.length; u++) for (let a = g.offsets[u]; a < g.offsets[u + 1]; a++) d[g.arcTo[a]] = Math.min(d[g.arcTo[a]], d[u] + g.length[g.arcEdge[a]])
  return Number.isFinite(d[target]) ? d[target] / 100 : null
}
test('Dijkstra agrees with independent relaxation, including disconnected endpoints', () => {
  let seed = 7
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed }
  for (let sample = 0; sample < 40; sample++) {
    const n = 12, g = graph(n, Array.from({ length: 22 }, () => [random() % n, random() % n, 1 + random() % 500, random() % 3]))
    for (let t = 0; t < n; t++) {
      const r = dijkstra(g, endpoint(0), endpoint(t))
      assert.equal(r.routeMetres, reference(g, 0, t))
      if (r.routeMetres !== null) assert.equal([...r.routeEdges].reduce((sum, e) => sum + g.length[e], 0) / 100, r.routeMetres)
      assert.deepEqual([...r.routeLengths], [...r.routeEdges].map(e => g.length[e]))
      assert.deepEqual([...r.routeReversed], [...r.routeEdges].map((e, i) => Number(g.from[e] !== r.routeNodes[i])))
    }
  }
})
test('one-way directions and equal-cost tie-breaking are reproducible', () => {
  const g = graph(4, [[0, 2, 100, 1], [0, 1, 100, 1], [2, 3, 100, 1], [1, 3, 100, 1]])
  const r = dijkstra(g, endpoint(0), endpoint(3))
  assert.deepEqual([...r.routeNodes], [0, 1, 3])
  assert.deepEqual([...r.trace], [...dijkstra(g, endpoint(0), endpoint(3)).trace])
  assert.equal(dijkstra(g, endpoint(3), endpoint(0)).routeMetres, null)
  assert.equal(dijkstra(graph(2, [[0, 1, 100, 2]]), endpoint(1), endpoint(0)).routeMetres, 1)
})
test('events represent settled nodes and actual outgoing arc examinations', () => {
  const g = graph(4, [[0, 1, 900], [0, 2, 100], [2, 1, 100], [1, 3, 100]])
  const r = dijkstra(g, endpoint(0), endpoint(3)), seen = new Set()
  let current = -1, examined = -1
  for (const word of r.trace) {
    const kind = word & 3, id = word >>> 2
    if (kind === 0) { assert.equal(seen.has(id), false); seen.add(id); current = id }
    if (kind === 1) { assert.ok(id >= g.offsets[current] && id < g.offsets[current + 1]); examined = id }
    if (kind === 2) assert.equal(id, examined)
  }
  assert.equal(r.routeMetres, 3)
  for (let i = 0; i < r.trace.length; i++) if ((r.trace[i] & 3) === 1) assert.ok(r.edgeTimes[g.arcEdge[r.trace[i] >>> 2] * 2] <= i + 1)
})
test('seeking backwards across checkpoints exactly restores counts', () => {
  const r = dijkstra(graph(4000, Array.from({ length: 3999 }, (_, i) => [i, i + 1, 10])), endpoint(0), endpoint(3999))
  for (const stop of [0, 4095, 4096, 4097, r.trace.length, 2000, 0]) {
    const expected = [0, 0, 0]
    for (let i = 0; i < stop; i++) expected[r.trace[i] & 3]++
    assert.deepEqual(countsAt(r, (stop + .1) / r.trace.length), expected)
  }
})
