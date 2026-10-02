import { test, expect } from 'vitest'
import { drawingRoadRange, drawingChunkNeeded } from '../src/map/drawingLayout.ts'
test('verified geometry layout identifies exact road ranges, unfamiliar layouts conservatively decode', () => {
  const chunk = {kind:'geometry', start:100, count:3, decodedBytes:46}
  expect(drawingRoadRange(chunk,16)).toEqual({start:100,count:3})
  expect(drawingRoadRange(chunk,14)).toBeUndefined()
  expect(drawingRoadRange({...chunk,decodedBytes:45},16)).toBeUndefined()
  expect(drawingRoadRange(undefined,16)).toBeUndefined()
})
test('drawing pruning keeps either front and chosen routes, with exact range boundaries', () => {
  const forward = new Uint32Array(40), backward = new Uint32Array(40), range={start:5,count:5}
  forward[4*2]=1; backward[10*2]=2
  expect(drawingChunkNeeded(range,forward,backward,new Set())).toBe(false)
  backward[9*2]=3
  expect(drawingChunkNeeded(range,forward,backward,new Set())).toBe(true)
  backward[9*2]=0
  expect(drawingChunkNeeded(range,forward,backward,new Set([5]))).toBe(true)
  expect(drawingChunkNeeded(undefined,forward,backward,new Set())).toBe(true)
  expect(drawingChunkNeeded({start:19,count:2},forward,backward,new Set())).toBe(true)
})
