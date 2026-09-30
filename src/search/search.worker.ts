import type { Graph, Reply, Request, StudyManifest } from './contracts.ts'
import { compileGraph, dijkstra, snapEndpoints } from './engine.ts'
import { validateManifest } from './manifest.ts'

let graph: Graph | undefined
let manifest: StudyManifest | undefined
function reply(message: Reply, transfer: Transferable[] = []) { self.postMessage(message, { transfer }) }

async function load(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('The road manifest could not be loaded. Try again.')
  const data = await response.json() as StudyManifest
  validateManifest(data)
  manifest = data
  reply({ type: 'manifest', manifest: data, manifestUrl: url })
  const { nodes, edges } = data.counts
  const xy = new Int32Array(nodes * 2), from = new Uint32Array(edges), to = new Uint32Array(edges), length = new Uint32Array(edges)
  const direction = new Uint8Array(edges), category = new Uint8Array(edges)
  let loaded = 0, vertices = 0
  for (const chunk of data.chunks) {
    reply({ type: 'progress', loaded, total: data.downloadBytes, stage: chunk.kind === 'geometry' ? 'Loading road shapes' : 'Loading the national graph' })
    const response = await fetch(new URL(chunk.path, url))
    if (!response.ok || !response.body) throw new Error('A road chunk could not be loaded. The incomplete graph cannot be searched.')
    const reader = response.body.getReader()
    const compressed = new Uint8Array(chunk.bytes)
    let offset = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (offset + value.length > chunk.bytes) throw new Error('Road chunk size mismatch')
      compressed.set(value, offset); offset += value.length; loaded += value.length
      reply({ type: 'progress', loaded, total: data.downloadBytes, stage: chunk.kind === 'geometry' ? 'Loading road shapes' : 'Loading the national graph' })
    }
    if (offset !== chunk.bytes) throw new Error('Incomplete road chunk')
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', compressed))
    const hash = Array.from(digest, x => x.toString(16).padStart(2, '0')).join('')
    if (hash !== chunk.sha256) throw new Error('Road chunk checksum mismatch')
    const decoded = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    if (decoded.byteLength !== chunk.decodedBytes || (chunk.stride && decoded.byteLength !== chunk.count * chunk.stride)) throw new Error('Invalid road chunk layout')
    if (chunk.kind === 'nodes') {
      if (chunk.start + chunk.count > nodes || chunk.stride !== 8) throw new Error('Invalid node chunk')
      const view = new DataView(decoded)
      let x = 0, y = 0
      for (let i = 0; i < chunk.count; i++) {
        x += view.getInt32(i * 8, true); y += view.getInt32(i * 8 + 4, true)
        xy[(chunk.start + i) * 2] = x; xy[(chunk.start + i) * 2 + 1] = y
      }
    } else if (chunk.kind === 'edges') {
      if (chunk.start + chunk.count > edges || chunk.stride !== 14) throw new Error('Invalid edge chunk')
      const view = new DataView(decoded)
      let u = 0
      for (let i = 0; i < chunk.count; i++) {
        const e = chunk.start + i, p = i * 4
        u += view.getInt32(p, true)
        from[e] = u; to[e] = u + view.getInt32(chunk.count * 4 + p, true); length[e] = view.getUint32(chunk.count * 8 + p, true)
        direction[e] = view.getUint8(chunk.count * 12 + i); category[e] = view.getUint8(chunk.count * 13 + i)
        if (from[e] >= nodes || to[e] >= nodes || direction[e] > 2) throw new Error('Invalid road connection')
      }
    } else {
      if (chunk.start + chunk.count > edges || chunk.stride !== 0) throw new Error('Invalid geometry chunk')
      const view = new DataView(decoded)
      let pointCount = 0
      for (let i = 0; i < chunk.count; i++) pointCount += view.getUint16(i * 2, true)
      if (chunk.count * 2 + pointCount * 8 !== decoded.byteLength) throw new Error('Geometry point count mismatch')
      const count = (pointCount + chunk.count) * 2
      const bytes = new ArrayBuffer(count * 8), output = new DataView(bytes)
      let cursor = chunk.count * 2, vertex = 0
      const projection = data.projection
      const sx = Math.cos(projection.referenceLatitude * Math.PI / 180) * 111195.0802 / projection.scaleMetres
      const sy = 111195.0802 / projection.scaleMetres
      function append(x: number, y: number, e: number) {
        output.setInt16(vertex * 8, Math.round((x / 100000 - projection.centre[0]) * sx * 32767), true)
        output.setInt16(vertex * 8 + 2, Math.round((y / 100000 - projection.centre[1]) * sy * 32767), true)
        output.setUint32(vertex * 8 + 4, e, true); vertex++
      }
      for (let i = 0; i < chunk.count; i++) {
        const e = chunk.start + i
        let x = xy[from[e] * 2], y = xy[from[e] * 2 + 1]
        for (let j = 0; j < view.getUint16(i * 2, true); j++) {
          const nextX = x + view.getInt32(cursor, true), nextY = y + view.getInt32(cursor + 4, true); cursor += 8
          append(x, y, e); append(nextX, nextY, e); x = nextX; y = nextY
        }
        append(x, y, e); append(xy[to[e] * 2], xy[to[e] * 2 + 1], e)
      }
      reply({ type: 'geometry', start: vertices, count, bytes }, [bytes]); vertices += count
    }
  }
  graph = compileGraph({ xy, from, to, length, direction, category })
  if (vertices !== data.counts.vertices) throw new Error('Drawing geometry mismatch')
  if (graph.arcTo.length !== data.counts.directedArcs) throw new Error('Road connectivity mismatch')
  reply({ type: 'ready' })
}

self.addEventListener('message', async (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    if (request.type === 'load') await load(request.manifestUrl)
    else {
      if (!graph || !manifest) throw new Error('The national graph has not finished loading')
      const endpoints = snapEndpoints(graph, request.start, request.goal)
      const result = dijkstra(graph, endpoints.start, endpoints.goal, endpoints.snapMs)
      result.dataset = { identity: manifest.identity, compiler: manifest.compiler, profile: manifest.profile, sourceSha256: manifest.source.sha256, sourceTimestamp: manifest.source.dataTimestamp }
      reply({ type: 'result', requestId: request.requestId, result }, [result.trace.buffer, result.checkpoints.buffer, result.edgeTimes.buffer, result.routeNodes.buffer, result.routeEdges.buffer, result.routeReversed.buffer, result.routeLengths.buffer])
    }
  } catch (error) {
    reply({ type: 'error', requestId: request.type === 'search' ? request.requestId : undefined, message: error instanceof Error ? error.message : 'The search could not be completed' })
  }
})
