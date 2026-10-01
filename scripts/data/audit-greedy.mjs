import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { readStudyGraph } from './read-study.mjs'
import { dijkstra, snapEndpoints, Heap } from '../../src/search/engine.ts'
import { greedy, prepareProximity } from '../../src/search/greedy.ts'
import { PLACES } from '../../src/places.ts'
const { graph, manifest } = await readStudyGraph(), comparisons = []
for (const [a, b] of [['Genève', 'Zürich'], ['Zürich', 'Genève'], ['Lugano', 'Basel'], ['Basel', 'Lugano'], ['Sion', 'Chur'], ['Chur', 'Sion'], ['Andermatt', 'St. Moritz'], ['St. Moritz', 'Andermatt'], ['Genève', 'Lausanne'], ['Lausanne', 'Genève']]) {
  const endpoints = snapEndpoints(graph, PLACES.find(place => place.name === a), PLACES.find(place => place.name === b))
  const r = greedy(graph, endpoints.start, endpoints.goal, endpoints.snapMs), optimum = dijkstra(graph, endpoints.start, endpoints.goal)
  assert.notEqual(r.routeMetres, null); assert.ok(r.routeMetres >= optimum.routeMetres)
  assert.equal([...r.routeLengths].reduce((sum, cm) => sum + cm, 0) / 100, r.routeMetres)
  for (let i = 0; i < r.routeEdges.length; i++) {
    const edge = r.routeEdges[i], reversed = r.routeReversed[i]
    assert.notEqual(graph.direction[edge], reversed ? 1 : 2)
    assert.equal(r.routeNodes[i], reversed ? graph.to[edge] : graph.from[edge])
    assert.equal(r.routeNodes[i + 1], reversed ? graph.from[edge] : graph.to[edge])
  }
  const h = prepareProximity(graph, r.start.node, r.goal.node).potential, queue = new Heap(), discovered = new Uint8Array(h.length)
  queue.push(r.start.node, h[r.start.node]); discovered[r.start.node] = 1
  let current = -1, examined = -1, focus = 0
  const first = new Set()
  for (const [i, word] of r.trace.entries()) {
    const kind = word & 3, id = word >>> 2
    if (kind === 0) {
      assert.equal(id, queue.pop()); current = id
      assert.equal(r.focusEvents[focus], i + 1); assert.deepEqual(r.focusCoordinates.slice(focus * 2, focus * 2 + 2), graph.xy.slice(id * 2, id * 2 + 2)); focus++
      if (id === r.goal.node) assert.equal(i, r.trace.length - 1)
    }
    if (kind === 1) {
      assert.ok(id >= graph.offsets[current] && id < graph.offsets[current + 1]); examined = id
      const road = graph.arcEdge[id]
      if (!first.has(road)) { first.add(road); assert.equal(r.edgeTimes[road * 2], i + 1) }
    }
    if (kind === 2) {
      assert.equal(id, examined); const v = graph.arcTo[id]
      assert.equal(discovered[v], 0); discovered[v] = 1; queue.push(v, h[v])
    }
  }
  assert.deepEqual(r.trace, greedy(graph, r.start, r.goal).trace)
  const comparison = { start: r.start, goal: r.goal, snapping: endpoints.snapping, algorithm: r.algorithm,
    routeGuarantee: r.routeGuarantee, tieBreak: r.tieBreak, proximityHeuristic: r.proximityHeuristic,
    routeMetres: r.routeMetres, shortestMetres: optimum.routeMetres, excessMetres: r.routeMetres - optimum.routeMetres,
    excessPercent: 100 * (r.routeMetres / optimum.routeMetres - 1), exploredNodes: r.exploredNodes,
    examinedArcs: r.examinedArcs, events: r.trace.length, searchMs: r.searchMs,
    focusVersion: r.focusVersion, focusEventsSha256: createHash('sha256').update(r.focusEvents).digest('hex'), focusCoordinatesSha256: createHash('sha256').update(r.focusCoordinates).digest('hex'),
    traceSha256: createHash('sha256').update(r.trace).digest('hex') }
  comparisons.push(comparison)
  console.log(`${a} → ${b}: greedy ${(r.routeMetres / 1000).toFixed(1)} km, shortest ${(optimum.routeMetres / 1000).toFixed(1)} km; ${r.examinedArcs} genuine examinations`)
}
const output = process.argv[2] ?? '.cache/greedy-review.json'
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(),
  dataset: { identity: manifest.identity, compiler: manifest.compiler, profile: manifest.profile, sourceSha256: manifest.source.sha256, sourceTimestamp: manifest.source.dataTimestamp },
  note: 'Ten directed Swiss greedy studies: route adjacency, allowed directions and exact cost sums checked; every settlement follows proximity priority and every trace examination is a real outgoing arc. First-discovery and deterministic trace checks pass. Dijkstra provides shortest-distance comparison, not greedy event activity. Geographic preparation is outside the search timer. Host evidence does not establish driving legality or physical-phone budgets.', comparisons }, null, 2) + '\n')
