import type { Endpoint, Graph, SearchResult } from './contracts.ts'
import { arcSource, type ReverseGraph } from './bidirectional.ts'
import { Heap, singleFrontSearch } from './engine.ts'
import { enforcePotential, prepareHeuristic } from './astar.ts'
import { releaseBuffers } from './release-buffers.ts'
const UNREACHED = 0xffffffff
export interface LandmarkIndex { nodes: number[]; from: Uint32Array[]; to: Uint32Array[]; preparationMs: number; bytes: number; peakBufferBytes: number }
function distances(graph: Graph, reverse: ReverseGraph, source: number, backwards: boolean) {
  const n = graph.xy.length / 2, distance = new Uint32Array(n).fill(UNREACHED), settled = new Uint8Array(n), heap = new Heap()
  let peakBytes = distance.byteLength + settled.byteLength
  distance[source] = 0; heap.push(source, 0)
  while (Number.isFinite(heap.minimum(settled))) {
    const u = heap.pop(); settled[u] = 1
    const offsets = backwards ? reverse.offsets : graph.offsets
    for (let i = offsets[u]; i < offsets[u + 1]; i++) {
      const a = backwards ? reverse.arc[i] : i, v = backwards ? arcSource(graph, a) : graph.arcTo[a]
      if (settled[v]) continue
      const candidate = distance[u] + graph.length[graph.arcEdge[a]]
      if (candidate >= UNREACHED && distance[v] === UNREACHED) throw new Error('ALT distance exceeds its exact uint32 table capacity')
      if (candidate < distance[v]) { distance[v] = candidate; heap.push(v, candidate) }
    }
    peakBytes = Math.max(peakBytes, distance.byteLength + settled.byteLength + heap.nodes.byteLength + heap.scores.byteLength)
  }
  releaseBuffers(settled, heap.nodes, heap.scores)
  return { distance, peakBytes }
}
/** Four fixed geographic farthest-point landmarks in the seed's strong component. */
export function buildLandmarks(graph: Graph, reverse: ReverseGraph): LandmarkIndex {
  const begun = performance.now(), n = graph.xy.length / 2, nodes: number[] = [], from: Uint32Array[] = [], to: Uint32Array[] = []
  let seed = 0, degree = -1, bytes = 0, peakBufferBytes = 0
  for (let u = 0; u < n; u++) { const d = graph.offsets[u + 1] - graph.offsets[u] + reverse.offsets[u + 1] - reverse.offsets[u]; if (d > degree) { degree = d; seed = u } }
  const nearest = new Float64Array(n).fill(Infinity)
  let next = seed
  for (let k = 0; k < 4 && next >= 0; k++) {
    nodes.push(next)
    for (const backwards of [false, true]) {
      const table = distances(graph, reverse, next, backwards)
      peakBufferBytes = Math.max(peakBufferBytes, bytes + nearest.byteLength + table.peakBytes)
      bytes += table.distance.byteLength; (backwards ? to : from).push(table.distance)
    }
    const x = graph.xy[next * 2], y = graph.xy[next * 2 + 1]
    let farthest = -1, score = -1
    for (let u = 0; u < n; u++) {
      if (from[0][u] === UNREACHED || to[0][u] === UNREACHED) continue
      const separation = (graph.xy[u * 2] - x) ** 2 + (graph.xy[u * 2 + 1] - y) ** 2
      nearest[u] = Math.min(nearest[u], separation)
      if (!nodes.includes(u) && nearest[u] > score) { farthest = u; score = nearest[u] }
    }
    next = farthest
  }
  releaseBuffers(nearest)
  return { nodes, from, to, preparationMs: performance.now() - begun, bytes, peakBufferBytes }
}
export function prepareAlt(graph: Graph, reverse: ReverseGraph, index: LandmarkIndex, start: number, goal: number) {
  const begun = performance.now(), base = prepareHeuristic(graph, reverse, start, goal), potential = base.potential
  for (let u = 0; u < potential.length; u++) for (let k = 0; k < index.nodes.length; k++) {
    const fromU = index.from[k][u], fromGoal = index.from[k][goal], toU = index.to[k][u], toGoal = index.to[k][goal]
    if (fromU !== UNREACHED && fromGoal !== UNREACHED) potential[u] = Math.max(potential[u], fromGoal - fromU)
    if (toU !== UNREACHED && toGoal !== UNREACHED) potential[u] = Math.max(potential[u], toU - toGoal)
  }
  const initialStartCm = potential[start], correctedNodes = enforcePotential(graph, reverse, potential)
  return { potential, record: { ...base.record, version: 'feasible-landmark-distance/1' as const, initialStartCm, startLowerBoundCm: potential[start], correctedNodes, preparationMs: performance.now() - begun } }
}
export function alt(graph: Graph, reverse: ReverseGraph, index: LandmarkIndex, start: Endpoint, goal: Endpoint, snapMs = 0, cached = false): SearchResult {
  const result = singleFrontSearch(graph, start, goal, snapMs, prepareAlt(graph, reverse, index, start.node, goal.node), true)
  result.algorithm = 'alt/1'
  result.landmarks = { version: 'directed-landmarks/1', selection: 'max-degree-seed-geographic-farthest-strong-component/1', nodes: index.nodes.map(node => ({ node, lon: graph.xy[node * 2] / 100000, lat: graph.xy[node * 2 + 1] / 100000 })), preprocessingMs: index.preparationMs, cached, tableBytes: index.bytes, peakBuildBufferBytes: index.peakBufferBytes, tableType: 'uint32-centimetres-unreached-ffffffff', cost: 'distance' }
  result.tieBreak = 'ALT feasible landmark bound plus cost so far; ascending node id; compiler arc order; first equal-cost predecessor; stop at goal expansion'
  return result
}
