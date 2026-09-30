import type { StudyManifest } from './contracts.ts'

export function validateManifest(data: StudyManifest) {
  if (data.schema !== 'pfad-road-study/1' || data.encoding !== 'le-columnar-deltas/1' || data.coordinateScale !== 100000 || data.counts.nodes > 2000000 || data.counts.edges > 2500000) throw new Error('Unsupported road dataset')
  const covered = { nodes: 0, edges: 0, geometry: 0 }
  const order = { nodes: 0, edges: 1, geometry: 2 }
  let phase = 0, bytes = 0
  for (const chunk of data.chunks) {
    if (!(chunk.kind in covered) || order[chunk.kind] < phase || chunk.start !== covered[chunk.kind] || !Number.isSafeInteger(chunk.count) || chunk.count <= 0 || !Number.isSafeInteger(chunk.bytes) || chunk.bytes <= 0 || !/^[a-f0-9]{64}$/.test(chunk.sha256)) throw new Error('Invalid road chunk coverage')
    phase = order[chunk.kind]; covered[chunk.kind] += chunk.count; bytes += chunk.bytes
  }
  if (covered.nodes !== data.counts.nodes || covered.edges !== data.counts.edges || covered.geometry !== data.counts.edges || bytes !== data.downloadBytes) throw new Error('Incomplete road manifest. The complete graph is required.')
}
