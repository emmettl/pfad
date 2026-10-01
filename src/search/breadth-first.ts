import type { Endpoint, Graph, SearchResult } from './contracts.ts'
import { EventTrace } from './trace.ts'

/** FIFO breadth-first search: minimize the number of compiled road arcs. */
export function breadthFirst(graph: Graph, start: Endpoint, goal: Endpoint, snapMs = 0): SearchResult {
  const begun = performance.now(), n = graph.xy.length / 2, e = graph.from.length
  const seen = new Uint8Array(n), parent = new Int32Array(n).fill(-1), parentEdge = new Int32Array(n).fill(-1)
  const queue = new Uint32Array(n), distance = new Float64Array(n)
  const events = new EventTrace(n + 2 * graph.arcTo.length)
  const textureWidth = Math.min(2048, Math.max(1, e)), textureHeight = Math.max(1, Math.ceil(e / textureWidth))
  const edgeTimes = new Uint32Array(textureWidth * textureHeight * 2), checkpoints = [0, 0, 0], checkpointStride = 4096
  let used = 0, exploredNodes = 0, examinedArcs = 0, improvements = 0, uniqueEdges = 0, head = 0, tail = 1, maximum = 1, found = false
  function record(kind: number, id: number) {
    events.set(used++, id * 4 + kind)
    if (used % checkpointStride === 0) checkpoints.push(exploredNodes, examinedArcs, improvements)
  }
  seen[start.node] = 1; queue[0] = start.node
  while (head < tail) {
    const u = queue[head++]
    exploredNodes++; record(0, u)
    if (u === goal.node) { found = true; break }
    for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
      const v = graph.arcTo[a], road = graph.arcEdge[a]
      examinedArcs++; record(1, a)
      if (!edgeTimes[road * 2]) { edgeTimes[road * 2] = used; uniqueEdges++ }
      if (seen[v]) continue
      seen[v] = 1; parent[v] = u; parentEdge[v] = road; distance[v] = distance[u] + graph.length[road]
      improvements++; record(2, a); edgeTimes[road * 2 + 1] ||= used
      queue[tail++] = v; maximum = Math.max(maximum, tail - head)
    }
  }
  const routeNodes: number[] = [], routeEdges: number[] = []
  if (found) { for (let u = goal.node; u !== -1; u = parent[u]) { routeNodes.push(u); if (parentEdge[u] !== -1) routeEdges.push(parentEdge[u]) } routeNodes.reverse(); routeEdges.reverse() }
  return { algorithm: 'breadth-first/1', routeGuarantee: 'fewest-connections', tieBreak: 'FIFO queue; neighbours in compiler arc order; retain first-discovery predecessor; stop when goal is dequeued',
    start, goal, snapMs, searchMs: performance.now() - begun, routeMetres: found ? distance[goal.node] / 100 : null,
    routeNodes: Uint32Array.from(routeNodes), routeEdges: Uint32Array.from(routeEdges), routeReversed: Uint8Array.from(routeEdges, (edge, i) => Number(graph.from[edge] !== routeNodes[i])), routeLengths: Uint32Array.from(routeEdges, edge => graph.length[edge]),
    trace: events.finish(used), checkpoints: Uint32Array.from(checkpoints), checkpointStride, edgeTimes, textureWidth, textureHeight, exploredNodes, examinedArcs, improvements, uniqueEdges, maxQueue: maximum }
}
