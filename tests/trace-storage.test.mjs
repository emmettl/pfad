import {test} from 'vitest'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {archiveTrace, disposeTrace, TRACE_BLOCK_BYTES} from '../src/records/trace-storage.ts'
import {traceLength} from '../src/search/trace.ts'
import {countsAt} from '../src/search/engine.ts'
import {exportRecord} from '../src/records/export.ts'

function fixture(n=8197) {
 const trace=new Uint32Array(n),checkpoints=[];let seed=7,counts=[0,0,0]
 for(let i=0;i<n;i++){if(i%4096===0)checkpoints.push(...counts);seed=(Math.imul(seed,1664525)+1013904223)>>>0;trace[i]=seed;if((seed&3)<3)counts[seed&3]++}
 if(n%4096===0)checkpoints.push(...counts)
 return {trace,checkpoints:Uint32Array.from(checkpoints),checkpointStride:4096,algorithm:'astar/1',tieBreak:'exact',dataset:{identity:'verified'},edgeTimes:new Uint32Array([1,2]),routeNodes:new Uint32Array([7]),routeEdges:new Uint32Array(0),routeLengths:new Uint32Array(0),routeReversed:new Uint8Array(0)}
}
function memory() {return {blocks:new Map(),disposed:0,async write(i,b){this.blocks.set(i,b.slice())},async read(i){return this.blocks.get(i).slice()},async commit(meta){this.metadata=meta},async dispose(){this.disposed++;this.blocks.clear()}}}
const manifest={source:{attribution:'OSM',licence:'ODbL',licenceUrl:'https://www.openstreetmap.org/copyright'}}
const archive=(r,store,options={})=>archiveTrace(r,{minimumBytes:1,store:async()=>store,...options})
test('archived counters and streamed export match the complete original record exactly',async()=>{
 const r=fixture(),store=memory(),positions=[0,.1,.5,1,.9,0],expected=positions.map(p=>countsAt(r,p)),original=gunzipSync(Buffer.from(await(await exportRecord(r,manifest,{},[])).arrayBuffer()))
 const count=r.trace.length;assert.equal(await archive(r,store),true);assert.equal(r.trace.byteLength,0);assert.equal(traceLength(r),count)
 positions.forEach((p,i)=>assert.deepEqual(countsAt(r,p),expected[i]));assert.equal(store.metadata.count,count)
 const exported=gunzipSync(Buffer.from(await(await exportRecord(r,manifest,{},[])).arrayBuffer()));assert.deepEqual(exported,original)
 await disposeTrace(r);assert.equal(store.disposed,1)
})
test('multiple blocks retain all exact bytes and original count',async()=>{
 const r=fixture(TRACE_BLOCK_BYTES/4+17),saved=r.trace.slice(),store=memory();assert.equal(await archive(r,store),true);assert.equal(r.traceArchive.blocks,2)
 const a=await r.traceArchive.readBlock(0),b=await r.traceArchive.readBlock(1)
 assert.deepEqual(Buffer.concat([Buffer.from(a),Buffer.from(b)]),Buffer.from(saved.buffer));await disposeTrace(r)
})
test('write and metadata failures retain original trace and remove partial storage',async()=>{
 for(const stage of ['write','commit']){const r=fixture(),original=r.trace.slice(),store=memory();store[stage]=async()=>{throw Error('quota')};assert.equal(await archive(r,store),false);assert.deepEqual(r.trace,original);assert.equal(r.traceArchive,undefined);assert.equal(store.disposed,1)}
})
test('cancellation and superseded searches retain the original trace',async()=>{
 for(const options of [{signal:AbortSignal.abort()},{valid:()=>false}]){const r=fixture(),original=r.trace.slice(),store=memory();assert.equal(await archive(r,store,options),false);assert.deepEqual(r.trace,original);assert.equal(r.traceArchive,undefined)}
 const controller=new AbortController(),r=fixture(),original=r.trace.slice(),store=memory();store.write=async()=>controller.abort();assert.equal(await archive(r,store,{signal:controller.signal}),false);assert.deepEqual(r.trace,original);assert.equal(store.disposed,1)
})
test('damaged recording blocks fail export without invented events',async()=>{
 const r=fixture(),store=memory();await archive(r,store);store.blocks.get(0)[0]^=1;await assert.rejects(exportRecord(r,manifest,{},[]),/could not be verified/);await disposeTrace(r)
})
test('retirement waits for a concurrent export lease',async()=>{
 const r=fixture(),store=memory();await archive(r,store);let resume;const wait=new Promise(resolve=>{resume=resolve}),read=store.read.bind(store);store.read=async i=>{await wait;return read(i)}
 const pending=exportRecord(r,manifest,{},[]);await disposeTrace(r);assert.equal(store.disposed,0);resume();await pending;assert.equal(store.disposed,1);assert.throws(()=>r.traceArchive.retain(),/retired/)
})
test('small traces stay resident and shared backing storage is preserved',async()=>{
 const small=fixture(),store=memory();assert.equal(await archiveTrace(small,{store:async()=>store}),false);assert.equal(small.traceArchive,undefined)
 const r=fixture(),shared=new Uint32Array(r.trace.length+2);shared.set(r.trace,1);r.trace=shared.subarray(1,-1);const original=shared.slice();await archive(r,store);assert.deepEqual(shared,original);await disposeTrace(r)
})
