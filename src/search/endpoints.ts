import { releaseBuffers } from './release-buffers.ts'
import type { Endpoint, Graph, Point, SnappingRecord } from './contracts.ts'

const metresPerDegree = 111195.0802, maximumSnapMetres = 2000
const indexes = new WeakMap<Graph, { eligible: Uint8Array; component: Uint32Array }>()

function index(graph: Graph) {
  const cached = indexes.get(graph)
  if (cached) return cached
  const n = graph.xy.length / 2
  const component = Uint32Array.from({ length: n }, (_, i) => i), rank = new Uint8Array(n), eligible = new Uint8Array(n)
  function root(node: number): number {
    while (component[node] !== node) { component[node] = component[component[node]]; node = component[node] }
    return node
  }
  for (let e = 0; e < graph.from.length; e++) {
    const from = graph.from[e], to = graph.to[e]
    if (graph.category[e] <= 11) { eligible[from] = 1; eligible[to] = 1 }
    let u = root(from), v = root(to)
    if (u === v) continue
    if (rank[u] < rank[v]) [u, v] = [v, u]
    component[v] = u
    if (rank[u] === rank[v]) rank[u]++
  }
  for (let i = 0; i < n; i++) {
    component[i] = root(i)
    if (!graph.incoming[i] || graph.offsets[i] === graph.offsets[i + 1]) eligible[i] = 0
  }
  releaseBuffers(rank)
  const result = { eligible, component }; indexes.set(graph, result)
  return result
}

function candidates(graph: Graph, point: Point, lookup: ReturnType<typeof index>): Map<number, Endpoint> {
  const choices = new Map<number, Endpoint>(), scale = Math.cos(point.lat * Math.PI / 180)
  const limit = (maximumSnapMetres / metresPerDegree) ** 2
  for (let i = 0; i < lookup.eligible.length; i++) {
    if (!lookup.eligible[i]) continue
    const lon = graph.xy[i * 2] / 100000, lat = graph.xy[i * 2 + 1] / 100000
    const dx = (lon - point.lon) * scale, dy = lat - point.lat, distance = dx * dx + dy * dy
    if (!(distance <= limit)) continue
    const snapMetres = Math.sqrt(distance) * metresPerDegree, group = lookup.component[i]
    const previous = choices.get(group)
    // Ascending node iteration retains the lower ID for equal distances.
    if (!previous || snapMetres < previous.snapMetres) choices.set(group, { ...point, node: i, lon, lat, snapMetres })
  }
  if (!choices.size) throw new Error(`No road within 2 km of ${point.name}. Choose a point closer to the network.`)
  return choices
}

function nearest(choices: Map<number, Endpoint>): Endpoint {
  return [...choices.values()].reduce((a, b) => b.snapMetres < a.snapMetres || (b.snapMetres === a.snapMetres && b.node < a.node) ? b : a)
}

export function snapEndpoints(graph: Graph, start: Point, goal: Point): { start: Endpoint; goal: Endpoint; snapMs: number; snapping: SnappingRecord } {
  const begun = performance.now(), lookup = index(graph)
  const origins = candidates(graph, start, lookup), destinations = candidates(graph, goal, lookup)
  let source = nearest(origins), target = nearest(destinations), best = Infinity, tieLow = Infinity, tieHigh = Infinity
  for (const [group, a] of origins) {
    const b = destinations.get(group)
    if (!b) continue
    const distance = a.snapMetres + b.snapMetres, low = Math.min(a.node, b.node), high = Math.max(a.node, b.node)
    // A symmetric tie-break preserves the snapped pair when a journey is reversed.
    if (distance < best || (distance === best && (low < tieLow || (low === tieLow && high < tieHigh)))) {
      source = a; target = b; best = distance; tieLow = low; tieHigh = high
    }
  }
  // Weak connectivity only selects nearby roads. The real directed search still
  // decides reachability, including when there is no shared nearby component.
  return { start: source, goal: target, snapMs: performance.now() - begun,
    snapping: { version: 'nearby-shared-component/1', requestedStart: { ...start }, requestedGoal: { ...goal } } }
}

export function snapSources(graph: Graph, points: [Point, Point, Point]) {
  const begun = performance.now(), lookup = index(graph), choices = points.map(point => candidates(graph, point, lookup))
  let sources = choices.map(nearest), best = Infinity
  for (const [group, first] of choices[0]) {
    const second = choices[1].get(group), third = choices[2].get(group)
    if (!second || !third) continue
    const total = first.snapMetres + second.snapMetres + third.snapMetres
    if (total < best || (total === best && first.node < sources[0].node)) { best = total; sources = [first, second, third] }
  }
  return { sources: sources as [Endpoint, Endpoint, Endpoint], snapMs: performance.now() - begun }
}

// One-shot phone workers no longer need the snapping index after endpoints
// are selected. Reusable workers keep it for subsequent journeys.
export function releaseEndpointIndex(graph: Graph) {
  const lookup = indexes.get(graph)
  if (!lookup) return 0
  indexes.delete(graph)
  return releaseBuffers(lookup.eligible, lookup.component)
}
