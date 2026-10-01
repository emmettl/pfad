import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { compileGraph, dijkstra, snapEndpoints } from '../../src/search/engine.ts'
import { astar } from '../../src/search/astar.ts'
import { bidirectional, compileReverse } from '../../src/search/bidirectional.ts'
import { validateManifest } from '../../src/search/manifest.ts'
import { PLACES } from '../../src/places.ts'

const edition = JSON.parse(await readFile('public/data/pfad-manifest.json', 'utf8'))
const path = join('public/data', edition.graph.manifest), base = dirname(path)
const manifest = JSON.parse(await readFile(path, 'utf8')); validateManifest(manifest)
const n = manifest.counts.nodes, e = manifest.counts.edges
const xy = new Int32Array(n * 2), from = new Uint32Array(e), to = new Uint32Array(e), length = new Uint32Array(e)
const direction = new Uint8Array(e), category = new Uint8Array(e)
for (const chunk of manifest.chunks) {
  if (chunk.kind === 'geometry') continue
  const compressed = await readFile(join(base, chunk.path))
  assert.equal(compressed.length, chunk.bytes)
  assert.equal(createHash('sha256').update(compressed).digest('hex'), chunk.sha256)
  const bytes = gunzipSync(compressed); assert.equal(bytes.length, chunk.decodedBytes)
  if (chunk.kind === 'nodes') {
    let x = 0, y = 0
    for (let i = 0; i < chunk.count; i++) {
      x += bytes.readInt32LE(i * 8); y += bytes.readInt32LE(i * 8 + 4)
      xy[(chunk.start + i) * 2] = x; xy[(chunk.start + i) * 2 + 1] = y
    }
  } else {
    let u = 0
    for (let i = 0; i < chunk.count; i++) {
      const edge = chunk.start + i, p = i * 4; u += bytes.readInt32LE(p)
      from[edge] = u; to[edge] = u + bytes.readInt32LE(chunk.count * 4 + p)
      length[edge] = bytes.readUInt32LE(chunk.count * 8 + p)
      direction[edge] = bytes[chunk.count * 12 + i]; category[edge] = bytes[chunk.count * 13 + i]
    }
  }
}
const graph = compileGraph({ xy, from, to, length, direction, category }), reverse = compileReverse(graph)
assert.equal(graph.arcTo.length, manifest.counts.directedArcs)
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
