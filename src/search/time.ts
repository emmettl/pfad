import type { Endpoint, Graph, SearchResult } from './contracts.ts'
import { singleFrontSearch } from './engine.ts'

// Provisional modelling assumptions, not measured averages or legal limits.
export const SPEEDS_KPH: Readonly<Record<string, number>> = Object.freeze({
  motorway: 100, motorway_link: 50, trunk: 80, trunk_link: 40,
  primary: 60, primary_link: 35, secondary: 50, secondary_link: 30,
  tertiary: 40, tertiary_link: 25, unclassified: 35, residential: 25,
  living_street: 10, service: 15, road: 25,
})
export function travelMilliseconds(lengthCentimetres: number, speedKph: number) {
  if (!Number.isFinite(speedKph) || speedKph <= 0) throw new Error('Invalid model speed')
  return Math.max(1, Math.round(lengthCentimetres * 36 / speedKph))
}
export function timeDijkstra(graph: Graph, classes: string[], start: Endpoint, goal: Endpoint, snapMs = 0): SearchResult {
  const speeds = classes.map(name => SPEEDS_KPH[name] ?? 25)
  const cost = (edge: number) => {
    const speed = speeds[graph.category[edge]]
    if (speed === undefined) throw new Error('Road category is missing from the time model')
    return travelMilliseconds(graph.length[edge], speed)
  }
  const result = singleFrontSearch(graph, start, goal, snapMs, undefined, false, cost)
  result.algorithm = 'time-dijkstra/1'
  result.tieBreak = 'modelled milliseconds, then ascending node id; neighbours in compiler arc order'
  result.routeMilliseconds = result.routeMetres === null ? null : result.routeEdges.reduce((sum, edge) => sum + cost(edge), 0)
  result.routeMetres = result.routeMilliseconds === null ? null : result.routeLengths.reduce((sum, cm) => sum + cm, 0) / 100
  result.timeModel = { version: 'road-class-time/1', costUnit: 'millisecond', rounding: 'nearest-ms-minimum-one', speedsKph: { ...SPEEDS_KPH }, fallbackKph: 25,
    assumptions: ['Fixed road-class speeds, equal in both directions', 'No posted limits, traffic, turn or junction delays', 'Existing connectivity profile; driving restrictions are not enforced'] }
  return result
}

/** Supply time costs to cost-aware solvers, then restore physical route geometry. */
export function timeGraph(graph: Graph, classes: string[]) {
  const speeds = classes.map(name => SPEEDS_KPH[name] ?? 25)
  const length = Uint32Array.from(graph.length, (cm, edge) => {
    const speed = speeds[graph.category[edge]]
    if (speed === undefined) throw new Error('Road category is missing from the time model')
    const ms = travelMilliseconds(cm, speed)
    if (ms > 0xffffffff) throw new Error('Time cost exceeds the recording format')
    return ms
  })
  return { ...graph, length }
}
export function annotateTime(result: SearchResult, graph: Graph, weighted: Graph, optimizes: boolean) {
  result.objective = 'time'
  result.routeMilliseconds = result.routeMetres === null ? null : result.routeEdges.reduce((sum, edge) => sum + weighted.length[edge], 0)
  result.routeLengths = Uint32Array.from(result.routeEdges, edge => graph.length[edge])
  result.routeMetres = result.routeMilliseconds === null ? null : result.routeLengths.reduce((sum, cm) => sum + cm, 0) / 100
  result.timeModel = { version: 'road-class-time/1', costUnit: 'millisecond', rounding: 'nearest-ms-minimum-one', speedsKph: { ...SPEEDS_KPH }, fallbackKph: 25,
    assumptions: ['Fixed road-class speeds, equal in both directions', 'No posted limits, traffic, turn or junction delays', 'Existing connectivity profile; driving restrictions are not enforced'] }
  if (optimizes) {
    result.tieBreak = 'integer modelled milliseconds; ' + result.tieBreak.replace(/distance/g, 'cost')
    const preparationMs = result.balancedHeuristic?.preparationMs ?? result.heuristic?.preparationMs
    if (preparationMs !== undefined) result.timeHeuristic = { version: 'feasible-road-class-time/1', unit: 'millisecond', preparationMs }
    result.heuristic = undefined; result.balancedHeuristic = undefined
    if (result.meeting) { result.meeting.candidateMilliseconds = (result.meeting.candidateMetres ?? 0) * 100; result.meeting.candidateMetres = undefined }
    if (result.territories) { result.territories.maximumMilliseconds = (result.territories.maximumMetres ?? 0) * 100; result.territories.maximumMetres = undefined }
  }
  return result
}

/** Estimate only the chosen route in distance mode: no new graph-sized array. */
export function estimateRouteTime(result: SearchResult, graph: Graph, classes: string[]) {
  if (result.sources) return
  result.routeMilliseconds = result.routeMetres === null ? null : result.routeEdges.reduce((sum, edge) => {
    const name = classes[graph.category[edge]]
    if (name === undefined) throw new Error('Road category is missing from the time model')
    return sum + travelMilliseconds(graph.length[edge], SPEEDS_KPH[name] ?? 25)
  }, 0)
  result.timeModel = { version: 'road-class-time/1', costUnit: 'millisecond', rounding: 'nearest-ms-minimum-one', speedsKph: { ...SPEEDS_KPH }, fallbackKph: 25,
    assumptions: ['Fixed road-class speeds, equal in both directions', 'No posted limits, traffic, turn or junction delays', 'Existing connectivity profile; driving restrictions are not enforced'] }
}
