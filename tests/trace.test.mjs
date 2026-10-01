import assert from 'node:assert/strict'
import { test } from 'vitest'
import { EventTrace } from '../src/search/trace.ts'
test('exact event buffer grows across a boundary and shrinks without a second trace copy', () => {
  const trace = new EventTrace(600000)
  const buffer = trace.buffer
  for (let i = 0; i < 270001; i++) trace.set(i, (i + 16777217) | 0x80000000)
  assert.ok(trace.buffer.byteLength < 600000 * 4)
  const words = trace.finish(270001)
  assert.equal(buffer.byteLength, 0); assert.equal(words.buffer.resizable, false); assert.equal(words.buffer.byteLength, 270001 * 4)
  assert.equal(words[262144], (262144 + 16777217 + 0x80000000) >>> 0)
  const moved = structuredClone(words, { transfer: [words.buffer] })
  assert.equal(buffer.byteLength, 0); assert.equal(moved.length, 270001)
})
test('older-browser trace fallback preserves words, exact length and event bounds', () => {
  const trace = new EventTrace(20, false)
  trace.set(0, 16777217); trace.set(1, 0xffffffff)
  assert.deepEqual([...trace.finish(2)], [16777217, 0xffffffff])
  assert.throws(() => trace.set(20, 3), /event bound/)
})

test('fallback allocates for recorded events rather than a national worst-case bound', () => {
  const trace = new EventTrace(120000000, false)
  assert.equal(trace.buffer.byteLength, 1024 * 1024)
  for (let i = 0; i < 270001; i++) trace.set(i, (i + 16777217) | 0x80000000)
  const result = trace.finish(270001)
  assert.equal(result.length, 270001)
  assert.equal(result[262144], (262144 + 16777217 + 0x80000000) >>> 0)
  assert.equal(result.at(-1), (270000 + 16777217 + 0x80000000) >>> 0)
  assert.equal(trace.buffer.byteLength, 0)
})
