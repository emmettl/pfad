import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { validateManifest } from '../src/search/manifest.ts'
const edition = JSON.parse(readFileSync('public/data/pfad-manifest.json', 'utf8'))
const path = join('public/data', edition.graph.manifest), base = dirname(path)
const manifest = JSON.parse(readFileSync(path, 'utf8'))
test('the study identifies its source and model without claiming driving validation', () => {
  assert.equal(edition.status, 'study'); assert.equal(edition.evidence.productionRoutingValidated, false)
  assert.equal(manifest.identity, edition.graph.identity); assert.equal(manifest.source.sha256, edition.source.sha256)
  assert.equal(manifest.source.licence, 'ODbL-1.0'); assert.match(manifest.limitations.join(' '), /[Tt]urn/)
  assert.match(manifest.compiler, /\/1$/)
})
test('chunks cover every node, edge and shape and match their content hashes', () => {
  validateManifest(manifest)
  const ends = { nodes: 0, edges: 0, geometry: 0 }
  let bytes = 0, vertices = 0, arcs = 0
  for (const chunk of manifest.chunks) {
    assert.equal(chunk.start, ends[chunk.kind]); ends[chunk.kind] += chunk.count
    const compressed = readFileSync(join(base, chunk.path)), decoded = gunzipSync(compressed)
    assert.equal(compressed.length, chunk.bytes); assert.equal(decoded.length, chunk.decodedBytes)
    assert.equal(createHash('sha256').update(compressed).digest('hex'), chunk.sha256)
    assert.ok(chunk.decodedBytes < 25 * 1024 * 1024)
    if (chunk.kind === 'geometry') for (let i = 0; i < chunk.count; i++) vertices += (decoded.readUInt16LE(i * 2) + 1) * 2
    if (chunk.kind === 'edges') for (let i = 0; i < chunk.count; i++) arcs += decoded[chunk.count * 12 + i] === 0 ? 2 : 1
    bytes += compressed.length
  }
  assert.deepEqual(ends, { nodes: manifest.counts.nodes, edges: manifest.counts.edges, geometry: manifest.counts.edges })
  assert.equal(vertices, manifest.counts.vertices); assert.equal(arcs, manifest.counts.directedArcs)
  assert.equal(bytes, manifest.downloadBytes); assert.ok(bytes <= 17 * 1024 * 1024)
  const evidence = readFileSync(join(base, manifest.evidence.path))
  assert.equal(createHash('sha256').update(evidence).digest('hex'), manifest.evidence.sha256)
})
test('omitted, overlapping or out-of-order chunks cannot silently truncate the graph', () => {
  const missing = structuredClone(manifest); missing.chunks.splice(1, 1)
  assert.throws(() => validateManifest(missing), /coverage|complete/)
  const overlap = structuredClone(manifest); overlap.chunks[1].start--
  assert.throws(() => validateManifest(overlap), /coverage/)
  const reordered = structuredClone(manifest); reordered.chunks.reverse()
  assert.throws(() => validateManifest(reordered), /coverage/)
})
test('builds preserve the pinned snapshot without downloading or refreshing it', () => {
  assert.equal(edition.refreshPolicy, 'manual-versioned-snapshots')
  assert.doesNotMatch(JSON.parse(readFileSync('package.json', 'utf8')).scripts.build, /acquire|download|fetch|data:/)
  assert.equal(edition.source.url.endsWith('-latest.osm.pbf'), false)
})
test('the preserved profile explicitly declares scope, unsupported rules and coverage', () => {
  const profile = JSON.parse(readFileSync(`public/profiles/${manifest.profile}.json`))
  assert.equal(profile.id, manifest.profile); assert.deepEqual(profile.includedHighways, manifest.classes)
  assert.equal(profile.status, 'connectivity-study'); assert.equal(profile.drivingLegalityValidated, false)
  assert.ok(profile.unsupportedRules.includes('turn restrictions'))
  assert.match(profile.coverage.ferries, /Excluded/); assert.match(profile.directions.otherValues, /unsupported/)
})
