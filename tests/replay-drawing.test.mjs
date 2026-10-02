import { test, expect } from 'vitest'
import { prepareReplayDrawing, replayVertexCount, firstRoadEvent } from '../src/map/replayDrawing.ts'

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

test('integer road IDs beyond float precision survive selection and complete empty searches', () => {
  const edge = 16777217
  const forward = new Uint32Array((edge + 1) * 2); forward[edge * 2] = 1
  const result = prepareReplayDrawing(Float32Array.from([0, 0, 1, 1]), Uint32Array.from([edge, edge]), forward, undefined, 1)
  expect(new Uint32Array(result.bytes, result.count * 8, result.count)).toEqual(Uint32Array.from([edge, edge]))
  const empty = prepareReplayDrawing(Float32Array.from([0, 0, 1, 1]), Uint32Array.from([0, 0]), new Uint32Array(2), undefined, 0)
  expect(empty.count).toBe(0); expect(replayVertexCount(empty.ends, 0, 0)).toBe(0)
})
