import assert from 'node:assert/strict'
import { test } from 'vitest'
import { compileGraph, countsAt } from '../src/search/engine.ts'
import { spanningTree } from '../src/search/spanning-tree.ts'
const ep=node=>({node,name:String(node),lon:0,lat:0,snapMetres:0})
const graph=()=>compileGraph({xy:new Int32Array(10),from:new Uint32Array([0,1,0,2,0,3]),to:new Uint32Array([1,2,2,2,1,4]),length:new Uint32Array([10,20,100,0,10,7]),direction:new Uint8Array([2,1,1,0,1,1]),category:new Uint8Array(6)})
test('Prim selects a minimum acyclic tree on the undirected root component',()=>{
 const g=graph(),r=spanningTree(g,ep(0))
 assert.equal(r.tree.totalMetres,.3);assert.equal(r.tree.nodes,3);assert.equal(r.tree.directions,'ignored')
 assert.deepEqual(Array.from(r.treeEdges),[0,1]);assert.equal(r.routeMetres,null)
 assert.deepEqual(r.trace,spanningTree(g,ep(0)).trace)
 assert.deepEqual(countsAt(r,1),[3,10,2])
 for(const edge of r.treeEdges)assert.ok(r.edgeTimes[edge*2+1]>r.edgeTimes[edge*2])
 assert.equal(spanningTree(g,ep(4)).tree.totalMetres,.07)
})
test('Prim agrees with independent Kruskal across roots and weighted parallel edges',()=>{
 for(let seed=0;seed<30;seed++){
  const n=7,edges=[];let random=seed+1
  for(let u=0;u<n;u++)for(let v=u+1;v<n;v++){random=(random*1664525+1013904223)>>>0;if(random%3)edges.push([u,v,random%20])}
  const g=compileGraph({xy:new Int32Array(n*2),from:Uint32Array.from(edges,e=>e[0]),to:Uint32Array.from(edges,e=>e[1]),length:Uint32Array.from(edges,e=>e[2]),direction:new Uint8Array(edges.length).fill(1),category:new Uint8Array(edges.length)})
  const parent=Array.from({length:n},(_,i)=>i);const root=i=>parent[i]===i?i:parent[i]=root(parent[i]);const accepted=[]
  for(const [u,v,w] of [...edges].sort((a,b)=>a[2]-b[2]))if(root(u)!==root(v)){parent[root(u)]=root(v);accepted.push([u,v,w])}
  for(let start=0;start<n;start++){
   const expected=accepted.filter(([u])=>root(u)===root(start)).reduce((sum,e)=>sum+e[2],0)
   const r=spanningTree(g,ep(start));assert.equal(r.tree.totalMetres,expected/100);assert.equal(r.treeEdges.length,r.tree.nodes-1)
  }
 }
})

test('goal-directed Prim stops at B and reconstructs its non-shortest tree path',()=>{
 const g=compileGraph({xy:new Int32Array(8),from:new Uint32Array([0,1,0,2]),to:new Uint32Array([1,2,2,3]),length:new Uint32Array([10,10,15,100]),direction:new Uint8Array(4).fill(2),category:new Uint8Array(4)})
 const r=spanningTree(g,ep(0),0,ep(2))
 assert.deepEqual(Array.from(r.routeNodes),[0,1,2]);assert.deepEqual(Array.from(r.routeEdges),[0,1])
 assert.deepEqual(Array.from(r.routeReversed),[0,0]);assert.equal(r.routeMetres,.2)
 assert.equal(r.tree.nodes,3);assert.deepEqual(Array.from(r.treeEdges),[0,1]);assert.equal(r.edgeTimes[6],0)
 assert.equal(r.goal.node,2);assert.equal(r.tree.version,'undirected-prim-goal/1')
 assert.deepEqual(spanningTree(g,ep(2),0,ep(0)).routeReversed,new Uint8Array([1,1]))
 assert.equal(spanningTree(g,ep(0),0,ep(0)).routeMetres,0)
 assert.equal(spanningTree(graph(),ep(0),0,ep(4)).routeMetres,null)
})
