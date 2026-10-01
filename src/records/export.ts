import type { SearchResult, StudyManifest } from '../search/contracts.ts'
import type { StudyLink } from './link.ts'
import type { AmbientRecord } from '../ambient/sequence.ts'

/** A gzip container with small JSON metadata and exact packed little-endian buffers. */
export async function exportRecord(result: SearchResult, manifest: StudyManifest, presentation: StudyLink, ambient: AmbientRecord[]) {
  const { trace, checkpoints, edgeTimes, edgeSources, backwardTimes, goalProximity, routeNodes, routeEdges, routeReversed, routeLengths, ...search } = result
  const arrays = { trace, checkpoints, edgeTimes, edgeSources, backwardTimes, goalProximity, routeNodes, routeEdges, routeReversed, routeLengths }
  const parts: BlobPart[] = [], buffers: Record<string, { type: string; offset: number; count: number; bytes: number }> = {}
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1
  let offset = 0
  for (const [name, array] of Object.entries(arrays)) {
    if (!array) continue
    const padding = (4 - offset % 4) % 4
    if (padding) { parts.push(new Uint8Array(padding)); offset += padding }
    const wide = array instanceof Uint32Array
    buffers[name] = { type: wide ? 'uint32-le' : 'uint8', offset, count: array.length, bytes: array.byteLength }
    if (!wide || littleEndian) parts.push(new Uint8Array(array.buffer as ArrayBuffer, array.byteOffset, array.byteLength))
    else {
      const bytes = new Uint8Array(array.byteLength), view = new DataView(bytes.buffer)
      for (let i = 0; i < array.length; i++) view.setUint32(i * 4, array[i], true)
      parts.push(bytes)
    }
    offset += array.byteLength
  }
  const metadata = new TextEncoder().encode(JSON.stringify({ schema: 'pfad-search-record/1', search, manifest, presentation, ambient,
    attribution: manifest.source.attribution, licence: manifest.source.licence, licenceUrl: manifest.source.licenceUrl,
    clocks: { trace: 'algorithm event order; no per-event processor timestamps', searchMs: 'measured computation for this query', presentation: 'authored replay duration and frame; soundtrack not included' }, buffers }))
  const header = new Uint8Array(12), headerView = new DataView(header.buffer)
  header.set(new TextEncoder().encode('PFADREC1')); headerView.setUint32(8, metadata.byteLength, true)
  const blob = new Blob([header, metadata, ...parts])
  return new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob()
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  // WebKit needs the URL to outlive the initiating click task.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
