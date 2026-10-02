/** Exact segment selection and conservative temporal batching for replay.
 * The shader still decides visibility at the original integer event. */
export const REPLAY_BUCKETS = 64
export type RoadIds = Float32Array | Uint32Array
export const SPATIAL_SEGMENTS = 16384
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

/** Partition only examined segments. Cuts assign whole segments by midpoint;
 * endpoint-inclusive bounds retain roads crossing any number of partitions.
 * The shader and temporal buckets keep their original integer event semantics. */
export function prepareSpatialReplayDrawing(positions: Float32Array, roads: RoadIds, forward: Uint32Array, backward: Uint32Array | undefined, events: number, limit = SPATIAL_SEGMENTS) {
  if (!Number.isInteger(limit) || limit < 1 || roads.length % 2 || positions.length !== roads.length * 2) throw new Error('Invalid spatial drawing layout')
  const indices = new Uint32Array(roads.length / 2)
  const buckets = new Uint8Array(indices.length)
  let count = 0
  for (let i = 0; i < roads.length; i += 2) {
    if (roads[i] !== roads[i + 1] || roads[i] * 2 + 1 >= forward.length) throw new Error('Invalid drawing road ID')
    const first = firstRoadEvent(roads[i], forward, backward)
    if (first) {
      indices[count++] = i / 2
      buckets[i / 2] = Math.min(REPLAY_BUCKETS - 1, Math.floor(first / Math.max(1, events) * REPLAY_BUCKETS))
    }
  }
  const batches: ReturnType<typeof prepareReplayDrawing>[] = []
  const midpoint = (index: number, axis: number) => positions[index * 4 + axis] + positions[index * 4 + axis + 2]
  const partition = (begin: number, end: number) => {
    if (end - begin <= limit) {
      const counts = new Uint32Array(REPLAY_BUCKETS), ends = new Uint32Array(REPLAY_BUCKETS), cursors = new Uint32Array(REPLAY_BUCKETS)
      for (let i = begin; i < end; i++) counts[buckets[indices[i]]] += 2
      let vertices = 0
      for (let i = 0; i < counts.length; i++) { cursors[i] = vertices; vertices += counts[i]; ends[i] = vertices }
      const bytes = new ArrayBuffer(vertices * 12), xy = new Float32Array(bytes, 0, vertices * 2)
      const ids: RoadIds = roads instanceof Uint32Array ? new Uint32Array(bytes, vertices * 8, vertices) : new Float32Array(bytes, vertices * 8, vertices)
      let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
      for (let i = begin; i < end; i++) {
        const index = indices[i], b = buckets[index], target = cursors[b]; cursors[b] += 2
        for (let v = 0; v < 2; v++) {
          const x = positions[index * 4 + v * 2], y = positions[index * 4 + v * 2 + 1]
          xy[(target + v) * 2] = x; xy[(target + v) * 2 + 1] = y; ids[target + v] = roads[index * 2 + v]
          left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y)
        }
      }
      batches.push({ bytes, count: vertices, ends, bounds: [left, bottom, right, top] })
      return
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let i = begin; i < end; i++) {
      const x = midpoint(indices[i], 0), y = midpoint(indices[i], 1)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    const axis = maxX - minX >= maxY - minY ? 0 : 1, middle = (begin + end) >>> 1
    // In-place three-way quickselect bounds temporary memory and handles many
    // identical midpoints without quadratic scans or empty partitions.
    let lo = begin, hi = end
    while (hi - lo > 1) {
      const pivot = midpoint(indices[(lo + hi) >>> 1], axis)
      let less = lo, i = lo, greater = hi
      while (i < greater) {
        const value = midpoint(indices[i], axis)
        if (value < pivot) { const swap = indices[less]; indices[less++] = indices[i]; indices[i++] = swap }
        else if (value > pivot) { const swap = indices[--greater]; indices[greater] = indices[i]; indices[i] = swap }
        else i++
      }
      if (middle < less) hi = less
      else if (middle >= greater) lo = greater
      else break
    }
    partition(begin, middle); partition(middle, end)
  }
  if (count) partition(0, count)
  return batches
}
export function replayVertexCount(ends: Uint32Array, event: number, events: number) {
  if (event <= 0) return 0
  return ends[Math.min(ends.length - 1, Math.floor(event / Math.max(1, events) * ends.length))]
}
