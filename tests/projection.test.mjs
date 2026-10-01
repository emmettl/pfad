import { test } from 'vitest'
import assert from 'node:assert/strict'
import { longitudeOffset, normaliseLongitude } from '../src/search/projection.ts'
test('drawing wraps New Zealand offshore longitudes and picking returns geographic coordinates', () => {
  assert.equal(longitudeOffset(-176.5, 175, true), 8.5)
  assert.equal(longitudeOffset(174.5, 175, true), -.5)
  assert.equal(normaliseLongitude(175 + longitudeOffset(-176.5, 175, true)), -176.5)
  assert.equal(longitudeOffset(179, -175, true), -6)
  for (const [lon, centre] of [[8.5417, 8.2], [-5.714, -3], [174.5, 175]]) assert.equal(longitudeOffset(lon, centre), lon - centre)
})
