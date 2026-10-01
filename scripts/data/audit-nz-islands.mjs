import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readStudyGraph } from './read-study.mjs'
import { dijkstra, snapEndpoints } from '../../src/search/engine.ts'
import { compileReverse, bidirectional } from '../../src/search/bidirectional.ts'
import { astar } from '../../src/search/astar.ts'
import { longitudeOffset } from '../../src/search/projection.ts'
const {graph,manifest}=await readStudyGraph(process.argv[2] ?? '.cache/countries/nz-20260930-7bbcde863f2e/manifest.json'),reverse=compileReverse(graph)
const start={name:'Waitangi',lon:-176.559,lat:-43.951},goal={name:'Owenga',lon:-176.369,lat:-44.025}
const snapped=snapEndpoints(graph,start,goal),runs=[dijkstra(graph,snapped.start,snapped.goal),bidirectional(graph,reverse,snapped.start,snapped.goal),astar(graph,reverse,snapped.start,snapped.goal)]
assert.ok(runs[0].routeMetres>1000)
for(const run of runs)assert.equal(run.routeMetres,runs[0].routeMetres)
assert.ok(longitudeOffset(start.lon,175,true)>0)
const mainland={name:'Wellington',lon:174.7762,lat:-41.2865},apart=snapEndpoints(graph,mainland,start),disconnected=dijkstra(graph,apart.start,apart.goal)
assert.equal(disconnected.routeMetres,null)
let offshoreNodes=0;for(let i=0;i<graph.xy.length;i+=2)if(graph.xy[i]<-17500000)offshoreNodes++
assert.ok(offshoreNodes>0)
const report={dataset:manifest.identity,offshoreNodes,requested:{start,goal},snapped,runs:runs.map(run=>({algorithm:run.algorithm,routeMetres:run.routeMetres,events:run.trace.length})),mainlandToChatham:{routeMetres:disconnected.routeMetres},note:'Actual complete graph: three equal-cost road routes within Chatham Island; mainland-to-island search is disconnected. Drawing wraps independently of road coordinates.'}
await writeFile('.cache/nz-islands-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
