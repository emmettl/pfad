import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('geographic references retain reviewed source identities, attribution and closed rings', () => {
  const record = JSON.parse(readFileSync('data/geography-sources.json', 'utf8'))
  assert.equal(record.refreshPolicy, 'manual-versioned-snapshots')
  assert.equal(record.assets.length, 12)
  for (const asset of record.assets) {
    const bytes = readFileSync(asset.path), layer = JSON.parse(bytes)
    assert.equal(bytes.length, asset.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256)
    assert.equal(layer.metadata.attribution, asset.attribution)
    assert.equal(layer.metadata.outputCrs, 'EPSG:4326')
    assert.equal(layer.metadata.simplificationToleranceMetres, asset.simplificationToleranceMetres)
    const rings = layer.rings ?? layer.lakes.flatMap(lake => lake.polygons.flatMap(polygon => polygon))
    assert.ok(layer.lakes || rings.length > 0)
    for (const ring of rings) {
      assert.ok(ring.length >= 4); assert.deepEqual(ring[0], ring[ring.length - 1])
      const [west, south, east, north] = asset.bounds ?? [5, 45, 11, 49]
      for (const [rawLon, lat] of ring) { const lon = asset.path.includes('nz-') && rawLon < 0 ? rawLon + 360 : rawLon; assert.ok(Number.isFinite(lon) && Number.isFinite(lat) && lon > west && lon < east && lat > south && lat < north) }
    }
    if (layer.lakes && /switzerland|uk-/.test(asset.path)) {
      const uk = asset.path.includes('uk-')
      assert.equal(layer.lakes.length, uk ? 14 : 160)
      for (const name of uk ? ['Lough Neagh', 'Loch Ness', 'Loch Lomond North Basin'] : ['Le Léman', 'Zürichsee', 'Bodensee']) assert.ok(layer.lakes.some(lake => lake.name === name))
    }
  }
})
