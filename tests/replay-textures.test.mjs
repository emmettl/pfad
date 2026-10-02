import { test, expect } from 'vitest'
import { prepareReplayTextures, replayTextureBytes } from '../src/map/replayTextures.ts'
test('compact textures preserve both fronts, improvements and artistic fields without changing recording arrays', () => {
  const edgeTimes = new Uint32Array(16384), backwardTimes = new Uint32Array(16384), edgeSources = new Uint8Array(8192), goalProximity = new Uint8Array(8192)
  const reached = [0, 103, 8000]
  for (const [i, edge] of reached.entries()) {
    if (i !== 1) { edgeTimes[edge * 2] = 10 + i; edgeTimes[edge * 2 + 1] = 90 + i }
    backwardTimes[edge * 2] = 20 + i; backwardTimes[edge * 2 + 1] = 100 + i
    edgeSources[edge] = i + 1; goalProximity[edge] = 255 - i
  }
  const original = edgeTimes.slice(), result = prepareReplayTextures({edgeTimes, backwardTimes, edgeSources, goalProximity, textureWidth:2048, textureHeight:4})
  for (const edge of reached) {
    const row = result.lookup[edge]
    expect(result.forward.slice(row * 2, row * 2 + 2)).toEqual(edgeTimes.slice(edge * 2, edge * 2 + 2))
    expect(result.backward.slice(row * 2, row * 2 + 2)).toEqual(backwardTimes.slice(edge * 2, edge * 2 + 2))
    expect(result.sources[row]).toBe(edgeSources[edge]); expect(result.proximity[row]).toBe(goalProximity[edge])
  }
  expect(edgeTimes).toEqual(original); expect(replayTextureBytes(result)).toBe(54)
})
test('broad searches reuse the original allocation and empty searches remain valid', () => {
  const edgeTimes = new Uint32Array(8192)
  const empty = prepareReplayTextures({edgeTimes,textureWidth:2048,textureHeight:2})
  expect(empty.forward.length).toBe(2); expect(empty.width).toBe(1); expect(empty.height).toBe(1)
  for(let edge=0;edge<2048;edge++)edgeTimes[edge*2]=edge+1
  const dense=prepareReplayTextures({edgeTimes,textureWidth:2048,textureHeight:2})
  expect(dense.forward).toBe(edgeTimes); expect(dense.lookup).toBeUndefined()
})
test('yielding preparation produces identical compact rows across scan boundaries', async () => {
  const { prepareReplayTexturesAsync } = await import('../src/map/replayTextures.ts')
  const edgeTimes = new Uint32Array(1200000), backwardTimes = new Uint32Array(1200000)
  edgeTimes[262143*2]=25; backwardTimes[524288*2]=31; backwardTimes[524288*2+1]=51
  const input={edgeTimes,backwardTimes,textureWidth:2048,textureHeight:293}
  const expected=prepareReplayTextures(input),actual=await prepareReplayTexturesAsync(input)
  expect(actual.forward).toEqual(expected.forward);expect(actual.backward).toEqual(expected.backward)
  expect(actual.lookup).toEqual(expected.lookup);expect(actual.width).toBe(expected.width)
  expect(prepareReplayTextures(input,false).forward).toBe(edgeTimes)
})

test('texture row padding cannot turn a marginally sparse search into an oversized copy', () => {
  const edgeTimes = new Uint32Array(12288)
  for (let edge = 0; edge < 3071; edge++) edgeTimes[edge * 2] = edge + 1
  const result = prepareReplayTextures({edgeTimes,textureWidth:2048,textureHeight:3})
  expect(result.forward).toBe(edgeTimes);expect(result.lookup).toBeUndefined()
})
