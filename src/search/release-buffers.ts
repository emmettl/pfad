/** Release owned scratch storage at a phase boundary, without waiting for GC.
 * Older engines still reclaim the unreachable buffers when the search returns. */
export function releaseBuffers(...views: (ArrayBufferView | undefined)[]) {
  const released = new Set<ArrayBuffer>()
  let bytes = 0
  for (const view of views) {
    if (!view || !(view.buffer instanceof ArrayBuffer) || released.has(view.buffer)) continue
    released.add(view.buffer)
    if (typeof view.buffer.transfer !== 'function') continue
    bytes += view.buffer.byteLength
    view.buffer.transfer(0)
  }
  return bytes
}
