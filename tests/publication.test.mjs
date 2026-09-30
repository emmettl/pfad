import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('public/data/pfad-manifest.json', 'utf8'))
test('the scaffold cannot present the sizing proof as a published routing graph', () => {
  assert.equal(manifest.status, 'scaffold')
  assert.equal(manifest.graph, null)
  assert.equal(manifest.evidence.productionRoutingValidated, false)
  assert.match(manifest.source.sha256, /^[a-f0-9]{64}$/)
  assert.equal(manifest.source.licence, 'ODbL-1.0')
})
test('builds do not silently refresh the pinned source snapshot', () => {
  assert.equal(manifest.refreshPolicy, 'manual-versioned-snapshots')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.doesNotMatch(pkg.scripts.build, /acquire|download|fetch|data:/)
  assert.equal(manifest.source.url.endsWith('-latest.osm.pbf'), false)
})
