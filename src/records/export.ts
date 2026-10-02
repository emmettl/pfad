import type { SearchResult, StudyManifest } from '../search/contracts.ts'
import type { StudyLink } from './link.ts'
import type { AmbientRecord } from '../ambient/sequence.ts'

/** A gzip container with small JSON metadata and exact packed little-endian buffers. */
export async function exportRecord(result: SearchResult, manifest: StudyManifest, presentation: StudyLink, ambient: AmbientRecord[]) {
  const { trace, traceArchive, checkpoints, edgeTimes, edgeSources, focusEvents, focusCoordinates, backwardTimes, goalProximity, routeNodes, routeEdges, routeReversed, routeLengths, ...search } = result
  const arrays = { trace, checkpoints, edgeTimes, edgeSources, focusEvents, focusCoordinates, backwardTimes, goalProximity, routeNodes, routeEdges, routeReversed, routeLengths }
  const buffers: Record<string, { type: string; offset: number; count: number; bytes: number }> = {}
  const plans: { name: string; array: Uint32Array | Int32Array | Uint8Array; padding: number }[] = []
  let offset = 0
  for (const [name, array] of Object.entries(arrays)) {
    if (!array) continue
    const padding = (4 - offset % 4) % 4
    offset += padding
    const archived = name === 'trace' && traceArchive
    const count = archived ? traceArchive.count : array.length, bytes = archived ? traceArchive.bytes : array.byteLength
    buffers[name] = { type: array instanceof Int32Array ? 'int32-le' : array instanceof Uint32Array ? 'uint32-le' : 'uint8', offset, count, bytes }
    plans.push({ name, array, padding }); offset += bytes
  }
  const metadata = new TextEncoder().encode(JSON.stringify({ schema: 'pfad-search-record/1', search, manifest, presentation, ambient,
    attribution: manifest.source.attribution, licence: manifest.source.licence, licenceUrl: manifest.source.licenceUrl,
    clocks: { trace: 'algorithm event order; no per-event processor timestamps', searchMs: 'measured computation for this query', presentation: 'authored replay duration and frame; soundtrack not included' }, buffers }))
  const header = new Uint8Array(12), headerView = new DataView(header.buffer)
  header.set(new TextEncoder().encode('PFADREC1')); headerView.setUint32(8, metadata.byteLength, true)
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1
  const release = traceArchive?.retain()
  async function* chunks() {
    yield header; yield metadata
    for (const { name, array, padding } of plans) {
      if (padding) yield new Uint8Array(padding)
      if (name === 'trace' && traceArchive) {
        for (let i = 0; i < traceArchive.blocks; i++) yield await traceArchive.readBlock(i)
      } else {
        for (let offset = 0; offset < array.byteLength; offset += 8 * 1024 * 1024) {
          const bytes = new Uint8Array(array.buffer as ArrayBuffer, array.byteOffset + offset, Math.min(8 * 1024 * 1024, array.byteLength - offset))
          if (littleEndian || array instanceof Uint8Array) yield bytes
          else {
            const converted = new Uint8Array(bytes.length), view = new DataView(converted.buffer)
            for (let i = 0; i < bytes.length / 4; i++) {
              if (array instanceof Int32Array) view.setInt32(i * 4, array[offset / 4 + i], true)
              else view.setUint32(i * 4, array[offset / 4 + i], true)
            }
            yield converted
          }
        }
      }
    }
  }
  const iterator = chunks()
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) { try { const { value, done } = await iterator.next(); if (done) controller.close(); else controller.enqueue(value) } catch (error) { controller.error(error) } },
    async cancel() { await iterator.return() },
  })
  try { return await new Response(stream.pipeThrough(new CompressionStream('gzip'))).blob() }
  finally { release?.() }

}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  // WebKit needs the URL to outlive the initiating click task.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
