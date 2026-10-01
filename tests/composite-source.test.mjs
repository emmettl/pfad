import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'vitest'
const config = JSON.parse(readFileSync('data/countries/sc.json'))
test('Scandinavia pins matching snapshots and an explicit complete-way regional union', () => {
  assert.equal(config.id, 'sc')
  assert.deepEqual(config.source.inputs.map(input => input.country), ['norway', 'sweden', 'denmark'])
  for (const input of config.source.inputs) {
    assert.equal(input.dataTimestamp, config.source.dataTimestamp)
    assert.match(input.url, /-260930\.osm\.pbf$/)
    assert.match(input.sha256, /^[a-f0-9]{64}$/)
    assert.ok(input.bytes > 0)
  }
  assert.equal(config.source.composition.strategy, 'complete_ways')
  assert.deepEqual(config.source.composition.bounds, [3, 54, 33, 72])
  assert.equal(config.source.composition.deduplication, 'OSM object type, ID and version')
  assert.deepEqual(config.source.composition.excludedTerritories, ['Svalbard', 'Jan Mayen'])
})
