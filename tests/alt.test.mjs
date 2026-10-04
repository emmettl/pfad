import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, dijkstra } from '../src/search/engine.ts'
import { compileReverse } from '../src/search/bidirectional.ts'
import { alt, buildLandmarks, prepareAlt } from '../src/search/alt.ts'
const ep=node=>({node,name:String(node),lon:0,lat:0,snapMetres:0})
test('directed ALT bounds remain feasible and routes match Dijkstra across disconnected graphs and dead ends',()=>{
 for(let seed=1;seed<=25;seed++){
  const n=8,edges=[];let random=seed
  for(let u=0;u<n;u++)for(let v=u+1;v<n;v++){random=(Math.imul(random,1664525)+1013904223)>>>0;if(random%3)edges.push([u,v,random%100,random%3])}
  const g=compileGraph({xy:Int32Array.from({length:n*2},(_,i)=>i*100),from:Uint32Array.from(edges,e=>e[0]),to:Uint32Array.from(edges,e=>e[1]),length:Uint32Array.from(edges,e=>e[2]),direction:Uint8Array.from(edges,e=>e[3]),category:new Uint8Array(edges.length)}),reverse=compileReverse(g),index=buildLandmarks(g,reverse)
  assert.ok(index.nodes.length<=4);assert.equal(index.bytes,index.nodes.length*n*8)
  assert.deepEqual(index.nodes,buildLandmarks(g,reverse).nodes)
  for(let goal=0;goal<n;goal++){
   const bound=prepareAlt(g,reverse,index,0,goal).potential;assert.equal(bound[goal],0)
   for(let u=0;u<n;u++)for(let a=g.offsets[u];a<g.offsets[u+1];a++)assert.ok(bound[u]<=g.length[g.arcEdge[a]]+bound[g.arcTo[a]])
   for(let start=0;start<n;start++){
    const r=alt(g,reverse,index,ep(start),ep(goal)),expected=dijkstra(g,ep(start),ep(goal))
    assert.equal(r.routeMetres,expected.routeMetres)
    assert.equal(r.routeMetres,r.routeMetres===null?null:r.routeLengths.reduce((sum,c)=>sum+c,0)/100)
    assert.equal(r.landmarks.tableBytes,index.bytes);assert.equal(r.focusEvents.length,r.exploredNodes)
   }
  }
 }
})
test('ALT preserves original graph costs and repeats exact search events when its index is reused',()=>{
 const g=compileGraph({xy:new Int32Array([0,0,100,0,200,0]),from:new Uint32Array([0,1,0]),to:new Uint32Array([1,2,2]),length:new Uint32Array([10,10,25]),direction:new Uint8Array(3),category:new Uint8Array(3)}),reverse=compileReverse(g),index=buildLandmarks(g,reverse)
 const first=alt(g,reverse,index,ep(0),ep(2)),second=alt(g,reverse,index,ep(0),ep(2),0,true)
 assert.equal(first.routeMetres,.2);assert.deepEqual(first.trace,second.trace);assert.equal(second.landmarks.cached,true)
 assert.deepEqual(Array.from(g.length),[10,10,25]);assert.ok(index.peakBufferBytes>=index.bytes)
})
