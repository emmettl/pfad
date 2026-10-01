import type { StudyManifest } from './contracts.ts'

// Bounds cover UK-sized graphs. Larger releases require another measured budget.
// Road IDs must remain exact in the Float32 vertex attribute (< 2^24).
export const DATA_LIMITS = { nodes: 10000000, edges: 16000000, directedArcs: 32000000, vertices: 64000000, downloadBytes: 256 * 1024 * 1024 }
const positive = (n: number) => Number.isSafeInteger(n) && n > 0
export function validateManifest(data: StudyManifest) {
  if (data.schema !== 'pfad-road-study/1' || data.encoding !== 'le-columnar-deltas/1' || data.coordinateScale !== 100000 || !/^[a-f0-9]{64}$/.test(data.identity)) throw new Error('Unsupported road dataset')
  for (const key of ['nodes', 'edges', 'directedArcs', 'vertices'] as const) if (!positive(data.counts[key]) || data.counts[key] > DATA_LIMITS[key]) throw new Error('Road dataset exceeds the measured browser budget')
  if (!positive(data.downloadBytes) || data.downloadBytes > DATA_LIMITS.downloadBytes || data.chunks.length > 1000) throw new Error('Road download exceeds the browser budget')
  const p = data.projection
  if (!p || !p.centre.every(Number.isFinite) || !Number.isFinite(p.referenceLatitude) || !Number.isFinite(p.scaleMetres) || p.scaleMetres <= 0 || !data.bounds.every(Number.isFinite)) throw new Error('Invalid road projection')
  const covered = { nodes: 0, edges: 0, geometry: 0 }
  const order = { nodes: 0, edges: 1, geometry: 2 }
  const paths = new Set<string>()
  let phase = 0, bytes = 0
  for (const chunk of data.chunks) {
    if (!(chunk.kind in covered) || order[chunk.kind] < phase || chunk.start !== covered[chunk.kind] || !positive(chunk.count) || !positive(chunk.bytes) || chunk.bytes > 8 * 1024 * 1024 || !positive(chunk.decodedBytes) || chunk.decodedBytes > 32 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(chunk.sha256) || !/^[a-z0-9-]+\.bin\.gz\.bin$/.test(chunk.path) || paths.has(chunk.path)) throw new Error('Invalid road chunk coverage')
    if ((chunk.kind === 'nodes' && chunk.stride !== 8) || (chunk.kind === 'edges' && chunk.stride !== 14) || (chunk.kind === 'geometry' && chunk.stride !== 0) || (chunk.stride && chunk.decodedBytes !== chunk.count * chunk.stride)) throw new Error('Invalid road chunk layout')
    paths.add(chunk.path); phase = order[chunk.kind]; covered[chunk.kind] += chunk.count; bytes += chunk.bytes
  }
  if (covered.nodes !== data.counts.nodes || covered.edges !== data.counts.edges || covered.geometry !== data.counts.edges || bytes !== data.downloadBytes) throw new Error('Incomplete road manifest. The complete graph is required.')
}

// Match the compiler's sorted JSON identity payload; don't trust a manifest's
// claimed identity if its chunk table or projection was accidentally replaced.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`
  }
  const encoded = JSON.stringify(value)
  if (encoded === undefined) throw new Error('Invalid identity payload')
  return encoded
}
export function manifestIdentityPayload(data: StudyManifest) {
  return new TextEncoder().encode(canonical({ chunks: data.chunks, projection: data.projection, profile: data.profile }))
}
