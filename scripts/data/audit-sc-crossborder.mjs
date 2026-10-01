// Complete regional topology, including Norway–Sweden and the Øresund road bridge.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readStudyGraph } from './read-study.mjs'
import { dijkstra, snapEndpoints } from '../../src/search/engine.ts'
import { bidirectional, compileReverse } from '../../src/search/bidirectional.ts'
import { astar } from '../../src/search/astar.ts'
import { SC_POOL } from '../../src/ambient/pools.ts'
const { graph, manifest } = await readStudyGraph(process.argv[2]), reverse = compileReverse(graph)
const routes = []
for (const names of [['Oslo','Stockholm'],['Oslo','Copenhagen'],['Malmö','Copenhagen'],['Trondheim','Östersund'],['Aarhus','Stockholm']]) {
  const [start,goal] = names.map(name => SC_POOL.places.find(place => place.name === name))
  assert.ok(start && goal)
  const snapped = snapEndpoints(graph,start,goal), runs = []
  for (const algorithm of ['dijkstra','bidirectional','astar']) {
    const result = algorithm === 'dijkstra' ? dijkstra(graph,snapped.start,snapped.goal) : algorithm === 'bidirectional' ? bidirectional(graph,reverse,snapped.start,snapped.goal) : astar(graph,reverse,snapped.start,snapped.goal)
    assert.ok(result.routeMetres > 0)
    assert.equal([...result.routeLengths].reduce((a,b) => a+b,0)/100,result.routeMetres)
    for (let i=0;i<result.routeEdges.length;i++) {
      const edge=result.routeEdges[i], backward=result.routeReversed[i]
      assert.ok(backward ? graph.direction[edge] !== 1 : graph.direction[edge] !== 2)
      assert.equal(result.routeNodes[i],backward ? graph.to[edge] : graph.from[edge])
      assert.equal(result.routeNodes[i+1],backward ? graph.from[edge] : graph.to[edge])
    }
    runs.push({ algorithm:result.algorithm, routeMetres:result.routeMetres, routeEdges:result.routeEdges.length, events:result.trace.length, searchMs:result.searchMs })
  }
  assert.equal(runs[0].routeMetres,runs[1].routeMetres); assert.equal(runs[0].routeMetres,runs[2].routeMetres)
  routes.push({start,goal,snapping:snapped,runs})
}
await writeFile(process.argv[3] ?? '.cache/sc-crossborder.json',JSON.stringify({dataset:manifest.identity,source:manifest.source,profile:manifest.profile,note:'Five real cross-border road journeys. All three algorithms agree on exact cost, with route adjacency and one-way direction checked. No ferry or synthetic connecting edge.',routes},null,2)+'\n')
console.log(routes.map(r => ({from:r.start.name,to:r.goal.name,km:r.runs[0].routeMetres/1000})))
