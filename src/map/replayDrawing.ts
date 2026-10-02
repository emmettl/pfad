/** Exact segment selection and conservative temporal batching for replay.
 * The shader still decides visibility at the original integer event. */
export const REPLAY_BUCKETS = 64
export type RoadIds = Float32Array | Uint32Array
export function firstRoadEvent(edge: number, forward: Uint32Array, backward?: Uint32Array) {
  const a = forward[edge * 2], b = backward?.[edge * 2] ?? 0
  return a && b ? Math.min(a, b) : a || b
}
export function prepareReplayDrawing(positions: Float32Array, roads: RoadIds, forward: Uint32Array, backward: Uint32Array | undefined, events: number) {
  if (roads.length % 2 || positions.length !== roads.length * 2) throw new Error('Invalid drawing segments')
  const counts = new Uint32Array(REPLAY_BUCKETS)
  const bucket = (event: number) => Math.min(REPLAY_BUCKETS - 1, Math.floor(event / Math.max(1, events) * REPLAY_BUCKETS))
  for (let i = 0; i < roads.length; i += 2) {
    if (roads[i] !== roads[i + 1] || roads[i] * 2 + 1 >= forward.length) throw new Error('Invalid drawing road ID')
    const first = firstRoadEvent(roads[i], forward, backward)
    if (first) counts[bucket(first)] += 2
  }
  const ends = new Uint32Array(REPLAY_BUCKETS), cursors = new Uint32Array(REPLAY_BUCKETS)
  let count = 0
  for (let i = 0; i < counts.length; i++) { cursors[i] = count; count += counts[i]; ends[i] = count }
  const bytes = new ArrayBuffer(count * 12)
  const selectedPositions = new Float32Array(bytes, 0, count * 2)
  const selectedRoads: RoadIds = roads instanceof Uint32Array ? new Uint32Array(bytes, count * 8, count) : new Float32Array(bytes, count * 8, count)
  let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity
  for (let i = 0; i < roads.length; i += 2) {
    const first = firstRoadEvent(roads[i], forward, backward)
    if (!first) continue
    const index = bucket(first), target = cursors[index]; cursors[index] += 2
    for (let v = 0; v < 2; v++) {
      const x = positions[(i + v) * 2], y = positions[(i + v) * 2 + 1]
      selectedPositions[(target + v) * 2] = x; selectedPositions[(target + v) * 2 + 1] = y
      selectedRoads[target + v] = roads[i + v]
      left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y)
    }
  }
  return { bytes, count, ends, bounds: [left, bottom, right, top] as const }
}
export function replayVertexCount(ends: Uint32Array, event: number, events: number) {
  if (event <= 0) return 0
  return ends[Math.min(ends.length - 1, Math.floor(event / Math.max(1, events) * ends.length))]
}
