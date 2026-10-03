import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'vitest'

test('geographic references retain reviewed source identities, attribution and closed rings', () => {
  const record = JSON.parse(readFileSync('data/geography-sources.json', 'utf8'))
  assert.equal(record.refreshPolicy, 'manual-versioned-snapshots')
  assert.equal(record.assets.length, 34)
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


test('Ireland context covers the whole island with a dissolved coastline and Northern Irish lakes', () => {
  const border = JSON.parse(readFileSync('src/map/data/ie-border.json', 'utf8'))
  const water = JSON.parse(readFileSync('src/map/data/ie-lakes.json', 'utf8'))
  assert.equal(border.metadata.operation, 'polygon-union-before-simplification')
  assert.equal(border.rings.length, 8)
  assert.equal(border.metadata.components[1].admin, 'United Kingdom')
  assert.ok(border.rings.some(ring => ring.some(([lon, lat]) => lon > -6 && lat > 54.5)))
  assert.ok(border.rings.some(ring => ring.some(([lon, lat]) => lon < -10 && lat < 52)))
  for (const name of ['Lough Neagh', 'Upper Lough Erne', 'Lower Lough Erne', 'Lough Corrib']) assert.ok(water.lakes.some(lake => lake.name === name))
})

test('Scandinavia outlines join three countries and retain major lakes', () => {
  const border = JSON.parse(readFileSync('src/map/data/sc-border.json'))
  const water = JSON.parse(readFileSync('src/map/data/sc-lakes.json'))
  assert.deepEqual(border.metadata.components.map(c => c.admin), ['Norway', 'Sweden', 'Denmark'])
  assert.equal(border.metadata.operation, 'polygon-union-before-simplification')
  for (const name of ['Vänern', 'Vättern', 'Mjøsa', 'Arresø']) assert.ok(water.lakes.some(lake => lake.name === name))
})
