// This clock presents a completed answer; it never advances the search record.
export const ROUTE_DRAW_MS = 2600
export const ROUTE_SETTLE_MS = 700
export class RouteReveal {
  elapsed = 0
  active = false
  visible = false
  start() { this.elapsed = 0; this.active = true; this.visible = true }
  finish() { this.elapsed = ROUTE_DRAW_MS + ROUTE_SETTLE_MS; this.active = false; this.visible = true }
  clear() { this.elapsed = 0; this.active = false; this.visible = false }
  advance(milliseconds: number) {
    if (!this.active) return false
    this.elapsed = Math.min(ROUTE_DRAW_MS + ROUTE_SETTLE_MS, this.elapsed + Math.max(0, milliseconds))
    if (this.elapsed < ROUTE_DRAW_MS + ROUTE_SETTLE_MS) return false
    this.active = false; return true
  }
  sample() {
    const t = Math.min(1, this.elapsed / ROUTE_DRAW_MS)
    return { progress: this.visible ? t * t * (3 - 2 * t) : 0, energy: this.visible ? Math.pow(1 - Math.max(0, this.elapsed - ROUTE_DRAW_MS) / ROUTE_SETTLE_MS, 2) : 0 }
  }
}

interface DrawingChunk { positions: Int16Array | Float32Array; first: number; offsets: Uint32Array }
export class RouteDrawing {
  chunks: DrawingChunk[] = []
  add(positions: Int16Array | Float32Array, roads: Float32Array) {
    if (!roads.length) return
    const first = roads[0], last = roads[roads.length - 1]
    const offsets = new Uint32Array(last - first + 2)
    for (let i = 1; i < roads.length; i++) if (roads[i] !== roads[i - 1]) offsets[roads[i] - first] = i
    offsets[offsets.length - 1] = roads.length
    this.chunks.push({ positions, first, offsets })
  }
  // Return real segment endpoints and normalised road-length positions. A road's
  // original cost is distributed along its simplified shape, in travel direction.
  build(edges: Uint32Array, reversed: Uint8Array, lengths: Uint32Array) {
    const segments: number[] = []
    const total = lengths.reduce((sum, value) => sum + value, 0)
    let travelled = 0
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i], chunk = this.chunks.find(c => edge >= c.first && edge < c.first + c.offsets.length - 1)
      if (!chunk) throw new Error('The chosen route is missing its drawing geometry')
      const begin = chunk.offsets[edge - chunk.first], end = chunk.offsets[edge - chunk.first + 1], p = chunk.positions
      const scale = p instanceof Int16Array ? 32767 : 1
      let shapeLength = 0
      for (let v = begin; v < end; v += 2) shapeLength += Math.hypot(p[v * 2 + 2] - p[v * 2], p[v * 2 + 3] - p[v * 2 + 1])
      let along = 0
      for (let s = 0; s < (end - begin) / 2; s++) {
        const v = reversed[i] ? end - 2 - s * 2 : begin + s * 2
        const a = reversed[i] ? v + 1 : v, b = reversed[i] ? v : v + 1
        const distance = Math.hypot(p[b * 2] - p[a * 2], p[b * 2 + 1] - p[a * 2 + 1])
        const from = total > 0 ? (travelled + lengths[i] * (shapeLength > 0 ? along / shapeLength : 0)) / total : 0
        along += distance
        const to = total > 0 ? (travelled + lengths[i] * (shapeLength > 0 ? along / shapeLength : 1)) / total : 1
        if (distance > 0) segments.push(p[a * 2] / scale, p[a * 2 + 1] / scale, p[b * 2] / scale, p[b * 2 + 1] / scale, from, to)
      }
      travelled += lengths[i]
    }
    return Float32Array.from(segments)
  }
}
