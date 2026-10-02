import { test, expect } from 'vitest'
import { compileGraph, singleFrontSearch } from '../src/search/engine.ts'
import { compileReverse, prepareBalancedHeuristic } from '../src/search/bidirectional.ts'
import { prepareHeuristic } from '../src/search/astar.ts'
import { snapEndpoints, releaseEndpointIndex } from '../src/search/endpoints.ts'
import { releaseBuffers } from '../src/search/release-buffers.ts'

const graph = (xy, edges) => compileGraph({ xy: Int32Array.from(xy.flat()), from: Uint32Array.from(edges, e => e[0]), to: Uint32Array.from(edges, e => e[1]), length: Uint32Array.from(edges, e => e[2]), direction: Uint8Array.from(edges, () => 0), category: new Uint8Array(edges.length) })
test('compact balanced estimates preserve signed differences and odd half-centimetres exactly', () => {
  const g = graph([[0, 0], [1, 0], [2, 1], [3, 0]], [[0, 1, 111], [1, 2, 157], [2, 3, 157]])
  const reverse = compileReverse(g)
  const a = prepareHeuristic(g, reverse, 0, 3), b = prepareHeuristic(g, reverse, 3, 0, true)
  const compact = prepareBalancedHeuristic(g, reverse, 0, 3)
  expect(compact.potential).toBeInstanceOf(Int32Array)
  const expected = Array.from(a.potential, (value, i) => (value - b.potential[i]) / 2)
  expect(expected.some(value => !Number.isInteger(value))).toBe(true)
  expect(expected.some(value => value < 0)).toBe(true)
  expect(Array.from(compact.potential, value => value / compact.divisor)).toEqual(expected)
  expect(compact.forward.startLowerBoundCm).toBe(a.record.startLowerBoundCm)
  expect(compact.backward.startLowerBoundCm).toBe(b.record.startLowerBoundCm)
})
test('large estimates retain Float64 storage rather than overflowing compact differences', () => {
  const g = graph([[-17900000, 0], [17900000, 0]], [[0, 1, 4294967295]])
  const reverse = compileReverse(g), a = prepareHeuristic(g, reverse, 0, 1), b = prepareHeuristic(g, reverse, 1, 0, true)
  const balanced = prepareBalancedHeuristic(g, reverse, 0, 1)
  expect(balanced.potential).toBeInstanceOf(Float64Array)
  expect(Array.from(balanced.potential, value => value / balanced.divisor)).toEqual(Array.from(a.potential, (value, i) => (value - b.potential[i]) / 2))
})
test('phase cleanup detaches owned scratch buffers once while leaving outputs intact', () => {
  const buffer = new ArrayBuffer(32), a = new Uint32Array(buffer), b = new Uint8Array(buffer), output = Uint32Array.of(7)
  const expected = typeof buffer.transfer === 'function' ? 32 : 0
  expect(releaseBuffers(a, b, undefined)).toBe(expected)
  if (expected) { expect(buffer.byteLength).toBe(0); expect(a.length).toBe(0) }
  expect(output[0]).toBe(7)
})

test('mixed-width balanced bounds use an exact Float64 fallback', () => {
  const g = graph([[-12000000, 0], [0, 0], [12000000, 0]], [[0, 1, 4294967295], [1, 2, 4294967295]])
  const reverse = compileReverse(g), a = prepareHeuristic(g, reverse, 0, 1), b = prepareHeuristic(g, reverse, 1, 0, true)
  const balanced = prepareBalancedHeuristic(g, reverse, 0, 1)
  expect(balanced.potential).toBeInstanceOf(Float64Array)
  expect(Array.from(balanced.potential, value => value / balanced.divisor)).toEqual(Array.from(a.potential, (value, i) => (value - b.potential[i]) / 2))
})
test('discarding a completed snapping index preserves the graph and permits a fresh index', () => {
  const g = graph([[0, 0], [1, 0], [2, 0]], [[0, 1, 1], [1, 2, 1]])
  const a = { name: 'A', lon: 0, lat: 0 }, b = { name: 'B', lon: .00002, lat: 0 }
  const before = snapEndpoints(g, a, b)
  expect(releaseEndpointIndex(g)).toBe(typeof ArrayBuffer.prototype.transfer === 'function' ? 15 : 0)
  const after = snapEndpoints(g, a, b)
  expect(after.start).toEqual(before.start); expect(after.goal).toEqual(before.goal)
  expect(g.xy.length).toBe(6); expect(g.incoming.length).toBe(3)
})

test('single-front search preserves caller-owned reusable heuristic storage', () => {
  const g = graph([[0, 0], [1, 0]], [[0, 1, 111]]), reverse = compileReverse(g)
  const estimate = prepareHeuristic(g, reverse, 0, 1), original = Array.from(estimate.potential)
  const endpoint = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
  const first = singleFrontSearch(g, endpoint(0), endpoint(1), 0, estimate)
  expect(Array.from(estimate.potential)).toEqual(original)
  expect(singleFrontSearch(g, endpoint(0), endpoint(1), 0, estimate).trace).toEqual(first.trace)
})
