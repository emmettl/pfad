import type { Endpoint, Graph, HeuristicRecord, ProximityHeuristicRecord, SearchResult } from './contracts.ts'
import { EventTrace } from './trace.ts'
export { snapEndpoints } from './endpoints.ts'

export function compileGraph(graph: Omit<Graph, 'offsets' | 'arcTo' | 'arcEdge' | 'incoming'>): Graph {
  const n = graph.xy.length / 2
  const offsets = new Uint32Array(n + 1)
  const incoming = new Uint32Array(n)
  for (let e = 0; e < graph.from.length; e++) {
    const u = graph.from[e], v = graph.to[e], d = graph.direction[e]
    if (d !== 2) { offsets[u + 1]++; incoming[v]++ }
    if (d !== 1) { offsets[v + 1]++; incoming[u]++ }
  }
  for (let i = 1; i <= n; i++) offsets[i] += offsets[i - 1]
  const arcTo = new Uint32Array(offsets[n])
  const arcEdge = new Uint32Array(offsets[n])
  const cursor = offsets.slice()
  for (let e = 0; e < graph.from.length; e++) {
    const u = graph.from[e], v = graph.to[e], d = graph.direction[e]
    if (d !== 2) { const a = cursor[u]++; arcTo[a] = v; arcEdge[a] = e }
    if (d !== 1) { const a = cursor[v]++; arcTo[a] = u; arcEdge[a] = e }
  }
  return { ...graph, offsets, incoming, arcTo, arcEdge }
}

export class Heap {
  nodes = new Uint32Array(4096)
  scores = new Float64Array(4096)
  size = 0
  maximum = 0
  minimum(settled: Uint8Array) {
    while (this.size && settled[this.nodes[1]]) this.pop()
    return this.size ? this.scores[1] : Infinity
  }
  less(a: number, b: number, node: number, score: number) {
    return a < score || (a === score && b < node)
  }
  push(node: number, score: number) {
    if (this.size + 1 === this.nodes.length) {
      const nodes = new Uint32Array(this.nodes.length * 2), scores = new Float64Array(this.scores.length * 2)
      nodes.set(this.nodes); scores.set(this.scores); this.nodes = nodes; this.scores = scores
    }
    let i = ++this.size
    this.maximum = Math.max(this.maximum, this.size)
    while (i > 1) {
      const parent = i >> 1
      if (!this.less(score, node, this.nodes[parent], this.scores[parent])) break
      this.nodes[i] = this.nodes[parent]; this.scores[i] = this.scores[parent]; i = parent
    }
    this.nodes[i] = node; this.scores[i] = score
  }
  pop(): number {
    const result = this.nodes[1], node = this.nodes[this.size], score = this.scores[this.size--]
    let i = 1
    while (i * 2 <= this.size) {
      let child = i * 2
      if (child < this.size && this.less(this.scores[child + 1], this.nodes[child + 1], this.nodes[child], this.scores[child])) child++
      if (!this.less(this.scores[child], this.nodes[child], node, score)) break
      this.nodes[i] = this.nodes[child]; this.scores[i] = this.scores[child]; i = child
    }
    this.nodes[i] = node; this.scores[i] = score
    return result
  }
}

export function dijkstra(graph: Graph, start: Endpoint, goal: Endpoint, snapMs = 0): SearchResult {
  return singleFrontSearch(graph, start, goal, snapMs)
}

