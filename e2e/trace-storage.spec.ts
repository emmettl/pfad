import { test, expect } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
let server: ViteDevServer, url: string
const html = `<script type="module">
import {archiveTrace,disposeTrace,cleanupTraceStorage} from '/src/records/trace-storage.ts';
import {exportRecord} from '/src/records/export.ts';
import {countsAt} from '/src/search/engine.ts';
import {traceLength} from '/src/search/trace.ts';
window.proof=async()=>{
 const n=2097169,trace=new Uint32Array(n),checkpoints=[];let seed=7,counts=[0,0,0];
 for(let i=0;i<n;i++){if(i%4096===0)checkpoints.push(...counts);seed=(Math.imul(seed,1664525)+1013904223)>>>0;trace[i]=seed;if((seed&3)<3)counts[seed&3]++}
 const r={trace,checkpoints:Uint32Array.from(checkpoints),checkpointStride:4096,algorithm:'astar/1',tieBreak:'exact',dataset:{identity:'fixture'},edgeTimes:new Uint32Array([1,2]),routeNodes:new Uint32Array([7]),routeEdges:new Uint32Array(0),routeLengths:new Uint32Array(0),routeReversed:new Uint8Array(0)};
 const m={source:{attribution:'OSM',licence:'ODbL',licenceUrl:'https://www.openstreetmap.org/copyright'}};
 const hash=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()))).join(',');
 const original=await hash(await exportRecord(r,m,{},[])),expected=Array.from({length:101},(_,i)=>countsAt(r,i/100));
 const archived=await archiveTrace(r,{minimumBytes:1}),count=traceLength(r),bytes=r.trace.byteLength,blocks=r.traceArchive?.blocks;
 const counters=expected.every((v,i)=>JSON.stringify(v)===JSON.stringify(countsAt(r,i/100)));
 const abandoned=await new Promise(resolve=>{const q=indexedDB.open('pfad-exact-traces-v1',1);q.onsuccess=()=>resolve(q.result)});
 await new Promise(resolve=>{const tx=abandoned.transaction(['blocks','records'],'readwrite');tx.objectStore('records').put({state:'writing'},'abandoned');tx.objectStore('blocks').put(new ArrayBuffer(4),'abandoned:0');tx.oncomplete=resolve});abandoned.close();
 await cleanupTraceStorage();
 const exported=await hash(await exportRecord(r,m,{},[]));
 const release=r.traceArchive?.retain();await disposeTrace(r);const held=await r.traceArchive.readBlock(0);release();
 const cancelled={...r,trace:new Uint32Array([1,2,3]),traceArchive:undefined};let calls=0;
 const cancelledArchived=await archiveTrace(cancelled,{minimumBytes:1,valid:()=>++calls<2});
 await new Promise(resolve=>setTimeout(resolve,20));
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('pfad-exact-traces-v1',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
 const remaining=await new Promise(resolve=>{const tx=db.transaction(['blocks','records']);let blocks,records;const a=tx.objectStore('blocks').count(),b=tx.objectStore('records').count();a.onsuccess=()=>blocks=a.result;b.onsuccess=()=>records=b.result;tx.oncomplete=()=>resolve({blocks,records})});db.close();
 return {archived,count,bytes,blocks,counters,exportExact:original===exported,leaseReadBytes:held.byteLength,cancelledArchived,cancelledBytes:cancelled.trace.byteLength,remaining};
};window.ready=true;
</script>`
const clearHtml = `<body><script type="module">
import {RoadScene} from '/src/map/RoadScene.ts';import {Color} from '/node_modules/three/build/three.module.js';
window.scene=new RoadScene(document.body);window.clearReady=true;window.clearProof=async()=>{
 const gl=scene.renderer.getContext(),color=()=>({gl:[...gl.getParameter(gl.COLOR_CLEAR_VALUE)],renderer:scene.renderer.getClearColor(new Color()).getHexString()});const before=color();
 const extension=gl.getExtension('WEBGL_lose_context');extension.loseContext();await new Promise(resolve=>setTimeout(resolve,100));
 const restored=new Promise(resolve=>scene.renderer.domElement.addEventListener('webglcontextrestored',resolve,{once:true}));extension.restoreContext();await restored;
 scene.resize();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {before,after:color()};
};</script>`
test.beforeAll(async () => {
 server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0},plugins:[{name:'trace-proof',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/trace-proof'||req.url==='/clear-proof'){res.setHeader('Content-Type','text/html');res.end(req.url==='/clear-proof'?clearHtml:html)}else next()})}}]})
 await server.listen();const address=server.httpServer!.address();url=`http://127.0.0.1:${typeof address==='object' && address ? address.port : 0}/trace-proof`
})
test.afterAll(async()=>{await server?.close()})
test('exact archived traces stream exports and retire safely in browser storage',async({page})=>{
 await page.goto(url);await page.waitForFunction(()=>window.ready)
 const proof=await page.evaluate(()=>window.proof())
 expect(proof).toEqual({archived:true,count:2097169,bytes:0,blocks:2,counters:true,exportExact:true,leaseReadBytes:8*1024*1024,cancelledArchived:false,cancelledBytes:12,remaining:{blocks:0,records:0}})
})

test('context recovery preserves the dark field without geographic fill',async({page})=>{
 await page.goto(url.replace('/trace-proof','/clear-proof'));await page.waitForFunction(()=>window.clearReady)
 const proof=await page.evaluate(()=>window.clearProof());expect(proof.before.renderer).toBe('080d10');expect(proof.after).toEqual(proof.before)
})
