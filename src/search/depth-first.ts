import type { Endpoint, Graph, SearchResult } from './contracts.ts'
import { EventTrace } from './trace.ts'

/** Iterative recursive-order DFS: descend immediately, then resume the parent. */
export function depthFirst(graph: Graph, start: Endpoint, goal: Endpoint, snapMs = 0): SearchResult {
  const begun = performance.now(), n = graph.xy.length / 2, e = graph.from.length
  const seen = new Uint8Array(n), parent = new Int32Array(n).fill(-1), parentEdge = new Int32Array(n).fill(-1)
  const stack = new Uint32Array(n), cursor = graph.offsets.slice(0, n), distance = new Float64Array(n)
  const events = new EventTrace(3 * n + 2 * graph.arcTo.length)
  const textureWidth = Math.min(2048, Math.max(1, e)), textureHeight = Math.max(1, Math.ceil(e / textureWidth))
  const edgeTimes = new Uint32Array(textureWidth * textureHeight * 2), checkpoints = [0, 0, 0], checkpointStride = 4096
  const focusEvents: number[] = [], focusCoordinates: number[] = []
  let used = 0, exploredNodes = 0, examinedArcs = 0, improvements = 0, uniqueEdges = 0, depth = 1, maximum = 1, found = false
  function record(kind: number, id: number) {
    events.set(used++, id * 4 + kind)
    if (used % checkpointStride === 0) checkpoints.push(exploredNodes, examinedArcs, improvements)
  }
  function focus(u: number) { focusEvents.push(used); focusCoordinates.push(graph.xy[u * 2], graph.xy[u * 2 + 1]) }
  seen[start.node] = 1; stack[0] = start.node; exploredNodes++; record(0, start.node); focus(start.node)
  while (depth) {
    const u = stack[depth - 1]
    if (u === goal.node) { found = true; break }
    if (cursor[u] === graph.offsets[u + 1]) {
      depth--
      if (depth) { const p = stack[depth - 1]; record(3, p); focus(p) }
      continue
    }
    const a = cursor[u]++, v = graph.arcTo[a], road = graph.arcEdge[a]
    examinedArcs++; record(1, a)
    if (!edgeTimes[road * 2]) { edgeTimes[road * 2] = used; uniqueEdges++ }
    if (seen[v]) continue
    seen[v] = 1; parent[v] = u; parentEdge[v] = road; distance[v] = distance[u] + graph.length[road]
    improvements++; record(2, a); edgeTimes[road * 2 + 1] ||= used
    stack[depth++] = v; maximum = Math.max(maximum, depth)
    exploredNodes++; record(0, v); focus(v)
  }
  const routeNodes: number[] = [], routeEdges: number[] = []
  if (found) { for (let u = goal.node; u !== -1; u = parent[u]) { routeNodes.push(u); if (parentEdge[u] !== -1) routeEdges.push(parentEdge[u]) } routeNodes.reverse(); routeEdges.reverse() }
  return { algorithm: 'depth-first/1', routeGuarantee: 'first-found', tieBreak: 'depth-first descent in compiler arc order; visit each node once; kind 3 records return to parent; stop upon entering goal',
    start, goal, snapMs, searchMs: performance.now() - begun, routeMetres: found ? distance[goal.node] / 100 : null,
    routeNodes: Uint32Array.from(routeNodes), routeEdges: Uint32Array.from(routeEdges), routeReversed: Uint8Array.from(routeEdges, (edge, i) => Number(graph.from[edge] !== routeNodes[i])), routeLengths: Uint32Array.from(routeEdges, edge => graph.length[edge]),
    trace: events.finish(used), checkpoints: Uint32Array.from(checkpoints), checkpointStride, edgeTimes, textureWidth, textureHeight, exploredNodes, examinedArcs, improvements, uniqueEdges, maxQueue: maximum,
    focusVersion: 'depth-first-traversal-focus/1', focusEvents: Uint32Array.from(focusEvents), focusCoordinates: Int32Array.from(focusCoordinates) }
}
