import type { Endpoint, Graph, SearchResult } from './contracts.ts'
import { Heap } from './engine.ts'
import { EventTrace } from './trace.ts'

// Two high bits identify the settled source. Kind remains in the two low bits.
export const SOURCE_SHIFT = 30
export const SOURCE_ID_MASK = 0x3fffffff
export function multisource(graph: Graph, sources: [Endpoint, Endpoint, Endpoint], snapMs = 0): SearchResult {
  const begun = performance.now(), n = graph.xy.length / 2, e = graph.from.length
  if (n >= 2 ** 28 || graph.arcTo.length >= 2 ** 28) throw new Error('Graph IDs exceed the three-source trace format')
  if (new Set(sources.map(source => source.node)).size !== 3) throw new Error('Three distinct road sources are required')
  const distance = new Float64Array(n).fill(Infinity), owner = new Uint8Array(n).fill(255), settled = new Uint8Array(n), heap = new Heap()
  const textureWidth = Math.min(2048, Math.max(1, e)), textureHeight = Math.max(1, Math.ceil(e / textureWidth))
  const edgeTimes = new Uint32Array(textureWidth * textureHeight * 2), edgeSources = new Uint8Array(textureWidth * textureHeight)
  const events = new EventTrace(n + 2 * graph.arcTo.length), checkpointStride = 4096, checkpoints = [0, 0, 0]
  let used = 0, exploredNodes = 0, examinedArcs = 0, improvements = 0, uniqueEdges = 0, maximumCm = 0
  const sourceNodes = [0, 0, 0]
  function record(kind: number, id: number, source: number) {
    events.set(used++, (id * 4 + kind) | (source << SOURCE_SHIFT))
    if (used % checkpointStride === 0) checkpoints.push(exploredNodes, examinedArcs, improvements)
  }
  sources.forEach((source, i) => { distance[source.node] = 0; owner[source.node] = i; heap.push(source.node, 0) })
  while (Number.isFinite(heap.minimum(settled))) {
    const u = heap.pop(), source = owner[u]; settled[u] = 1
    exploredNodes++; sourceNodes[source]++; maximumCm = Math.max(maximumCm, distance[u]); record(0, u, source)
    for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
      const v = graph.arcTo[a], road = graph.arcEdge[a]
      examinedArcs++; record(1, a, source)
      // Colour is the source of the first genuine examination from a settled
      // node, not an interpolated boundary within a road segment.
      if (!edgeTimes[road * 2]) { edgeTimes[road * 2] = used; edgeSources[road] = source; uniqueEdges++ }
      const candidate = distance[u] + graph.length[road]
      if (candidate < distance[v]) {
        distance[v] = candidate; owner[v] = source; heap.push(v, candidate)
        improvements++; record(2, a, source)
        if (!edgeTimes[road * 2 + 1]) edgeTimes[road * 2 + 1] = used
      }
    }
  }
  return {
    algorithm: 'multisource-dijkstra/1',
    tieBreak: 'distance then ascending node id; sources seeded in recorded order; neighbours in compiler edge order; retain first equal-cost discovery',
    start: sources[0], goal: sources[1], sources,
    territories: { version: 'three-source-first-examination/1', sourceNodes, maximumMetres: maximumCm / 100 },
    searchMs: performance.now() - begun, snapMs, routeMetres: null,
    routeNodes: new Uint32Array(), routeEdges: new Uint32Array(), routeReversed: new Uint8Array(), routeLengths: new Uint32Array(),
    trace: events.finish(used), checkpoints: Uint32Array.from(checkpoints), checkpointStride,
    edgeTimes, edgeSources, textureWidth, textureHeight, exploredNodes, examinedArcs, improvements, uniqueEdges, maxQueue: heap.maximum,
  }
}
