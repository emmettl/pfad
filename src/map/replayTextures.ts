import type { SearchResult } from '../search/contracts.ts'

type Events = Pick<SearchResult, 'edgeTimes' | 'backwardTimes' | 'edgeSources' | 'goalProximity' | 'textureWidth' | 'textureHeight'>
function denseTextures(result: Events) {
  return { forward: result.edgeTimes, backward: result.backwardTimes, sources: result.edgeSources, proximity: result.goalProximity, width: result.textureWidth, height: result.textureHeight, lookup: undefined as Uint32Array | undefined }
}
export type ReplayTextures = ReturnType<typeof denseTextures>
function countReached(result: Events, start: number, end: number) {
  const { edgeTimes, backwardTimes } = result
  let reached = 0
  for (let edge = start; edge < end; edge++) if (edgeTimes[edge * 2] || backwardTimes?.[edge * 2]) reached++
  return reached
}
function shouldCompact(rows: number, reached: number) {
  const width = Math.min(2048, Math.max(1, reached))
  return width * Math.max(1, Math.ceil(reached / width)) * 2 < rows
}
function allocateTextures(result: Events, reached: number): ReplayTextures {
  const width = Math.min(2048, Math.max(1, reached)), height = Math.max(1, Math.ceil(reached / width)), capacity = width * height
  return { forward: new Uint32Array(capacity * 2), backward: result.backwardTimes ? new Uint32Array(capacity * 2) : undefined, sources: result.edgeSources ? new Uint8Array(capacity) : undefined, proximity: result.goalProximity ? new Uint8Array(capacity) : undefined, width, height, lookup: new Uint32Array(result.edgeTimes.length / 2) }
}
function copyReached(result: Events, textures: ReplayTextures, start: number, end: number, next: number) {
  const { edgeTimes, backwardTimes, edgeSources, goalProximity } = result
  const { forward, backward, sources, proximity, lookup } = textures
  for (let edge = start; edge < end; edge++) {
    if (!edgeTimes[edge * 2] && !backwardTimes?.[edge * 2]) continue
    lookup![edge] = next
    forward[next * 2] = edgeTimes[edge * 2]; forward[next * 2 + 1] = edgeTimes[edge * 2 + 1]
    if (backward && backwardTimes) { backward[next * 2] = backwardTimes[edge * 2]; backward[next * 2 + 1] = backwardTimes[edge * 2 + 1] }
    if (sources && edgeSources) sources[next] = edgeSources[edge]
    if (proximity && goalProximity) proximity[next] = goalProximity[edge]
    next++
  }
  return next
}
export function prepareReplayTextures(result: Events, compact = true) {
  const rows = result.edgeTimes.length / 2
  if (!compact || rows < 4096) return denseTextures(result)
  const reached = countReached(result, 0, rows)
  // Keep dense storage for broad searches. This bounds the extra compact CPU
  // copy below half the original texture allocation; exports keep full arrays.
  if (!shouldCompact(rows, reached)) return denseTextures(result)
  const textures = allocateTextures(result, reached)
  copyReached(result, textures, 0, rows, 0)
  return textures
}
/** Keep national scans responsive without putting yields in the hot loops. */
export async function prepareReplayTexturesAsync(result: Events) {
  const rows = result.edgeTimes.length / 2, block = 262144
  if (rows < 4096) return denseTextures(result)
  let reached = 0, yielded = performance.now()
  for (let start = 0; start < rows; start += block) {
    reached += countReached(result, start, Math.min(rows, start + block))
    if (performance.now() - yielded >= 8) { await new Promise<void>(resolve => setTimeout(resolve, 0)); yielded = performance.now() }
  }
  if (!shouldCompact(rows, reached)) return denseTextures(result)
  const textures = allocateTextures(result, reached)
  let next = 0
  for (let start = 0; start < rows; start += block) {
    next = copyReached(result, textures, start, Math.min(rows, start + block), next)
    if (performance.now() - yielded >= 8) { await new Promise<void>(resolve => setTimeout(resolve, 0)); yielded = performance.now() }
  }
  return textures
}
export function replayTextureBytes(textures: ReplayTextures) {
  return textures.forward.byteLength + (textures.backward?.byteLength ?? 0) + (textures.sources?.byteLength ?? 0) + (textures.proximity?.byteLength ?? 0)
}
