// Audit whole-island routing using complete, checksum-verified production data.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readStudyGraph } from './read-study.mjs'
import { dijkstra, snapEndpoints } from '../../src/search/engine.ts'
import { bidirectional, compileReverse } from '../../src/search/bidirectional.ts'
import { astar } from '../../src/search/astar.ts'
import { IE_POOL } from '../../src/ambient/pools.ts'
const { graph, manifest } = await readStudyGraph(process.argv[2]), reverse = compileReverse(graph)
const pairs = [['Dublin','Belfast'],['Cork','Belfast'],['Dublin','Derry'],['Letterkenny','Derry'],['Sligo','Enniskillen']]
const routes=[]
for (const names of pairs) {
 const [start,goal]=names.map(name=>IE_POOL.places.find(place=>place.name===name));assert.ok(start&&goal)
 const snapped=snapEndpoints(graph,start,goal), runs=[]
 for(const algorithm of ['dijkstra','bidirectional','astar']) {
  const r=algorithm==='dijkstra'?dijkstra(graph,snapped.start,snapped.goal):algorithm==='bidirectional'?bidirectional(graph,reverse,snapped.start,snapped.goal):astar(graph,reverse,snapped.start,snapped.goal)
  assert.ok(r.routeMetres>0)
  assert.equal([...r.routeLengths].reduce((a,b)=>a+b,0)/100,r.routeMetres)
  for(let i=0;i<r.routeEdges.length;i++) {
   const e=r.routeEdges[i], backward=r.routeReversed[i]
   assert.ok(backward?graph.direction[e]!==1:graph.direction[e]!==2)
   assert.equal(r.routeNodes[i],backward?graph.to[e]:graph.from[e])
   assert.equal(r.routeNodes[i+1],backward?graph.from[e]:graph.to[e])
  }
  runs.push({algorithm:r.algorithm,routeMetres:r.routeMetres,routeEdges:r.routeEdges.length,events:r.trace.length,searchMs:r.searchMs})
 }
 assert.equal(runs[0].routeMetres,runs[1].routeMetres);assert.equal(runs[0].routeMetres,runs[2].routeMetres)
 routes.push({start,goal,snapping:snapped,runs})
}
const report={dataset:manifest.identity,source:manifest.source,profile:manifest.profile,note:'Five genuine road journeys between Ireland and Northern Ireland. All three production algorithms agree on exact cost; route adjacency and one-way direction checked. No ferry or synthetic cross-border edge is added.',routes}
await writeFile(process.argv[3]??'.cache/ie-crossborder.json',JSON.stringify(report,null,2)+'\n')
console.log(routes.map(r=>({from:r.start.name,to:r.goal.name,km:r.runs[0].routeMetres/1000})))
