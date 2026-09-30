import type { Endpoint, Graph, Point, SearchResult } from './contracts.ts'

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

function nearest(graph: Graph, point: Point, reachable?: Uint8Array): Endpoint {
  const eligible = new Uint8Array(graph.xy.length / 2)
  for (let e = 0; e < graph.from.length; e++) if (graph.category[e] <= 11) {
    eligible[graph.from[e]] = 1; eligible[graph.to[e]] = 1
  }
  let best = Infinity, node = -1
  const longitudeScale = Math.cos(point.lat * Math.PI / 180)
  for (let i = 0; i < eligible.length; i++) {
    if (!eligible[i] || !graph.incoming[i] || graph.offsets[i] === graph.offsets[i + 1] || (reachable && !reachable[i])) continue
    const dx = (graph.xy[i * 2] / 100000 - point.lon) * longitudeScale
    const dy = graph.xy[i * 2 + 1] / 100000 - point.lat
    const d = dx * dx + dy * dy
    if (d < best) { best = d; node = i }
  }
  const snapMetres = Math.sqrt(best) * 111195.0802
  if (node < 0 || snapMetres > 2000) throw new Error(`No connected road within 2 km of ${point.name}. Choose a point closer to the network.`)
  return { ...point, node, lon: graph.xy[node * 2] / 100000, lat: graph.xy[node * 2 + 1] / 100000, snapMetres }
}

export function snapEndpoints(graph: Graph, start: Point, goal: Point): { start: Endpoint; goal: Endpoint; snapMs: number } {
  const begun = performance.now()
  const source = nearest(graph, start)
  const reachable = new Uint8Array(graph.xy.length / 2)
  const queue = new Uint32Array(reachable.length)
  reachable[source.node] = 1; queue[0] = source.node
  let end = 1
  // Endpoint preparation is recorded separately from the Dijkstra replay.
  for (let q = 0; q < end; q++) {
    const u = queue[q]
    for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
      const v = graph.arcTo[a]
      if (!reachable[v]) { reachable[v] = 1; queue[end++] = v }
    }
  }
  return { start: source, goal: nearest(graph, goal, reachable), snapMs: performance.now() - begun }
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
  const begun = performance.now()
  const n = graph.xy.length / 2, e = graph.from.length
  const distance = new Float64Array(n).fill(Infinity)
  const predecessor = new Int32Array(n).fill(-1), previousEdge = new Int32Array(n).fill(-1)
  const settled = new Uint8Array(n)
  const heap = new Heap()
  // One settled event per node; at most one examination and improvement per arc.
  const events = new Uint32Array(n + 2 * graph.arcTo.length)
  const firstSeen = new Uint32Array(e), firstImproved = new Uint32Array(e)
  const checkpointStride = 4096
  const checkpoints: number[] = [0, 0, 0]
  let used = 0, exploredNodes = 0, examinedArcs = 0, improvements = 0, uniqueEdges = 0
  function record(kind: number, id: number) {
    events[used++] = id * 4 + kind
    if (used % checkpointStride === 0) checkpoints.push(exploredNodes, examinedArcs, improvements)
  }
  distance[start.node] = 0; heap.push(start.node, 0)
  while (heap.size) {
    const u = heap.pop()
    if (settled[u]) continue
    settled[u] = 1; exploredNodes++; record(0, u)
    if (u === goal.node) break
    for (let a = graph.offsets[u]; a < graph.offsets[u + 1]; a++) {
      const v = graph.arcTo[a], road = graph.arcEdge[a]
      examinedArcs++; record(1, a)
      if (!firstSeen[road]) { firstSeen[road] = used; uniqueEdges++ }
      const candidate = distance[u] + graph.length[road]
      if (candidate < distance[v]) {
        distance[v] = candidate; predecessor[v] = u; previousEdge[v] = road
        heap.push(v, candidate); improvements++; record(2, a)
        if (!firstImproved[road]) firstImproved[road] = used
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
  const textureWidth = Math.min(2048, Math.max(1, e)), textureHeight = Math.ceil(e / textureWidth)
  const edgeTimes = new Float32Array(textureWidth * textureHeight * 2).fill(-1)
  for (let i = 0; i < e; i++) {
    if (firstSeen[i]) edgeTimes[i * 2] = firstSeen[i]
    if (firstImproved[i]) edgeTimes[i * 2 + 1] = firstImproved[i]
  }
  for (const road of routeEdges) edgeTimes[road * 2 + 1] = -2 - edgeTimes[road * 2 + 1]
  return {
    algorithm: 'dijkstra/1', tieBreak: 'distance, then ascending node id; neighbours in compiler edge order',
    start, goal, searchMs, snapMs, routeMetres: Number.isFinite(distance[goal.node]) ? distance[goal.node] / 100 : null,
    routeNodes: Uint32Array.from(routeNodes), routeEdges: Uint32Array.from(routeEdges),
    routeReversed: Uint8Array.from(routeEdges, (edge, i) => Number(graph.from[edge] !== routeNodes[i])),
    routeLengths: Uint32Array.from(routeEdges, edge => graph.length[edge]),
    trace: events.slice(0, used), checkpoints: Uint32Array.from(checkpoints), checkpointStride,
    edgeTimes, textureWidth, textureHeight, exploredNodes, examinedArcs, improvements, uniqueEdges, maxQueue: heap.maximum,
  }
}

export function countsAt(result: Pick<SearchResult, 'trace' | 'checkpoints' | 'checkpointStride'>, progress: number): [number, number, number] {
  const stop = Math.min(result.trace.length, Math.max(0, Math.floor(progress * result.trace.length)))
  const checkpoint = Math.floor(stop / result.checkpointStride)
  const counts: [number, number, number] = [result.checkpoints[checkpoint * 3], result.checkpoints[checkpoint * 3 + 1], result.checkpoints[checkpoint * 3 + 2]]
  for (let i = checkpoint * result.checkpointStride; i < stop; i++) counts[result.trace[i] & 3]++
  return counts
}