export function singleFrontSearch(graph: Graph, start: Endpoint, goal: Endpoint, snapMs = 0, estimate?: { potential: Float64Array; record: HeuristicRecord; ordering?: 'astar' } | { potential: Float64Array; record: ProximityHeuristicRecord; ordering: 'greedy' }): SearchResult {
  const begun = performance.now(), greedy = estimate?.ordering === 'greedy'
  const n = graph.xy.length / 2, e = graph.from.length
  const distance = new Float64Array(n).fill(Infinity)
  const predecessor = new Int32Array(n).fill(-1), previousEdge = new Int32Array(n).fill(-1)
  const settled = new Uint8Array(n)
  const heap = new Heap()
  // One settled event per node; at most one examination and improvement per arc.
  const events = new EventTrace(n + 2 * graph.arcTo.length)
  const textureWidth = Math.min(2048, Math.max(1, e)), textureHeight = Math.max(1, Math.ceil(e / textureWidth))
  const edgeTimes = new Uint32Array(textureWidth * textureHeight * 2)
  const goalProximity = estimate ? new Uint8Array(textureWidth * textureHeight) : undefined
  const potential = estimate?.potential
  const originEstimate = Math.max(1, potential?.[start.node] ?? 0)
  const focusEvents: number[] = [], focusCoordinates: number[] = []
  const checkpointStride = 4096
  const checkpoints: number[] = [0, 0, 0]
  let used = 0, exploredNodes = 0, examinedArcs = 0, improvements = 0, uniqueEdges = 0
  function record(kind: number, id: number) {
    events.set(used++, id * 4 + kind)
    if (used % checkpointStride === 0) checkpoints.push(exploredNodes, examinedArcs, improvements)
  }
  distance[start.node] = 0; heap.push(start.node, potential?.[start.node] ?? 0)
  while (heap.size) {
    const u = heap.pop()
    if (settled[u]) continue
    settled[u] = 1; exploredNodes++; record(0, u)
    if (greedy) { focusEvents.push(used); focusCoordinates.push(graph.xy[u * 2], graph.xy[u * 2 + 1]) }
    if (u === goal.node) break
    for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
      const v = graph.arcTo[a], road = graph.arcEdge[a]
      examinedArcs++; record(1, a)
      if (!edgeTimes[road * 2]) {
        edgeTimes[road * 2] = used; uniqueEdges++
        if (goalProximity && potential) goalProximity[road] = Math.round(255 * (1 - Math.min(1, potential[v] / originEstimate)))
      }
      const candidate = distance[u] + graph.length[road]
      // Greedy keeps its first-discovery tree. Replacing parents by lower
      // costs after expansion would make its stopped route cost inconsistent.
      if (greedy ? distance[v] === Infinity : candidate < distance[v]) {
        distance[v] = candidate; predecessor[v] = u; previousEdge[v] = road
        heap.push(v, greedy ? potential![v] : candidate + (potential?.[v] ?? 0)); improvements++; record(2, a)
        if (!edgeTimes[road * 2 + 1]) edgeTimes[road * 2 + 1] = used
      }
    }
  }
  const searchMs = performance.now() - begun
  const routeNodes: number[] = [], routeEdges: number[] = []
  if (Number.isFinite(distance[goal.node])) {
    let u = goal.node
    while (u !== -1) {
      routeNodes.push(u)
      if (previousEdge[u] !== -1) routeEdges.push(previousEdge[u])
      u = predecessor[u]
      if (routeNodes.length > n) throw new Error('Invalid predecessor cycle')
    }
    routeNodes.reverse(); routeEdges.reverse()
  }
  return {
    algorithm: greedy ? 'greedy-best-first/1' : estimate ? 'astar/1' : 'dijkstra/1',
    routeGuarantee: greedy ? 'first-found' : undefined,
    focusVersion: greedy ? 'expanded-node-focus/1' : undefined,
    focusEvents: greedy ? Uint32Array.from(focusEvents) : undefined,
    focusCoordinates: greedy ? Int32Array.from(focusCoordinates) : undefined,
    proximityHeuristic: estimate?.ordering === 'greedy' ? estimate.record : undefined,
    tieBreak: greedy ? 'great-circle proximity only, then ascending node id; neighbours in compiler edge order; retain first-discovery predecessor; stop when goal is expanded' : estimate ? 'cost so far plus feasible remaining-distance bound, then ascending node id; neighbours in compiler edge order' : 'distance, then ascending node id; neighbours in compiler edge order',
    start, goal, searchMs, snapMs, routeMetres: Number.isFinite(distance[goal.node]) ? distance[goal.node] / 100 : null,
    routeNodes: Uint32Array.from(routeNodes), routeEdges: Uint32Array.from(routeEdges),
    routeReversed: Uint8Array.from(routeEdges, (edge, i) => Number(graph.from[edge] !== routeNodes[i])),
    routeLengths: Uint32Array.from(routeEdges, edge => graph.length[edge]),
    trace: events.finish(used), checkpoints: Uint32Array.from(checkpoints), checkpointStride,
    edgeTimes, goalProximity, heuristic: estimate && estimate.ordering !== 'greedy' ? estimate.record : undefined, textureWidth, textureHeight, exploredNodes, examinedArcs, improvements, uniqueEdges, maxQueue: heap.maximum,
  }
}

export function countsAt(result: Pick<SearchResult, 'trace' | 'checkpoints' | 'checkpointStride'>, progress: number): [number, number, number] {
  const stop = Math.min(result.trace.length, Math.max(0, Math.floor(progress * result.trace.length)))
  const checkpoint = Math.floor(stop / result.checkpointStride)
  const counts: [number, number, number] = [result.checkpoints[checkpoint * 3], result.checkpoints[checkpoint * 3 + 1], result.checkpoints[checkpoint * 3 + 2]]
  for (let i = checkpoint * result.checkpointStride; i < stop; i++) counts[result.trace[i] & 3]++
  return counts
}
