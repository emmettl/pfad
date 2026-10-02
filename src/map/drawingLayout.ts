import type { Chunk } from '../search/contracts.ts'
import { firstRoadEvent } from './replayDrawing.ts'

export interface DrawingRoadRange { start: number; count: number }
/** The verified loader emits one drawing per geometry chunk, in manifest order.
 * An unfamiliar layout falls back to decoding; it can never hide a road. */
export function drawingRoadRange(chunk: Chunk | undefined, vertices: number): DrawingRoadRange | undefined {
  if (!chunk || chunk.kind !== 'geometry' || !Number.isInteger(chunk.start) || chunk.start < 0 || !Number.isInteger(chunk.count) || chunk.count < 1) return undefined
  const points = (chunk.decodedBytes - chunk.count * 2) / 8
  if (!Number.isInteger(points) || points < 0 || (points + chunk.count) * 2 !== vertices) return undefined
  return { start: chunk.start, count: chunk.count }
}
export function drawingChunkNeeded(range: DrawingRoadRange | undefined, forward: Uint32Array, backward: Uint32Array | undefined, route: ReadonlySet<number>) {
  if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.count) || range.start < 0 || range.count < 1 || (range.start + range.count) * 2 > forward.length) return true
  const end = range.start + range.count
  for (let road = range.start; road < end; road++) if (firstRoadEvent(road, forward, backward)) return true
  // Keep route geometry independently of replay event selection.
  for (const road of route) if (road >= range.start && road < end) return true
  return false
}
