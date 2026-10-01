import type { Endpoint, Graph, HeuristicRecord } from './contracts.ts'
import type { ReverseGraph } from './bidirectional.ts'
import { Heap, singleFrontSearch } from './engine.ts'

// Coordinates and costs have independent rounding. Enforce h(u) <= c(u,v)+h(v)
// on the actual directed graph instead of assuming a geographic estimate is safe.
export function prepareHeuristic(graph: Graph, reverse: ReverseGraph, start: number, goal: number, backwards = false): { potential: Float64Array; record: HeuristicRecord } {
  const begun = performance.now(), n = graph.xy.length / 2, potential = new Float64Array(n)
  let latitude = 0
  for (let i = 0; i < n; i++) latitude = Math.max(latitude, Math.abs(graph.xy[i * 2 + 1]))
  const longitudeScale = Math.cos(latitude / 100000 * Math.PI / 180)
  const units = 111.1950802, gx = graph.xy[goal * 2], gy = graph.xy[goal * 2 + 1]
  for (let i = 0; i < n; i++) potential[i] = Math.floor(Math.hypot((graph.xy[i * 2] - gx) * longitudeScale, graph.xy[i * 2 + 1] - gy) * units)
  const initialStartCm = potential[start], changed = new Uint8Array(n), heap = new Heap()
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
      for (let i = reverse.offsets[u]; i < reverse.offsets[u + 1]; i++) lower(reverse.from[i], score + graph.length[graph.arcEdge[reverse.arc[i]]])
    }
  }
  return { potential, record: { version: 'feasible-planar-distance/1', preparationMs: performance.now() - begun, correctedNodes, longitudeScale, initialStartCm, startLowerBoundCm: potential[start] } }
}

export function astar(graph: Graph, reverse: ReverseGraph, start: Endpoint, goal: Endpoint, snapMs = 0) {
  return singleFrontSearch(graph, start, goal, snapMs, prepareHeuristic(graph, reverse, start.node, goal.node))
}
