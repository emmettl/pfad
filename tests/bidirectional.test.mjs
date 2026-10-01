import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, countsAt } from '../src/search/engine.ts'
import { BACKWARD, bidirectional, compileReverse } from '../src/search/bidirectional.ts'

const endpoint = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
const graph = (n, edges) => compileGraph({ xy: new Int32Array(n * 2), from: Uint32Array.from(edges, e => e[0]), to: Uint32Array.from(edges, e => e[1]), length: Uint32Array.from(edges, e => e[2]), direction: Uint8Array.from(edges, e => e[3] ?? 1), category: new Uint8Array(edges.length) })
const run = (g, s, t) => bidirectional(g, compileReverse(g), endpoint(s), endpoint(t))

test('bidirectional search matches independent relaxation on directed graphs, including zero costs and disconnected pairs', () => {
  let seed = 163
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed }
  for (let sample = 0; sample < 35; sample++) {
    const n = 9, g = graph(n, Array.from({ length: 19 }, () => [random() % n, random() % n, random() % 8, random() % 3]))
    for (let s = 0; s < n; s++) {
      const d = Array(n).fill(Infinity); d[s] = 0
      for (let j = 0; j < n; j++) for (let u = 0; u < n; u++) for (let a = g.offsets[u]; a < g.offsets[u + 1]; a++) d[g.arcTo[a]] = Math.min(d[g.arcTo[a]], d[u] + g.length[g.arcEdge[a]])
      for (let t = 0; t < n; t++) {
        const r = run(g, s, t)
        assert.equal(r.routeMetres, Number.isFinite(d[t]) ? d[t] / 100 : null)
        if (r.routeMetres === null) { assert.equal(r.routeNodes.length, 0); continue }
        assert.equal(r.routeNodes[0], s); assert.equal(r.routeNodes.at(-1), t)
        assert.equal([...r.routeLengths].reduce((a, b) => a + b, 0) / 100, r.routeMetres)
        r.routeEdges.forEach((e, i) => {
          const u = r.routeNodes[i], v = r.routeNodes[i + 1], reversed = g.from[e] !== u
          assert.equal(r.routeReversed[i], Number(reversed))
          assert.equal(reversed ? g.to[e] : g.from[e], u)
          assert.equal(reversed ? g.from[e] : g.to[e], v)
          assert.notEqual(g.direction[e], reversed ? 1 : 2)
        })
      }
    }
  }
})

test('first contact is recorded without prematurely accepting a longer route', () => {
  const g = graph(4, [[0, 3, 1000], [0, 1, 100], [1, 2, 100], [2, 3, 100]])
  const r = run(g, 0, 3)
  assert.equal(r.meeting.candidateMetres, 10)
  assert.equal(r.routeMetres, 3)
  assert.ok(r.meeting.event < r.trace.length)
  assert.deepEqual([...r.routeNodes], [0, 1, 2, 3])
  assert.deepEqual(r.trace, run(g, 0, 3).trace)
  assert.equal(run(g, 3, 0).routeMetres, null)
  assert.equal(run(g, 2, 2).meeting, undefined)
})

test('both fronts record only genuine directed arcs, texture timestamps and checkpoint counts', () => {
  const g = graph(4000, Array.from({ length: 3999 }, (_, i) => [i, i + 1, 10]))
  const r = run(g, 0, 3999), current = [-1, -1], seen = [new Set(), new Set()], examined = [-1, -1]
  const firstSeen = [new Map(), new Map()], firstImproved = [new Map(), new Map()]
  for (const [i, word] of r.trace.entries()) {
    const side = word & BACKWARD ? 1 : 0, kind = word & 3, id = (word & ~BACKWARD) >>> 2
    if (kind === 0) { assert.equal(seen[side].has(id), false); seen[side].add(id); current[side] = id }
    if (kind === 1) {
      if (side) assert.equal(g.arcTo[id], current[side])
      else assert.ok(id >= g.offsets[current[side]] && id < g.offsets[current[side] + 1])
      examined[side] = id
      if (!firstSeen[side].has(g.arcEdge[id])) firstSeen[side].set(g.arcEdge[id], i + 1)
    }
    if (kind === 2) { assert.equal(id, examined[side]); if (!firstImproved[side].has(g.arcEdge[id])) firstImproved[side].set(g.arcEdge[id], i + 1) }
  }
  for (const side of [0, 1]) {
    assert.ok(seen[side].size > 0)
    const times = side ? r.backwardTimes : r.edgeTimes
    for (let e = 0; e < g.from.length; e++) { assert.equal(times[e * 2], firstSeen[side].get(e) ?? 0); assert.equal(times[e * 2 + 1], firstImproved[side].get(e) ?? 0) }
  }
  const meetingKind = r.trace[r.meeting.event - 1] & 3
  assert.equal(meetingKind, 2)
  assert.equal(g.arcTo[(r.trace[r.meeting.event - 1] & ~BACKWARD) >>> 2], r.meeting.node)
  for (const stop of [0, 4095, 4096, 4097, r.trace.length, 2000, 0]) {
    const counts = [0, 0, 0]
    for (let i = 0; i < stop; i++) counts[r.trace[i] & 3]++
    assert.deepEqual(countsAt(r, (stop + .1) / r.trace.length), counts)
  }
})
