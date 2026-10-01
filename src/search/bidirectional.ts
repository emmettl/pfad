import type { Endpoint, Graph, Meeting, SearchResult } from './contracts.ts'
import { Heap } from './engine.ts'

// Bit 31 records the front; the remaining bits retain the original graph ID.
export const BACKWARD = 0x80000000
export interface ReverseGraph { offsets: Uint32Array; from: Uint32Array; arc: Uint32Array }
export function compileReverse(graph: Graph): ReverseGraph {
  const n = graph.xy.length / 2, offsets = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + graph.incoming[i]
  const from = new Uint32Array(graph.arcTo.length), arc = new Uint32Array(from.length), cursor = offsets.slice()
  for (let u = 0; u < n; u++) for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
    const i = cursor[graph.arcTo[a]]++; from[i] = u; arc[i] = a
  }
  return { offsets, from, arc }
}

export function bidirectional(graph: Graph, reverse: ReverseGraph, start: Endpoint, goal: Endpoint, snapMs = 0): SearchResult {
  const begun = performance.now(), n = graph.xy.length / 2, e = graph.from.length
  if (n >= 2 ** 29 || graph.arcTo.length >= 2 ** 29) throw new Error('Graph IDs exceed the bidirectional trace format')
  const distance = [new Float64Array(n).fill(Infinity), new Float64Array(n).fill(Infinity)]
  const parent = [new Int32Array(n).fill(-1), new Int32Array(n).fill(-1)]
  const parentEdge = [new Int32Array(n).fill(-1), new Int32Array(n).fill(-1)]
  const settled = [new Uint8Array(n), new Uint8Array(n)], heap = [new Heap(), new Heap()]
  const seen = [new Uint32Array(e), new Uint32Array(e)], improved = [new Uint32Array(e), new Uint32Array(e)]
  const events = new Uint32Array(2 * n + 4 * graph.arcTo.length)
  const checkpointStride = 4096, checkpoints: number[] = [0, 0, 0]
  let used = 0, exploredNodes = 0, examinedArcs = 0, improvements = 0, uniqueEdges = 0, maxQueue = 2
  let best = start.node === goal.node ? 0 : Infinity, join = start.node === goal.node ? start.node : -1
  let meeting: Meeting | undefined, previousSide = 1
  function record(side: number, kind: number, id: number) {
    events[used++] = (id * 4 + kind) | (side ? BACKWARD : 0)
    if (used % checkpointStride === 0) checkpoints.push(exploredNodes, examinedArcs, improvements)
  }
  function connect(node: number) {
    const candidate = distance[0][node] + distance[1][node]
    if (!Number.isFinite(candidate)) return
    if (!meeting && start.node !== goal.node) meeting = { event: used, node, lon: graph.xy[node * 2] / 100000, lat: graph.xy[node * 2 + 1] / 100000, candidateMetres: candidate / 100 }
    if (candidate < best) { best = candidate; join = node }
  }
  distance[0][start.node] = 0; distance[1][goal.node] = 0
  heap[0].push(start.node, 0); heap[1].push(goal.node, 0)
  while (true) {
    const forward = heap[0].minimum(settled[0]), backward = heap[1].minimum(settled[1])
    // First contact is only an upper bound. Both queue minima certify optimality.
    if (forward + backward >= best || !Number.isFinite(forward) || !Number.isFinite(backward)) break
    const side = forward === backward ? 1 - previousSide : forward < backward ? 0 : 1
    previousSide = side
    const u = heap[side].pop(); settled[side][u] = 1; exploredNodes++; record(side, 0, u); connect(u)
    const offsets = side ? reverse.offsets : graph.offsets
    for (let i = offsets[u]; i < offsets[u + 1]; i++) {
      const a = side ? reverse.arc[i] : i, v = side ? reverse.from[i] : graph.arcTo[a], road = graph.arcEdge[a]
      examinedArcs++; record(side, 1, a)
      if (!seen[side][road]) { if (!seen[1 - side][road]) uniqueEdges++; seen[side][road] = used }
      const candidate = distance[side][u] + graph.length[road]
      if (candidate < distance[side][v]) {
        distance[side][v] = candidate; parent[side][v] = u; parentEdge[side][v] = road
        heap[side].push(v, candidate); improvements++; record(side, 2, a)
        if (!improved[side][road]) improved[side][road] = used
        connect(v)
      }
      maxQueue = Math.max(maxQueue, heap[0].size + heap[1].size)
    }
  }
  const searchMs = performance.now() - begun, routeNodes: number[] = [], routeEdges: number[] = []
  if (join !== -1) {
    let u = join
    while (u !== -1) {
      routeNodes.push(u)
      if (parentEdge[0][u] !== -1) routeEdges.push(parentEdge[0][u])
      u = parent[0][u]
      if (routeNodes.length > n) throw new Error('Invalid forward predecessor cycle')
    }
    routeNodes.reverse(); routeEdges.reverse(); u = join
    while (parent[1][u] !== -1) {
      routeEdges.push(parentEdge[1][u]); u = parent[1][u]; routeNodes.push(u)
      if (routeNodes.length > n) throw new Error('Invalid backward predecessor cycle')
    }
  }
  const textureWidth = Math.min(2048, Math.max(1, e)), textureHeight = Math.max(1, Math.ceil(e / textureWidth))
  const times = seen.map((front, side) => {
    const texture = new Uint32Array(textureWidth * textureHeight * 2)
    for (let i = 0; i < e; i++) {
      if (front[i]) texture[i * 2] = front[i]
      if (improved[side][i]) texture[i * 2 + 1] = improved[side][i]
    }
    return texture
  })
  return {
    algorithm: 'bidirectional-dijkstra/1',
    tieBreak: 'smaller queue distance; equal distances alternate fronts starting forward; ascending node id within each front; forward compiler edge order, reverse ascending source node then original arc id; retain first equal-cost connection',
    start, goal, searchMs, snapMs, routeMetres: Number.isFinite(best) ? best / 100 : null,
    routeNodes: Uint32Array.from(routeNodes), routeEdges: Uint32Array.from(routeEdges),
    routeReversed: Uint8Array.from(routeEdges, (edge, i) => Number(graph.from[edge] !== routeNodes[i])),
    routeLengths: Uint32Array.from(routeEdges, edge => graph.length[edge]),
    trace: events.slice(0, used), checkpoints: Uint32Array.from(checkpoints), checkpointStride,
    edgeTimes: times[0], backwardTimes: times[1], meeting, textureWidth, textureHeight,
    exploredNodes, examinedArcs, improvements, uniqueEdges, maxQueue,
  }
}
