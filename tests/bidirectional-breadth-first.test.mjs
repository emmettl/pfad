import { test } from 'vitest'
import assert from 'node:assert/strict'
import { compileGraph, countsAt } from '../src/search/engine.ts'
import { breadthFirst } from '../src/search/breadth-first.ts'
import { bidirectional, compileReverse } from '../src/search/bidirectional.ts'
const ep=node=>({node,name:String(node),lon:0,lat:0,snapMetres:0})
test('two FIFO fronts agree with directed BFS across disconnected, zero-cost and asymmetric graphs',()=>{
 for(let seed=1;seed<=20;seed++){
  const n=8, edges=[];let random=seed
  for(let u=0;u<n;u++)for(let v=u+1;v<n;v++){random=(Math.imul(random,1664525)+1013904223)>>>0;if(random%3)edges.push([u,v,random%100,random%3])}
  const g=compileGraph({xy:new Int32Array(n*2),from:Uint32Array.from(edges,e=>e[0]),to:Uint32Array.from(edges,e=>e[1]),length:Uint32Array.from(edges,e=>e[2]),direction:Uint8Array.from(edges,e=>e[3]),category:new Uint8Array(edges.length)}),reverse=compileReverse(g)
  for(let a=0;a<n;a++)for(let b=0;b<n;b++){
   const r=bidirectional(g,reverse,ep(a),ep(b),0,false,true),ref=breadthFirst(g,ep(a),ep(b))
   assert.equal(r.routeMetres===null,ref.routeMetres===null);assert.equal(r.routeEdges.length,ref.routeEdges.length)
   assert.equal(r.routeMetres,r.routeMetres===null?null:r.routeLengths.reduce((a,b)=>a+b,0)/100)
   for(let i=0;i<r.routeEdges.length;i++){
    const edge=r.routeEdges[i],u=r.routeNodes[i],v=r.routeNodes[i+1]
    assert.ok(Array.from(g.arcEdge.subarray(g.offsets[u],g.offsets[u+1])).some((e,j)=>e===edge&&g.arcTo[g.offsets[u]+j]===v))
   }
   assert.deepEqual(countsAt(r,1),[r.exploredNodes,r.examinedArcs,r.improvements])
   if(r.meeting){assert.ok(r.meeting.candidateConnections>=r.routeEdges.length);assert.equal(r.meeting.candidateMetres,undefined)}
  }
 }
})
test('breadth-first minimizes connections despite a much longer physical route and records both fronts deterministically',()=>{
 const g=compileGraph({xy:new Int32Array(10),from:new Uint32Array([0,1,0,2,3]),to:new Uint32Array([1,4,2,3,4]),length:new Uint32Array([1000,1000,1,1,1]),direction:new Uint8Array(5).fill(1),category:new Uint8Array(5)}), reverse=compileReverse(g)
 const run=()=>bidirectional(g,reverse,ep(0),ep(4),0,false,true),r=run()
 assert.equal(r.routeEdges.length,2);assert.equal(r.routeMetres,20);assert.equal(r.routeGuarantee,'fewest-connections')
 assert.ok(r.trace.some(e=>e>>>31));assert.ok(r.trace.some(e=>!(e>>>31)));assert.deepEqual(r.trace,run().trace)
})
