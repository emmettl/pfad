import type { SearchResult } from '../search/contracts.ts'

type Events = Pick<SearchResult, 'edgeTimes' | 'backwardTimes' | 'edgeSources' | 'goalProximity' | 'textureWidth' | 'textureHeight'>
export function prepareReplayTextures(result: Events) {
  const { edgeTimes, backwardTimes, edgeSources, goalProximity } = result
  const dense = { forward: edgeTimes, backward: backwardTimes, sources: edgeSources, proximity: goalProximity, width: result.textureWidth, height: result.textureHeight, lookup: undefined as Uint32Array | undefined }
  const rows = edgeTimes.length / 2
  if (rows < 4096) return dense
  let reached = 0
  for (let edge = 0; edge < rows; edge++) if (edgeTimes[edge * 2] || backwardTimes?.[edge * 2]) reached++
  // Keep dense storage for broad searches. This bounds the extra compact CPU
  // copy below half the original texture allocation; exports keep full arrays.
  if (reached * 2 >= rows) return dense
  const width = Math.min(2048, Math.max(1, reached)), height = Math.max(1, Math.ceil(reached / width)), capacity = width * height
  const lookup = new Uint32Array(rows), forward = new Uint32Array(capacity * 2)
  const backward = backwardTimes ? new Uint32Array(capacity * 2) : undefined
  const sources = edgeSources ? new Uint8Array(capacity) : undefined
  const proximity = goalProximity ? new Uint8Array(capacity) : undefined
  let next = 0
  for (let edge = 0; edge < rows; edge++) {
    if (!edgeTimes[edge * 2] && !backwardTimes?.[edge * 2]) continue
    lookup[edge] = next
    forward[next * 2] = edgeTimes[edge * 2]; forward[next * 2 + 1] = edgeTimes[edge * 2 + 1]
    if (backward && backwardTimes) { backward[next * 2] = backwardTimes[edge * 2]; backward[next * 2 + 1] = backwardTimes[edge * 2 + 1] }
    if (sources && edgeSources) sources[next] = edgeSources[edge]
    if (proximity && goalProximity) proximity[next] = goalProximity[edge]
    next++
  }
  return { forward, backward, sources, proximity, width, height, lookup }
}
export type ReplayTextures = ReturnType<typeof prepareReplayTextures>
export function replayTextureBytes(textures: ReplayTextures) {
  return textures.forward.byteLength + (textures.backward?.byteLength ?? 0) + (textures.sources?.byteLength ?? 0) + (textures.proximity?.byteLength ?? 0)
}
