import { packDrawing } from '../map/drawing-codec.ts'
import { longitudeOffset } from './projection.ts'
import type { Graph, Reply, Request, StudyManifest } from './contracts.ts'
import { compileGraph, dijkstra, snapEndpoints } from './engine.ts'
import { bidirectional, compileReverse, type ReverseGraph } from './bidirectional.ts'
import { multisource } from './multisource.ts'
import { snapSources } from './endpoints.ts'
import { breadthFirst } from './breadth-first.ts'
import { depthFirst } from './depth-first.ts'
import { greedy } from './greedy.ts'
import { astar } from './astar.ts'
import { validateManifest, manifestIdentityPayload } from './manifest.ts'
import { loadChunks, sha256 } from './chunks.ts'

let graph: Graph | undefined
let manifest: StudyManifest | undefined
let reverse: ReverseGraph | undefined
function reply(message: Reply, transfer: Transferable[] = []) { self.postMessage(message, { transfer }) }

async function load(url: string, expectedIdentity?: string, topologyOnly = false, compactDrawing = false) {
  const opened = performance.now()
  const response = await fetch(url)
  if (!response.ok) throw new Error('The road manifest could not be loaded. Try again.')
  const data = await response.json() as StudyManifest
  validateManifest(data)
  if (expectedIdentity && data.identity !== expectedIdentity) throw new Error('The road record differs from the selected release')
  if (await sha256(manifestIdentityPayload(data)) !== data.identity) throw new Error('Road manifest content identity mismatch')
  manifest = data
  reply({ type: 'manifest', manifest: data, manifestUrl: url })
  const { nodes, edges } = data.counts
  const xy = new Int32Array(nodes * 2), from = new Uint32Array(edges), to = new Uint32Array(edges), length = new Uint32Array(edges)
  const direction = new Uint8Array(edges), category = new Uint8Array(edges)
  let vertices = 0
  const measurements = await loadChunks(data, url,
    (loaded, stage) => reply({ type: 'progress', loaded, total: data.downloadBytes, stage }),
    async (chunk, decoded) => {
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
        const bytes = new ArrayBuffer(count * 12)
        const positions = new Float32Array(bytes, 0, count * 2), roads = data.counts.edges > 16777216 ? new Uint32Array(bytes, count * 8, count) : new Float32Array(bytes, count * 8, count)
        let cursor = chunk.count * 2, vertex = 0
        const projection = data.projection
        const sx = Math.cos(projection.referenceLatitude * Math.PI / 180) * 111195.0802 / projection.scaleMetres
        const sy = 111195.0802 / projection.scaleMetres
        function append(x: number, y: number, e: number) {
          positions[vertex * 2] = longitudeOffset(x / 100000, projection.centre[0], projection.longitudeWrapping === 'centre/1') * sx
          positions[vertex * 2 + 1] = (y / 100000 - projection.centre[1]) * sy
          roads[vertex++] = e
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
        const drawing = compactDrawing ? await packDrawing(bytes, count) : bytes
        reply({ type: 'geometry', start: vertices, count, bytes: drawing, drawingEncoding: compactDrawing ? 'float32-delta-gzip/1' : undefined }, [drawing]); vertices += count
      }
  }, topologyOnly)
  reply({ type: 'progress', loaded: data.downloadBytes, total: data.downloadBytes, stage: 'Preparing road connections' })
  const compiling = performance.now()
  const complete = compileGraph({ xy, from, to, length, direction, category })
  reverse = undefined
  if (!topologyOnly && vertices !== data.counts.vertices) throw new Error('Drawing geometry mismatch')
  if (complete.arcTo.length !== data.counts.directedArcs) throw new Error('Road connectivity mismatch')
  graph = complete
  measurements.compileMs = performance.now() - compiling
  measurements.totalMs = performance.now() - opened
  reply({ type: 'ready', measurements })
}

self.addEventListener('message', async (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    if (request.type === 'load') await load(request.manifestUrl, request.expectedIdentity, request.topologyOnly, request.compactDrawing)
    else {
      if (!graph || !manifest) throw new Error('The national graph has not finished loading')
      if (request.algorithm === 'multisource' && !request.sources) throw new Error('Three sources are required for a territory study')
      const sourceEndpoints = request.sources ? snapSources(graph, request.sources) : undefined
      const endpoints = sourceEndpoints ? { start: sourceEndpoints.sources[0], goal: sourceEndpoints.sources[1], snapMs: sourceEndpoints.snapMs, snapping: undefined } : snapEndpoints(graph, request.start, request.goal)
      if (request.algorithm === 'bidirectional' || request.algorithm === 'astar' || request.algorithm === 'bidirectional-astar') reverse ??= compileReverse(graph)
      const result = request.algorithm === 'multisource' && sourceEndpoints ? multisource(graph, sourceEndpoints.sources, sourceEndpoints.snapMs) : (request.algorithm === 'bidirectional' || request.algorithm === 'bidirectional-astar') && reverse
        ? bidirectional(graph, reverse, endpoints.start, endpoints.goal, endpoints.snapMs, request.algorithm === 'bidirectional-astar')
        : request.algorithm === 'astar' && reverse ? astar(graph, reverse, endpoints.start, endpoints.goal, endpoints.snapMs)
          : request.algorithm === 'breadth-first' ? breadthFirst(graph, endpoints.start, endpoints.goal, endpoints.snapMs) : request.algorithm === 'depth-first' ? depthFirst(graph, endpoints.start, endpoints.goal, endpoints.snapMs) : request.algorithm === 'greedy' ? greedy(graph, endpoints.start, endpoints.goal, endpoints.snapMs) : dijkstra(graph, endpoints.start, endpoints.goal, endpoints.snapMs)
      result.dataset = { identity: manifest.identity, compiler: manifest.compiler, profile: manifest.profile, sourceSha256: manifest.source.sha256, sourceTimestamp: manifest.source.dataTimestamp }
      result.snapping = endpoints.snapping
      if (sourceEndpoints) { result.requestedSources = request.sources; result.sourceSnappingVersion = 'nearby-shared-three-source-component/1' }
      reply({ type: 'result', requestId: request.requestId, result }, [result.trace.buffer, result.checkpoints.buffer, result.edgeTimes.buffer, result.routeNodes.buffer, result.routeEdges.buffer, result.routeReversed.buffer, result.routeLengths.buffer, ...(result.backwardTimes ? [result.backwardTimes.buffer] : []), ...(result.focusEvents ? [result.focusEvents.buffer] : []), ...(result.focusCoordinates ? [result.focusCoordinates.buffer] : []), ...(result.edgeSources ? [result.edgeSources.buffer] : []), ...(result.goalProximity ? [result.goalProximity.buffer] : [])])
    }
  } catch (error) {
    reply({ type: 'error', requestId: request.type === 'search' ? request.requestId : undefined, message: error instanceof Error ? error.message : 'The search could not be completed' })
  }
})
