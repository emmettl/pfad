// Verify every authored point belongs to one mutually reachable directed component.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readStudyGraph } from './read-study.mjs'
import { snapEndpoints } from '../../src/search/engine.ts'
import { compileReverse, arcSource } from '../../src/search/bidirectional.ts'
import { AMBIENT_POOLS } from '../../src/ambient/pools.ts'
const [country, path, output] = process.argv.slice(2)
const pool = AMBIENT_POOLS[country]; assert.ok(pool)
const { graph, manifest } = await readStudyGraph(path), reverse = compileReverse(graph)
const anchor = snapEndpoints(graph, pool.places[0], pool.places[0]).start
function visit(backward) {
  const seen = new Uint8Array(manifest.counts.nodes), queue = new Uint32Array(seen.length)
  const offsets = backward ? reverse.offsets : graph.offsets
  seen[anchor.node] = 1; queue[0] = anchor.node; let end = 1
  for (let i = 0; i < end; i++) for (let a = offsets[queue[i]]; a < offsets[queue[i] + 1]; a++) {
    const v = backward ? arcSource(graph, reverse.arc[a]) : graph.arcTo[a]
    if (!seen[v]) { seen[v] = 1; queue[end++] = v }
  }
  return seen
}
const forward = visit(false), backward = visit(true)
const points = pool.places.map(point => {
  const snap = snapEndpoints(graph, point, point).start
  assert.ok(snap.snapMetres < 2000, point.name + ' snap')
  assert.equal(forward[snap.node], 1, point.name + ' reachable from anchor')
  assert.equal(backward[snap.node], 1, point.name + ' can reach anchor')
  return { ...point, snap }
})
await writeFile(output, JSON.stringify({ dataset: manifest.identity, source: manifest.source, compiler: manifest.compiler,
  profile: manifest.profile, pool: pool.version, anchor, points,
  note: 'Forward and reverse complete-graph reachability prove every authored point mutually reachable through the anchor. No invented roads; direction is retained. This is connectivity evidence, not navigation certification.' }, null, 2) + '\n')
console.log(points.length + ' mutually reachable authored points')
