import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, countsAt, dijkstra } from '../src/search/engine.ts'
import { breadthFirst } from '../src/search/breadth-first.ts'
const ep = node => ({ node, name: String(node), lon: 0, lat: 0, snapMetres: 0 })
const fixture = () => compileGraph({xy:new Int32Array(8),from:new Uint32Array([0,0,1,2]),to:new Uint32Array([3,1,2,3]),length:new Uint32Array([10000,100,100,100]),direction:new Uint8Array([1,1,1,1]),category:new Uint8Array(4)})
test('BFS minimizes connections rather than metres, preserving FIFO arc order',()=>{
 const g=fixture(), r=breadthFirst(g,ep(0),ep(3))
 assert.deepEqual(Array.from(r.routeNodes),[0,3]); assert.equal(r.routeMetres,100)
 assert.equal(dijkstra(g,ep(0),ep(3)).routeMetres,3)
 assert.deepEqual(Array.from(r.trace).filter(x=>(x&3)===0).map(x=>x>>>2),[0,3])
 assert.equal(r.routeGuarantee,'fewest-connections'); assert.deepEqual(countsAt(r,1),[2,2,2])
 assert.deepEqual(r.trace,breadthFirst(g,ep(0),ep(3)).trace)
})
test('BFS respects one-way roads, cycles and identical endpoints',()=>{
 const g=fixture(); assert.equal(breadthFirst(g,ep(3),ep(0)).routeMetres,null)
 assert.equal(breadthFirst(g,ep(2),ep(2)).routeMetres,0)
 assert.deepEqual(Array.from(breadthFirst(g,ep(1),ep(3)).routeNodes),[1,2,3])
})
