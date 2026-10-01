/** Lossless differences between consecutive Float32 bit patterns, then gzip.
 * Coordinates and road IDs are restored bit-for-bit, without quantisation. */
export async function packDrawing(bytes: ArrayBuffer, count: number) {
  if (bytes.byteLength !== count * 12) throw new Error('Drawing geometry size mismatch')
  const words = new Uint32Array(bytes)
  let x = 0, y = 0, road = 0
  for (let i = 0; i < count; i++) {
    const nextX = words[i * 2], nextY = words[i * 2 + 1], nextRoad = words[count * 2 + i]
    words[i * 2] = nextX - x; words[i * 2 + 1] = nextY - y; words[count * 2 + i] = nextRoad - road
    x = nextX; y = nextY; road = nextRoad
  }
  return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
}
export async function unpackDrawing(compressed: ArrayBuffer, count: number) {
  const bytes = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  if (bytes.byteLength !== count * 12) throw new Error('Stored drawing geometry size mismatch')
  const words = new Uint32Array(bytes)
  let x = 0, y = 0, road = 0
  for (let i = 0; i < count; i++) {
    x = (x + words[i * 2]) >>> 0; y = (y + words[i * 2 + 1]) >>> 0; road = (road + words[count * 2 + i]) >>> 0
    words[i * 2] = x; words[i * 2 + 1] = y; words[count * 2 + i] = road
  }
  return bytes
}
