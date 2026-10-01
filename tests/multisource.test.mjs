import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, countsAt } from '../src/search/engine.ts'
import { multisource, SOURCE_ID_MASK, SOURCE_SHIFT } from '../src/search/multisource.ts'
const endpoint = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
const graph = (n, edges) => compileGraph({ xy: new Int32Array(n * 2), from: Uint32Array.from(edges, e => e[0]), to: Uint32Array.from(edges, e => e[1]), length: Uint32Array.from(edges, e => e[2]), direction: Uint8Array.from(edges, e => e[3] ?? 1), category: new Uint8Array(edges.length) })

test('three-source Dijkstra assigns every reachable node an independently verified nearest source', () => {
  let seed = 1741
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed }
  for (let sample = 0; sample < 60; sample++) {
    const g = graph(9, Array.from({ length: 18 }, () => [random() % 9, random() % 9, random() % 15, random() % 3]))
    const sources = [endpoint(0), endpoint(3), endpoint(6)]
    const oracle = sources.map(source => {
      const d = Array(9).fill(Infinity); d[source.node] = 0
      for (let j = 0; j < 9; j++) for (let u = 0; u < 9; u++) for (let a = g.offsets[u]; a < g.offsets[u + 1]; a++) d[g.arcTo[a]] = Math.min(d[g.arcTo[a]], d[u] + g.length[g.arcEdge[a]])
      return d
    })
    const r = multisource(g, sources), seen = new Set(), first = new Map(), current = [-1, -1], counts = [0, 0, 0]
    let examined = -1
    for (const [i, word] of r.trace.entries()) {
      const source = word >>> SOURCE_SHIFT, kind = word & 3, id = (word & SOURCE_ID_MASK) >>> 2
      assert.ok(source < 3); counts[kind]++
      if (kind === 0) {
        assert.equal(seen.has(id), false); seen.add(id); current[0] = id; current[1] = source
        assert.equal(oracle[source][id], Math.min(...oracle.map(distances => distances[id])))
      }
      if (kind === 1) {
        assert.equal(source, current[1]); assert.ok(id >= g.offsets[current[0]] && id < g.offsets[current[0] + 1]); examined = id
        const road = g.arcEdge[id]
        if (!first.has(road)) { first.set(road, i + 1); assert.equal(r.edgeTimes[road * 2], i + 1); assert.equal(r.edgeSources[road], source) }
      }
      if (kind === 2) assert.equal(id, examined)
    }
    assert.equal(seen.size, Array.from({ length: 9 }, (_, u) => Math.min(...oracle.map(d => d[u]))).filter(Number.isFinite).length)
    assert.equal(r.territories.maximumMetres, Math.max(...Array.from(seen, u => Math.min(...oracle.map(d => d[u])))) / 100)
    assert.equal(r.territories.sourceNodes.reduce((a, b) => a + b), seen.size)
    assert.deepEqual(counts, [r.exploredNodes, r.examinedArcs, r.improvements])
    for (let road = 0; road < g.from.length; road++) assert.equal(r.edgeTimes[road * 2], first.get(road) ?? 0)
    assert.deepEqual(r.trace, multisource(g, sources).trace)
    assert.equal(r.routeMetres, null); assert.equal(r.routeEdges.length, 0); assert.equal(r.meeting, undefined)
  }
})

test('territory checkpoints remain exact in both directions and all three sources participate', () => {
  const g = graph(4000, Array.from({ length: 3999 }, (_, i) => [i, i + 1, 10, 0]))
  const r = multisource(g, [endpoint(0), endpoint(2000), endpoint(3999)])
  assert.ok(r.territories.sourceNodes.every(count => count > 0))
  for (const stop of [0, 4095, 4096, 4097, r.trace.length, 2000, 0]) {
    const expected = [0, 0, 0]
    for (let i = 0; i < stop; i++) expected[r.trace[i] & 3]++
    assert.deepEqual(countsAt(r, (stop + .1) / r.trace.length), expected)
  }
  assert.throws(() => multisource(g, [endpoint(0), endpoint(0), endpoint(2)]), /distinct/)
})
