import { test } from 'vitest'
import assert from 'node:assert/strict'
import { compileGraph } from '../src/search/engine.ts'
import { astar, weightedAstar } from '../src/search/astar.ts'
import { compileReverse } from '../src/search/bidirectional.ts'
const ep=node=>({node,name:String(node),lon:0,lat:0,snapMetres:0})
test('weight two trades route optimality for a decisive goal expansion and records its policy',()=>{
 const g=compileGraph({xy:new Int32Array([0,0,100,0,200,0]),from:new Uint32Array([0,1,0]),to:new Uint32Array([1,2,2]),length:new Uint32Array([10,10,25]),direction:new Uint8Array(3).fill(1),category:new Uint8Array(3)}),reverse=compileReverse(g)
 const normal=astar(g,reverse,ep(0),ep(2)),r=weightedAstar(g,reverse,ep(0),ep(2))
 assert.equal(normal.routeMetres,.2);assert.equal(r.routeMetres,.25);assert.ok(r.exploredNodes<normal.exploredNodes)
 assert.equal(r.weighting.weight,2);assert.equal(r.weighting.reopening,false);assert.equal(r.routeGuarantee,'first-found')
 assert.deepEqual(Array.from(r.routeNodes),[0,2]);assert.equal(r.focusEvents.length,r.exploredNodes)
 assert.deepEqual(r.trace,weightedAstar(g,reverse,ep(0),ep(2)).trace)
 assert.equal(weightedAstar(g,reverse,ep(2),ep(0)).routeMetres,null)
 assert.equal(weightedAstar(g,reverse,ep(1),ep(1)).routeMetres,0)
})
