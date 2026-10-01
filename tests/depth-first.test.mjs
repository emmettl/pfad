import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, countsAt } from '../src/search/engine.ts'
import { depthFirst } from '../src/search/depth-first.ts'
const endpoint = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
function fixture() { return compileGraph({ xy: new Int32Array([0,0,1,1,2,2,3,3]), from: new Uint32Array([0,1,0]), to: new Uint32Array([1,2,3]), length: new Uint32Array([100,200,50]), direction: new Uint8Array([1,0,1]), category: new Uint8Array(3) }) }
test('DFS exhausts a cyclic branch then records genuine returns before finding the goal', () => {
 const g=fixture(), r=depthFirst(g,endpoint(0),endpoint(3))
 assert.deepEqual(Array.from(r.trace).filter(x=>(x&3)===0).map(x=>x>>>2),[0,1,2,3])
 assert.deepEqual(Array.from(r.trace).filter(x=>(x&3)===3).map(x=>x>>>2),[1,0])
 assert.deepEqual(Array.from(r.routeNodes),[0,3]); assert.equal(r.routeMetres,.5)
 assert.deepEqual(Array.from(r.focusCoordinates),[0,0,1,1,2,2,1,1,0,0,3,3])
 assert.deepEqual(countsAt(r,1),[4,4,3]); assert.deepEqual(countsAt(r,0),[0,0,0])
 assert.deepEqual(depthFirst(g,endpoint(0),endpoint(3)).trace,r.trace)
})
test('DFS honours directed roads, unreachable goals and identical endpoints',()=>{
 const g=fixture()
 assert.equal(depthFirst(g,endpoint(3),endpoint(0)).routeMetres,null)
 assert.deepEqual(Array.from(depthFirst(g,endpoint(2),endpoint(2)).routeNodes),[2])
})
