import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { readStudyGraph } from './read-study.mjs'
import { dijkstra, snapEndpoints } from '../../src/search/engine.ts'
import { astar } from '../../src/search/astar.ts'
import { bidirectional, compileReverse } from '../../src/search/bidirectional.ts'
const {graph:g,manifest:m}=await readStudyGraph(process.argv[2]);
const parent=Uint32Array.from({length:m.counts.nodes},(_,i)=>i),sizes=new Uint32Array(parent.length).fill(1);
function root(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x}
let roadCm=0;
for(let e=0;e<g.from.length;e++){let a=root(g.from[e]),b=root(g.to[e]);if(a!==b){if(sizes[a]<sizes[b])[a,b]=[b,a];parent[b]=a;sizes[a]+=sizes[b]}roadCm+=g.length[e]}
const bounds=[Infinity,Infinity,-Infinity,-Infinity];
for(let i=0;i<g.xy.length;i+=2){const lon=g.xy[i]/100000,lat=g.xy[i+1]/100000;bounds[0]=Math.min(bounds[0],lon);bounds[1]=Math.min(bounds[1],lat);bounds[2]=Math.max(bounds[2],lon);bounds[3]=Math.max(bounds[3],lat)}
assert.ok(bounds[0]>=92&&bounds[1]>=1&&bounds[2]<109&&bounds[3]<29, 'Unexpected regional coverage');
let components=0,largest=0;for(let i=0;i<parent.length;i++)if(parent[i]===i){components++;largest=Math.max(largest,sizes[i])}
const places=[['Thailand','Bangkok',100.5018,13.7563],['Myanmar','Yangon',96.1951,16.8661],['Cambodia','Phnom Penh',104.9282,11.5564],['Laos','Vientiane',102.6331,17.9757],['Malaysia','Kuala Lumpur',101.6869,3.1390],['Singapore','Singapore',103.8198,1.3521]].map(([country,name,lon,lat])=>({country,name,lon,lat}));
const reverse=compileReverse(g),routes=[];
for(const goal of places.slice(1)){
 const snapped=snapEndpoints(g,places[0],goal);assert.ok(snapped.start.snapMetres<2000&&snapped.goal.snapMetres<2000);assert.equal(root(snapped.start.node),root(snapped.goal.node));
 const runs=[];
 for(const algorithm of ['astar','bidirectional','dijkstra']){
  const r=algorithm==='astar'?astar(g,reverse,snapped.start,snapped.goal):algorithm==='bidirectional'?bidirectional(g,reverse,snapped.start,snapped.goal):dijkstra(g,snapped.start,snapped.goal);
  assert.ok(r.routeMetres>0);assert.equal(r.routeLengths.reduce((a,b)=>a+b,0)/100,r.routeMetres);
  for(let i=0;i<r.routeEdges.length;i++){const e=r.routeEdges[i],rev=r.routeReversed[i];assert.ok(rev?g.direction[e]!==1:g.direction[e]!==2);assert.equal(r.routeNodes[i],rev?g.to[e]:g.from[e]);assert.equal(r.routeNodes[i+1],rev?g.from[e]:g.to[e])}
  runs.push({algorithm:r.algorithm,routeMetres:r.routeMetres,routeEdges:r.routeEdges.length,events:r.trace.length,traceSha256:createHash('sha256').update(new Uint8Array(r.trace.buffer,r.trace.byteOffset,r.trace.byteLength)).digest('hex'),searchMs:r.searchMs,tieBreak:r.tieBreak});
 }
 assert.equal(runs[0].routeMetres,runs[1].routeMetres);assert.equal(runs[0].routeMetres,runs[2].routeMetres);
 routes.push({start:places[0],goal,snapping:snapped,runs});console.log(goal.name,runs[0].routeMetres/1000,'km, three algorithms agree');
}
await writeFile(process.argv[3] ?? '.cache/sea-preparation/audit.json',JSON.stringify({dataset:m.identity,source:m.source,compiler:m.compiler,profile:m.profile,counts:m.counts,downloadBytes:m.downloadBytes,weakComponents:components,largestWeakComponentNodes:largest,largestWeakComponentFraction:largest/parent.length,physicalRoadKm:roadCm/100000,boundsLonLat:bounds,routes,note:'Complete union; hashes and manifest limits validated. Weak components ignore direction. Five directed city journeys verify road connectivity across all six countries; route adjacency, one-way direction and exact cost checked across three algorithms. Basic access connectivity profile, not enforced turn/barrier/conditional navigation.'},null,2)+'\n');
