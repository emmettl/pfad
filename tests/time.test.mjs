import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, dijkstra } from '../src/search/engine.ts'
import { timeDijkstra, travelMilliseconds } from '../src/search/time.ts'
const ep=node=>({node,name:String(node),lon:0,lat:0,snapMetres:0})
const fixture=()=>compileGraph({xy:new Int32Array(6),from:new Uint32Array([0,0,1]),to:new Uint32Array([2,1,2]),length:new Uint32Array([100000,150000,150000]),direction:new Uint8Array([1,1,1]),category:new Uint8Array([0,1,1])})
test('time routing chooses a longer fast road route and retains physical lengths',()=>{
 const g=fixture(),r=timeDijkstra(g,['service','motorway'],ep(0),ep(2))
 assert.equal(dijkstra(g,ep(0),ep(2)).routeMetres,1000)
 assert.deepEqual(Array.from(r.routeNodes),[0,1,2]);assert.equal(r.routeMetres,3000)
 assert.equal(r.routeMilliseconds,108000);assert.deepEqual(Array.from(r.routeLengths),[150000,150000])
 assert.equal(r.timeModel.version,'road-class-time/1');assert.deepEqual(r.trace,timeDijkstra(g,['service','motorway'],ep(0),ep(2)).trace)
 assert.equal(timeDijkstra(g,['service','motorway'],ep(2),ep(0)).routeMilliseconds,null)
 assert.equal(timeDijkstra(g,['service','motorway'],ep(1),ep(1)).routeMilliseconds,0)
})
test('integer time costs have explicit rounding, positive zero-length cost and fallback',()=>{
 assert.equal(travelMilliseconds(100000,100),36000);assert.equal(travelMilliseconds(0,25),1)
 assert.throws(()=>travelMilliseconds(1,0))
 const g=fixture();assert.equal(timeDijkstra(g,['unknown','motorway'],ep(0),ep(2)).timeModel.fallbackKph,25)
 assert.throws(()=>timeDijkstra(g,[],ep(0),ep(2)))
})

import { timeGraph, annotateTime } from '../src/search/time.ts'
import { astar } from '../src/search/astar.ts'
import { bidirectional, compileReverse } from '../src/search/bidirectional.ts'
import { breadthFirst } from '../src/search/breadth-first.ts'
import { depthFirst } from '../src/search/depth-first.ts'
import { greedy } from '../src/search/greedy.ts'
import { multisource } from '../src/search/multisource.ts'
import { readStudyLink, studyUrl } from '../src/records/link.ts'
test('all optimal solvers agree on time while traversal algorithms keep physical routes',()=>{
 const g=fixture(),w=timeGraph(g,['service','motorway']),reverse=compileReverse(g)
 for(const run of [()=>dijkstra(w,ep(0),ep(2)),()=>astar(w,reverse,ep(0),ep(2)),()=>bidirectional(w,reverse,ep(0),ep(2)),()=>bidirectional(w,reverse,ep(0),ep(2),0,true)]){
   const r=annotateTime(run(),g,w,true);assert.equal(r.routeMilliseconds,108000);assert.equal(r.routeMetres,3000)
 }
 for(const solver of [breadthFirst,depthFirst,greedy]){
   const before=solver(g,ep(0),ep(2)),after=annotateTime(solver(g,ep(0),ep(2)),g,w,false)
   assert.deepEqual(before.trace,after.trace);assert.deepEqual(before.routeNodes,after.routeNodes)
 }
 const r=annotateTime(multisource(w,[ep(0),ep(1),ep(2)]),g,w,true)
 assert.equal(r.territories.maximumMetres,undefined);assert.equal(r.territories.maximumMilliseconds,0)
})
test('objective survives a shared link independently from algorithm',()=>{
 const link=readStudyLink('https://example.org/?algorithm=astar&objective=time').study
 assert.equal(link.objective,'time');assert.equal(link.algorithm,'astar')
 assert.equal(readStudyLink(studyUrl('https://example.org/',link)).study.objective,'time')
 assert.ok(readStudyLink('https://example.org/?objective=banana').error)
})

import { estimateRouteTime } from '../src/search/time.ts'
test('distance routes get a cheap estimate without changing route or objective',()=>{
 const g=fixture(),r=dijkstra(g,ep(0),ep(2)),trace=r.trace
 estimateRouteTime(r,g,['service','motorway'])
 assert.equal(r.routeMetres,1000);assert.equal(r.routeMilliseconds,240000)
 assert.equal(r.trace,trace);assert.equal(r.objective,undefined)
})
