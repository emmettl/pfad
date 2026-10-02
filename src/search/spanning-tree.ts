import type { Endpoint, Graph, SearchResult } from './contracts.ts'
import { Heap } from './engine.ts'
import { EventTrace } from './trace.ts'

/** Prim on the physical undirected multigraph, rooted at A's component. */
export function spanningTree(graph: Graph, start: Endpoint, snapMs = 0, goal?: Endpoint): SearchResult {
  const begun = performance.now(), n = graph.xy.length / 2, e = graph.from.length
  if (Math.max(n, e) >= 2 ** 30) throw new Error('Graph exceeds tree trace IDs')
  const offsets = new Uint32Array(n + 1)
  for (let road = 0; road < e; road++) { offsets[graph.from[road] + 1]++; offsets[graph.to[road] + 1]++ }
  for (let u = 1; u <= n; u++) offsets[u] += offsets[u - 1]
  const roads = new Uint32Array(e * 2), cursor = offsets.slice()
  for (let road = 0; road < e; road++) { roads[cursor[graph.from[road]]++] = road; roads[cursor[graph.to[road]]++] = road }
  const settled = new Uint8Array(n), key = new Float64Array(n).fill(Infinity), parentEdge = new Int32Array(n).fill(-1), heap = new Heap()
  const events = new EventTrace(n + 3 * e), checkpointStride = 4096, checkpoints = [0, 0, 0]
  const textureWidth = Math.min(2048, Math.max(1, e)), textureHeight = Math.max(1, Math.ceil(e / textureWidth)), edgeTimes = new Uint32Array(textureWidth * textureHeight * 2)
  const treeEdges: number[] = []
  let used = 0, exploredNodes = 0, examinedArcs = 0, improvements = 0, uniqueEdges = 0, totalCm = 0
  function record(kind: number, id: number) { events.set(used++, id * 4 + kind); if (used % checkpointStride === 0) checkpoints.push(exploredNodes, examinedArcs, improvements) }
  key[start.node] = 0; heap.push(start.node, 0)
  while (Number.isFinite(heap.minimum(settled))) {
    const u = heap.pop(); settled[u] = 1
    if (parentEdge[u] >= 0) { const road = parentEdge[u]; treeEdges.push(road); totalCm += graph.length[road]; improvements++; record(2, road); edgeTimes[road * 2 + 1] = used }
    exploredNodes++; record(0, u)
    if (goal && u === goal.node) break
    for (let a = offsets[u]; a < offsets[u + 1]; a++) {
      const road = roads[a], v = graph.from[road] === u ? graph.to[road] : graph.from[road]
      examinedArcs++; record(1, road)
      if (!edgeTimes[road * 2]) { edgeTimes[road * 2] = used; uniqueEdges++ }
      if (!settled[v] && (graph.length[road] < key[v] || graph.length[road] === key[v] && road < parentEdge[v])) {
        key[v] = graph.length[road]; parentEdge[v] = road; heap.push(v, key[v])
      }
    }
  }
  const routeNodes: number[] = [], routeEdges: number[] = []
  if (goal && settled[goal.node]) {
    let u = goal.node
    routeNodes.push(u)
    while (u !== start.node) {
      const road = parentEdge[u]; routeEdges.push(road)
      u = graph.from[road] === u ? graph.to[road] : graph.from[road]
      routeNodes.push(u)
    }
    routeNodes.reverse(); routeEdges.reverse()
  }
  return { algorithm: 'spanning-tree/1', start, goal: goal ?? start, routeGuarantee: goal ? 'first-found' : undefined, snapMs, searchMs: performance.now() - begun,
    tieBreak: 'Prim: minimum crossing-edge centimetres then ascending destination node id; equal keys retain lowest physical edge id; incident roads in compiler order',
    tree: { version: goal ? 'undirected-prim-goal/1' : 'undirected-prim-component/1', root: start.node, nodes: exploredNodes, totalMetres: totalCm / 100, directions: 'ignored', traceIds: 'kind-0-node-kind-1-2-physical-road' }, treeEdges: Uint32Array.from(treeEdges),
    routeMetres: goal && settled[goal.node] ? routeEdges.reduce((sum, road) => sum + graph.length[road], 0) / 100 : null,
    routeNodes: Uint32Array.from(routeNodes), routeEdges: Uint32Array.from(routeEdges), routeReversed: Uint8Array.from(routeEdges, (road, i) => Number(graph.from[road] !== routeNodes[i])), routeLengths: Uint32Array.from(routeEdges, road => graph.length[road]),
    trace: events.finish(used), checkpoints: Uint32Array.from(checkpoints), checkpointStride, edgeTimes, textureWidth, textureHeight, exploredNodes, examinedArcs, improvements, uniqueEdges, maxQueue: heap.maximum }
}
