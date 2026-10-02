import { test, expect } from 'vitest'
import { prepareReplayDrawing, prepareSpatialReplayDrawing, replayVertexCount, firstRoadEvent } from '../src/map/replayDrawing.ts'

test('replay batching preserves exact reached segments and submits every visible road across arbitrary seeks', () => {
  const positions = Float32Array.from([0, 0, 1, 1, 2, 0, 3, 1, 4, 0, 5, 1, 6, 0, 7, 1])
  const roads = Float32Array.from([0, 0, 1, 1, 2, 2, 3, 3])
  const forward = Uint32Array.from([90, 95, 0, 0, 40, 45, 0, 0])
  const backward = Uint32Array.from([10, 20, 70, 80, 0, 0, 0, 0])
  const result = prepareReplayDrawing(positions, roads, forward, backward, 100)
  expect(result.count).toBe(6)
  expect(result.bounds).toEqual([0, 0, 5, 1])
  const ids = new Float32Array(result.bytes, result.count * 8, result.count)
  const points = new Float32Array(result.bytes, 0, result.count * 2)
  for (const event of [0, 10, 70, 9, 40, 100, 20]) {
    const submitted = replayVertexCount(result.ends, event, 100)
    for (let edge = 0; edge < 4; edge++) {
      const first = firstRoadEvent(edge, forward, backward)
      if (first && first <= event) expect(Array.from(ids.slice(0, submitted))).toContain(edge)
    }
  }
  for (let i = 0; i < ids.length; i += 2) expect(Array.from(points.slice(i * 2, i * 2 + 4))).toEqual(Array.from(positions.slice(ids[i] * 4, ids[i] * 4 + 4)))
  expect(replayVertexCount(result.ends, 0, 100)).toBe(0)
  expect(Array.from(ids)).not.toContain(3)
})

test('spatial batches retain every exact segment, crossing bounds, both fronts and temporal visibility', () => {
  const points = [], roadIds = [], forward = new Uint32Array(160), backward = new Uint32Array(160)
  for (let i = 0; i < 80; i++) {
    points.push(i % 7, Math.floor(i / 7), i === 5 ? 1000 : i % 7 + .25, Math.floor(i / 7) + .5)
    roadIds.push(i, i)
    if (i % 3) forward[i * 2] = 1 + i
    if (i % 5) backward[i * 2] = 90 - i
  }
  const positions = Float32Array.from(points), roads = Uint32Array.from(roadIds)
  const batches = prepareSpatialReplayDrawing(positions, roads, forward, backward, 100, 7)
  const seen = new Set()
  for (const batch of batches) {
    expect(batch.count).toBeLessThanOrEqual(14)
    const xy = new Float32Array(batch.bytes, 0, batch.count * 2), ids = new Uint32Array(batch.bytes, batch.count * 8, batch.count)
    for (let i = 0; i < batch.count; i += 2) {
      const edge = ids[i]
      expect(ids[i + 1]).toBe(edge); expect(seen.has(edge)).toBe(false); seen.add(edge)
      expect(Array.from(xy.slice(i * 2, i * 2 + 4))).toEqual(Array.from(positions.slice(edge * 4, edge * 4 + 4)))
      const [left, bottom, right, top] = batch.bounds
      for (let v = i; v < i + 2; v++) { expect(xy[v * 2]).toBeGreaterThanOrEqual(left); expect(xy[v * 2]).toBeLessThanOrEqual(right); expect(xy[v * 2 + 1]).toBeGreaterThanOrEqual(bottom); expect(xy[v * 2 + 1]).toBeLessThanOrEqual(top) }
      for (const event of [0, 1, 40, 90, 20, 100, 3]) if (firstRoadEvent(edge, forward, backward) <= event) expect(Array.from(ids.slice(0, replayVertexCount(batch.ends, event, 100)))).toContain(edge)
    }
  }
  expect(Array.from(seen).sort((a, b) => a - b)).toEqual(Array.from({ length: 80 }, (_, i) => i).filter(i => firstRoadEvent(i, forward, backward)))
})

test('spatial partition terminates with coincident midpoints and handles empty searches', () => {
  const positions = new Float32Array(400), roads = new Uint32Array(200), times = new Uint32Array(2); times[0] = 1
  const batches = prepareSpatialReplayDrawing(positions, roads, times, undefined, 1, 3)
  expect(batches.reduce((sum, batch) => sum + batch.count, 0)).toBe(200)
  expect(batches.every(batch => batch.count <= 6)).toBe(true)
  expect(prepareSpatialReplayDrawing(positions, roads, new Uint32Array(2), undefined, 0)).toEqual([])
  expect(() => prepareSpatialReplayDrawing(positions, roads, times, undefined, 1, 0)).toThrow()
})

test('integer road IDs beyond float precision survive selection and complete empty searches', () => {
  const edge = 16777217
  const forward = new Uint32Array((edge + 1) * 2); forward[edge * 2] = 1
  const result = prepareReplayDrawing(Float32Array.from([0, 0, 1, 1]), Uint32Array.from([edge, edge]), forward, undefined, 1)
  expect(new Uint32Array(result.bytes, result.count * 8, result.count)).toEqual(Uint32Array.from([edge, edge]))
  const spatial = prepareSpatialReplayDrawing(Float32Array.from([0, 0, 1, 1]), Uint32Array.from([edge, edge]), forward, undefined, 1)
  expect(spatial).toHaveLength(1)
  expect(new Uint32Array(spatial[0].bytes, spatial[0].count * 8, spatial[0].count)).toEqual(Uint32Array.from([edge, edge]))
  const empty = prepareReplayDrawing(Float32Array.from([0, 0, 1, 1]), Uint32Array.from([0, 0]), new Uint32Array(2), undefined, 0)
  expect(empty.count).toBe(0); expect(replayVertexCount(empty.ends, 0, 0)).toBe(0)
})
