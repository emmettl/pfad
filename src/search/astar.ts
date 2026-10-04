import type { Endpoint, Graph, HeuristicRecord } from './contracts.ts'
import { arcSource, type ReverseGraph } from './bidirectional.ts'
import { releaseBuffers } from './release-buffers.ts'
import { Heap, singleFrontSearch } from './engine.ts'

export function enforcePotential(graph: Graph, reverse: ReverseGraph, potential: Float64Array | Uint32Array, backwards = false) {
  const n = graph.xy.length / 2, changed = new Uint8Array(n), heap = new Heap()
  let correctedNodes = 0
  function lower(node: number, candidate: number) {
    if (candidate >= potential[node]) return
    potential[node] = candidate; heap.push(node, candidate)
    if (!changed[node]) { changed[node] = 1; correctedNodes++ }
  }
  for (let u = 0; u < n; u++) for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
    const v = graph.arcTo[a]
    lower(backwards ? v : u, graph.length[graph.arcEdge[a]] + potential[backwards ? u : v])
  }
  // A lowered estimate can invalidate estimates at its incoming neighbours.
  // Propagate only reductions until every original arc satisfies the inequality.
  while (heap.size) {
    const score = heap.scores[1], u = heap.pop()
    if (score !== potential[u]) continue
    if (backwards) {
      for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) lower(graph.arcTo[a], score + graph.length[graph.arcEdge[a]])
    } else {
      for (let i = reverse.offsets[u]; i < reverse.offsets[u + 1]; i++) lower(arcSource(graph, reverse.arc[i]), score + graph.length[graph.arcEdge[reverse.arc[i]]])
    }
  }
  releaseBuffers(changed, heap.nodes, heap.scores)
  return correctedNodes
}

// Coordinates and costs have independent rounding. Enforce h(u) <= c(u,v)+h(v)
// on the actual directed graph instead of assuming a geographic estimate is safe.
export function prepareHeuristic(graph: Graph, reverse: ReverseGraph, start: number, goal: number, backwards = false, compact = false): { potential: Float64Array | Uint32Array; record: HeuristicRecord } {
  const begun = performance.now(), n = graph.xy.length / 2
  let latitude = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const x = graph.xy[i * 2], y = graph.xy[i * 2 + 1]
    latitude = Math.max(latitude, Math.abs(y)); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const longitudeScale = Math.cos(latitude / 100000 * Math.PI / 180)
  const units = 111.1950802, gx = graph.xy[goal * 2], gy = graph.xy[goal * 2 + 1]
  // Bounds prove every integer estimate fits, including after corrections.
  // Signed differences can then retain exact half-centimetres in balanced A*.
  const maximum = Math.floor(Math.hypot(Math.max(Math.abs(minX - gx), Math.abs(maxX - gx)) * longitudeScale, Math.max(Math.abs(minY - gy), Math.abs(maxY - gy))) * units)
  const potential = compact && maximum <= 0x7ffffffe ? new Uint32Array(n) : new Float64Array(n)
  for (let i = 0; i < n; i++) potential[i] = Math.floor(Math.hypot((graph.xy[i * 2] - gx) * longitudeScale, graph.xy[i * 2 + 1] - gy) * units)
  const initialStartCm = potential[start], correctedNodes = enforcePotential(graph, reverse, potential, backwards)
  return { potential, record: { version: 'feasible-planar-distance/1', preparationMs: performance.now() - begun, correctedNodes, longitudeScale, initialStartCm, startLowerBoundCm: potential[start] } }
}

export function astar(graph: Graph, reverse: ReverseGraph, start: Endpoint, goal: Endpoint, snapMs = 0) {
  return singleFrontSearch(graph, start, goal, snapMs, prepareHeuristic(graph, reverse, start.node, goal.node), true)
}

export function weightedAstar(graph: Graph, reverse: ReverseGraph, start: Endpoint, goal: Endpoint, snapMs = 0) {
  return singleFrontSearch(graph, start, goal, snapMs, { ...prepareHeuristic(graph, reverse, start.node, goal.node), weight: 2 }, true)
}
