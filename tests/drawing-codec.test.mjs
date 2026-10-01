import { test, expect } from 'vitest'
import { packDrawing, unpackDrawing } from '../src/map/drawing-codec.ts'

test('drawing differences restore every coordinate and road-ID bit across wraparound', async () => {
  const words = Uint32Array.from([0, 0xffffffff, 0x80000000, 0x7fffffff, 1, 0, 0xffffffff, 0, 1])
  const original = words.slice()
  const packed = await packDrawing(words.buffer, 3)
  expect(new Uint32Array(await unpackDrawing(packed, 3))).toEqual(original)
  await expect(unpackDrawing(packed, 4)).rejects.toThrow('size mismatch')
  await expect(packDrawing(new ArrayBuffer(4), 1)).rejects.toThrow('size mismatch')
})
