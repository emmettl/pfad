import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { readStudyGraph } from './read-study.mjs'
import { Heap } from '../../src/search/engine.ts'
import { snapSources } from '../../src/search/endpoints.ts'
import { multisource, SOURCE_ID_MASK, SOURCE_SHIFT } from '../../src/search/multisource.ts'
import { TerritorySelector, TERRITORY_SELECTOR_VERSION } from '../../src/ambient/territories.ts'
import { SWISS_POOL } from '../../src/ambient/pools.ts'

const { graph, manifest } = await readStudyGraph(), n = manifest.counts.nodes
const seed = 20261001, selector = new TerritorySelector(seed ^ 0x74657272, SWISS_POOL), studies = []
// Separate complete single-source distance runs, without the territory recorder.
function distances(source) {
  const d = new Float64Array(n).fill(Infinity), queue = new Heap(); d[source] = 0; queue.push(source, 0)
  while (queue.size) {
    const score = queue.scores[1], u = queue.pop(); if (score !== d[u]) continue
    for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
      const v = graph.arcTo[a], candidate = score + graph.length[graph.arcEdge[a]]
      if (candidate < d[v]) { d[v] = candidate; queue.push(v, candidate) }
    }
  }
  return d
}
for (let study = 0; study < 6; study++) {
  selector.beginStudy(); const selected = selector.choose(); assert.ok(selected)
  const snapped = snapSources(graph, selected.sources), result = multisource(graph, snapped.sources, snapped.snapMs)
  const oracle = snapped.sources.map(source => distances(source.node)), seen = new Uint8Array(n), firstRoad = new Uint8Array(graph.from.length)
  let current = -1, currentSource = -1, maximum = 0, reachable = 0
  for (let u = 0; u < n; u++) {
    const d = Math.min(oracle[0][u], oracle[1][u], oracle[2][u])
    if (Number.isFinite(d)) { reachable++; maximum = Math.max(maximum, d) }
  }
  for (const [i, word] of result.trace.entries()) {
    const source = word >>> SOURCE_SHIFT, kind = word & 3, id = (word & SOURCE_ID_MASK) >>> 2
    assert.ok(source < 3)
    if (kind === 0) {
      assert.equal(seen[id], 0); seen[id] = 1; current = id; currentSource = source
      assert.equal(oracle[source][id], Math.min(oracle[0][id], oracle[1][id], oracle[2][id]))
    } else {
      assert.ok(id >= graph.offsets[current] && id < graph.offsets[current + 1]); assert.equal(source, currentSource)
      const road = graph.arcEdge[id]
      if (kind === 1 && !firstRoad[road]) { firstRoad[road] = 1; assert.equal(result.edgeTimes[road * 2], i + 1); assert.equal(result.edgeSources[road], source) }
    }
  }
  assert.equal(result.exploredNodes, reachable); assert.equal(result.territories.maximumMetres, maximum / 100)
  assert.ok(result.territories.sourceNodes.every(count => count > 0))
  assert.equal(result.routeEdges.length, 0); assert.equal(result.meeting, undefined)
  selector.accept(selected)
  studies.push({ requestedSources: selected.sources, sources: result.sources, snappingVersion: 'nearby-shared-three-source-component/1', algorithm: result.algorithm,
    tieBreak: result.tieBreak, territories: result.territories, events: result.trace.length, examinedArcs: result.examinedArcs,
    uniqueEdges: result.uniqueEdges, searchMs: result.searchMs, snapMs: result.snapMs,
    traceSha256: createHash('sha256').update(result.trace).digest('hex') })
  console.log(`${result.sources.map(source => source.name).join(' · ')}: ${reachable} nearest-source assignments verified`)
}
const output = process.argv[2] ?? '.cache/territory-audit.json'
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(), seed, selector: TERRITORY_SELECTOR_VERSION, pool: SWISS_POOL.version,
  dataset: { identity: manifest.identity, compiler: manifest.compiler, profile: manifest.profile, sourceSha256: manifest.source.sha256, sourceTimestamp: manifest.source.dataTimestamp },
  note: 'Six seeded Swiss triples; every settled node owner checked against three separate full single-source distance runs, and every recorded arc and first road colour checked. No route reveal or invented road boundaries. Host timings do not establish physical-phone memory or routing legality.', studies }, null, 2) + '\n')
