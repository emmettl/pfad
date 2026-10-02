import type { Endpoint, Graph, ProximityHeuristicRecord } from './contracts.ts'
import { singleFrontSearch } from './engine.ts'

// Geographic proximity deliberately ignores the cost of reaching a node.
// Great-circle distance handles longitude wrapping without graph preprocessing.
export function prepareProximity(graph: Graph, start: number, goal: number) {
  const begun = performance.now(), rad = Math.PI / 180, n = graph.xy.length / 2
  const potential = new Float64Array(n), gx = graph.xy[goal * 2] / 100000 * rad, gy = graph.xy[goal * 2 + 1] / 100000 * rad
  for (let u = 0; u < n; u++) {
    const x = graph.xy[u * 2] / 100000 * rad, y = graph.xy[u * 2 + 1] / 100000 * rad
    const h = Math.sin((y - gy) / 2) ** 2 + Math.cos(y) * Math.cos(gy) * Math.sin((x - gx) / 2) ** 2
    potential[u] = Math.round(1274201760 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))))
  }
  const record: ProximityHeuristicRecord = { version: 'great-circle-proximity/1', preparationMs: performance.now() - begun, startEstimateCm: potential[start] }
  return { potential, record, ordering: 'greedy' as const }
}
export function greedy(graph: Graph, start: Endpoint, goal: Endpoint, snapMs = 0) {
  return singleFrontSearch(graph, start, goal, snapMs, prepareProximity(graph, start.node, goal.node), true)
}
