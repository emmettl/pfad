import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { readStudyGraph } from '../../scripts/data/read-study.mjs'
import { snapEndpoints } from '../../src/search/engine.ts'
import { compileReverse, arcSource } from '../../src/search/bidirectional.ts'
import { SA_POOL } from '../../src/ambient/pools.ts'
const {graph:g,manifest:m}=await readStudyGraph(process.argv[2]),reverse=compileReverse(g),places=SA_POOL.places;
const checks=places.map(place=>{const a=snapEndpoints(g,places[0],place),b=snapEndpoints(g,place,places[0]);assert.equal(a.start.node,b.goal.node);assert.equal(a.goal.node,b.start.node);assert.ok(a.start.snapMetres<2000&&a.goal.snapMetres<2000);return {place,snapping:a}});
const source=checks[0].snapping.start.node;assert.ok(checks.every(c=>c.snapping.start.node===source));
function reach(offsets,to,reversed=false){const seen=new Uint8Array(m.counts.nodes),queue=new Uint32Array(seen.length);seen[source]=1;queue[0]=source;let end=1;for(let q=0;q<end;q++)for(let a=offsets[queue[q]];a<offsets[queue[q]+1];a++){const v=reversed?arcSource(g,to[a]):to[a];if(!seen[v]){seen[v]=1;queue[end++]=v}}return {seen,count:end}}
const forward=reach(g.offsets,g.arcTo),backward=reach(reverse.offsets,reverse.arc,true);
for(const c of checks){assert.equal(forward.seen[c.snapping.goal.node],1);assert.equal(backward.seen[c.snapping.goal.node],1)}
await writeFile('.cache/sa/manual-endpoints.json',JSON.stringify({dataset:m.identity,pool:SA_POOL.version,source:m.source,forwardReachableNodes:forward.count,reverseReachableNodes:backward.count,note:'All 44 authored mainland places have reversal-stable snaps within 2 km and directed reachability both to and from the same Cape Town node, proving mutual directed reachability for every pair.',checks},null,2)+'\n');console.log('All',places.length,'places are mutually reachable in both directions');
