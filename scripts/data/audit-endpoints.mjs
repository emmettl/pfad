import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import assert from 'node:assert/strict'
import { dijkstra, snapEndpoints } from '../../src/search/engine.ts'
import { astar } from '../../src/search/astar.ts'
import { bidirectional, compileReverse } from '../../src/search/bidirectional.ts'
import { readStudyGraph } from './read-study.mjs'
import { PLACES } from '../../src/places.ts'

const { graph, manifest } = await readStudyGraph(), reverse = compileReverse(graph), n = manifest.counts.nodes
const reachability = new Map(), checks = [], comparisons = []
function reachable(source) {
  if (reachability.has(source)) return reachability.get(source)
  const seen = new Uint8Array(n), queue = new Uint32Array(n); seen[source] = 1; queue[0] = source; let end = 1
  for (let q = 0; q < end; q++) for (let a = graph.offsets[queue[q]]; a < graph.offsets[queue[q] + 1]; a++) {
    const v = graph.arcTo[a]; if (!seen[v]) { seen[v] = 1; queue[end++] = v }
  }
  reachability.set(source, seen); return seen
}
for (const a of PLACES) for (const b of PLACES) {
  const r = snapEndpoints(graph, a, b), swapped = snapEndpoints(graph, b, a)
  assert.equal(r.start.node, swapped.goal.node); assert.equal(r.goal.node, swapped.start.node)
  assert.equal(reachable(r.start.node)[r.goal.node], 1)
  assert.ok(r.start.snapMetres <= 2000 && r.goal.snapMetres <= 2000)
  checks.push({ start: a.name, goal: b.name, startNode: r.start.node, goalNode: r.goal.node,
    startSnapMetres: r.start.snapMetres, goalSnapMetres: r.goal.snapMetres, snapMs: r.snapMs, reachable: true })
}
for (const [a, b] of [['Genève', 'Zürich'], ['Zürich', 'Genève'], ['Lugano', 'Basel'], ['Basel', 'Lugano'], ['Sion', 'Chur'], ['Chur', 'Sion'], ['Andermatt', 'St. Moritz'], ['St. Moritz', 'Andermatt'], ['Genève', 'Lausanne'], ['Lausanne', 'Genève']]) {
  const r = snapEndpoints(graph, PLACES.find(p => p.name === a), PLACES.find(p => p.name === b))
  const results = [dijkstra(graph, r.start, r.goal), bidirectional(graph, reverse, r.start, r.goal), astar(graph, reverse, r.start, r.goal)]
  assert.notEqual(results[0].routeMetres, null)
  for (const result of results) {
    assert.equal(result.routeMetres, results[0].routeMetres)
    assert.equal([...result.routeLengths].reduce((sum, cost) => sum + cost, 0) / 100, result.routeMetres)
    for (let i = 0; i < result.routeEdges.length; i++) {
      const edge = result.routeEdges[i], reversed = result.routeReversed[i]
      assert.ok(reversed ? graph.direction[edge] !== 1 : graph.direction[edge] !== 2)
      assert.equal(result.routeNodes[i], reversed ? graph.to[edge] : graph.from[edge])
      assert.equal(result.routeNodes[i + 1], reversed ? graph.from[edge] : graph.to[edge])
    }
  }
  const comparison = { start: r.start, goal: r.goal, snapping: r.snapping, routeMetres: results[0].routeMetres,
    algorithms: results.map(result => ({ algorithm: result.algorithm, searchMs: result.searchMs,
      events: result.trace.length, settlements: result.exploredNodes, examinedArcs: result.examinedArcs, routeEdges: result.routeEdges.length })) }
  comparisons.push(comparison)
  console.log(`${a} → ${b}: ${comparison.routeMetres} m, all three algorithms agree`)
}
const report = { measuredAt: new Date().toISOString(), snappingVersion: 'nearby-shared-component/1',
  dataset: { identity: manifest.identity, compiler: manifest.compiler, profile: manifest.profile,
    sourceSha256: manifest.source.sha256, sourceTimestamp: manifest.source.dataTimestamp },
  note: 'Checked the committed node/edge chunks against their hashes. Directed reachability and reversal-stable snaps checked for all 12 × 12 curated pairs. Ten directed journeys compared across all three production algorithms; every chosen edge checked for adjacency, allowed direction and exact cost sum. Snap preparation is separate from algorithm replay.',
  checks, comparisons }
const output = process.argv[2] ?? '.cache/endpoint-audit.json'
await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(`${checks.length} curated pairs and ${comparisons.length} directed comparisons passed; ${output}`)
