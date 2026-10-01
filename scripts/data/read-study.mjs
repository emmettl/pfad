import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { compileGraph } from '../../src/search/engine.ts'
import { validateManifest } from '../../src/search/manifest.ts'

export async function readStudyGraph() {
  const edition = JSON.parse(await readFile('public/data/pfad-manifest.json', 'utf8'))
  const path = join('public/data', edition.graph.manifest), base = dirname(path)
  const manifest = JSON.parse(await readFile(path, 'utf8')); validateManifest(manifest)
  const n = manifest.counts.nodes, e = manifest.counts.edges
  const xy = new Int32Array(n * 2), from = new Uint32Array(e), to = new Uint32Array(e), length = new Uint32Array(e)
  const direction = new Uint8Array(e), category = new Uint8Array(e)
  for (const chunk of manifest.chunks) {
    if (chunk.kind === 'geometry') continue
    const compressed = await readFile(join(base, chunk.path))
    assert.equal(compressed.length, chunk.bytes)
    assert.equal(createHash('sha256').update(compressed).digest('hex'), chunk.sha256)
    const bytes = gunzipSync(compressed); assert.equal(bytes.length, chunk.decodedBytes)
    if (chunk.kind === 'nodes') {
      let x = 0, y = 0
      for (let i = 0; i < chunk.count; i++) {
        x += bytes.readInt32LE(i * 8); y += bytes.readInt32LE(i * 8 + 4)
        xy[(chunk.start + i) * 2] = x; xy[(chunk.start + i) * 2 + 1] = y
      }
    } else {
      let u = 0
      for (let i = 0; i < chunk.count; i++) {
        const edge = chunk.start + i, p = i * 4; u += bytes.readInt32LE(p)
        from[edge] = u; to[edge] = u + bytes.readInt32LE(chunk.count * 4 + p)
        length[edge] = bytes.readUInt32LE(chunk.count * 8 + p)
        direction[edge] = bytes[chunk.count * 12 + i]; category[edge] = bytes[chunk.count * 13 + i]
      }
    }
  }
  const graph = compileGraph({ xy, from, to, length, direction, category })
  assert.equal(graph.arcTo.length, manifest.counts.directedArcs)
  return { graph, manifest }
}
