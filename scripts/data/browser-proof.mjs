import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from '@playwright/test';
import { cpus, platform, arch } from 'node:os';
const root = resolve(process.argv[2] ?? '.cache/sizing');
const worker = `
onmessage = async () => {
 try {
  let t = performance.now();
  let text = await (await fetch('/graph.json')).text();
  const fetchDecodeMs = performance.now()-t;
  t = performance.now();
  let g = JSON.parse(text); text = null;
  const parseMs = performance.now()-t;
  const N = g.nodeDeltas.length/2, E = g.edgeFromDeltas.length;
  t = performance.now();
  const offsets = new Uint32Array(N+1), xy = new Int32Array(N*2), snapCandidate = new Uint8Array(N), incoming = new Uint32Array(N);
  const snapClasses=new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential']);
  let px=0,py=0,pu=0;
  for (let i=0;i<N;i++) { px+=g.nodeDeltas[2*i];py+=g.nodeDeltas[2*i+1];xy[2*i]=px;xy[2*i+1]=py; }
  for(let i=0;i<E;i++) { const u=pu+g.edgeFromDeltas[i],v=u+g.edgeToRelative[i],dir=g.edgeDirection[i];pu=u;if(dir!==2)offsets[u+1]++;if(dir!==1)offsets[v+1]++; }
  for (let i=1;i<=N;i++) offsets[i]+=offsets[i-1];
  const A=offsets[N], to=new Uint32Array(A), cost=new Uint32Array(A), edge=new Uint32Array(A), cursor=offsets.slice();
  pu=0;
  for (let i=0;i<E;i++) {
   const u=pu+g.edgeFromDeltas[i],v=u+g.edgeToRelative[i],len=g.edgeLengthCm[i],dir=g.edgeDirection[i];pu=u;
   if(snapClasses.has(g.profiles[g.edgeProfile[i]].highway)) {snapCandidate[u]=1;snapCandidate[v]=1;}
   if (dir!==2) {const j=cursor[u]++;to[j]=v;cost[j]=len;edge[j]=i;incoming[v]++;}
   if (dir!==1) {const j=cursor[v]++;to[j]=u;cost[j]=len;edge[j]=i;incoming[u]++;}
  }
  const compileMs=performance.now()-t;
  g=null;
  function nearest(lon,lat,reachable=null) {
   let best=Infinity,id=-1;
   for(let i=0;i<N;i++) if(snapCandidate[i]&&incoming[i]>0&&offsets[i]<offsets[i+1]&&(!reachable||reachable[i])) {
    const d=((xy[2*i]/1e5-lon)*Math.cos(lat*Math.PI/180))**2+(xy[2*i+1]/1e5-lat)**2;
    if(d<best) {best=d;id=i;}
   }
   return id;
  }
  const start=nearest(8.5417,47.3769);
  t=performance.now();
  const reachable=new Uint8Array(N),queue=new Uint32Array(N);reachable[start]=1;queue[0]=start;
  let qend=1;
  for(let q=0;q<qend;q++){const u=queue[q];for(let a=offsets[u];a<offsets[u+1];a++){const v=to[a];if(!reachable[v]){reachable[v]=1;queue[qend++]=v;}}}
  const reachabilityMs=performance.now()-t;
  const goal=nearest(6.1432,46.2044,reachable);
  const runs=[];
  for(let run=0;run<3;run++) {
   t=performance.now();
   const dist=new Float64Array(N).fill(Infinity), prev=new Int32Array(N).fill(-1), settled=new Uint8Array(N);
   const heapNodes=new Uint32Array(A+2),heapCosts=new Float64Array(A+2);
   const trace=new Uint32Array(2*(N+2*A));let traceUsed=0,heapLength=0;
   function event(type,id) {trace[traceUsed++]=type;trace[traceUsed++]=id;}
   function push(n,d) {
    let i=++heapLength;
    while(i>1) {const p=i>>1;if(heapCosts[p]<=d)break;heapCosts[i]=heapCosts[p];heapNodes[i]=heapNodes[p];i=p;}
    heapCosts[i]=d;heapNodes[i]=n;
   }
   function pop() {
    const result=heapNodes[1], n=heapNodes[heapLength], d=heapCosts[heapLength--];
    let i=1;
    while(i*2<=heapLength) {let child=i*2;if(child+1<=heapLength&&heapCosts[child+1]<heapCosts[child])child++;if(heapCosts[child]>=d)break;heapCosts[i]=heapCosts[child];heapNodes[i]=heapNodes[child];i=child;}
    heapCosts[i]=d;heapNodes[i]=n;return result;
   }
   dist[start]=0;push(start,0);
   let visited=0,examined=0,improved=0;
   while(heapLength) {
    const u=pop();if(settled[u])continue;settled[u]=1;visited++;event(1,u);
    if(u===goal)break;
    for(let a=offsets[u];a<offsets[u+1];a++) {
     examined++;event(2,a);
     const v=to[a],d=dist[u]+cost[a];
     if(d<dist[v]) {dist[v]=d;prev[v]=u;push(v,d);improved++;event(3,a);}
    }
   }
   const searchMs=performance.now()-t;
   let routeNodes=0,u=goal;
   if(Number.isFinite(dist[goal])) while(u!==-1) {routeNodes++;u=prev[u];if(routeNodes>N)throw Error('cycle');}
   runs.push({searchMs,visited,examined,improved,routeMetres:dist[goal]/100,routeNodes,traceEvents:traceUsed/2,traceUsedBytes:traceUsed*4,allocatedSearchBytes:dist.byteLength+prev.byteLength+settled.byteLength+heapNodes.byteLength+heapCosts.byteLength+trace.byteLength});
  }
  t=performance.now();
  text=await(await fetch('/geometry-5m.json')).text();
  const geometryFetchDecodeMs=performance.now()-t;
  t=performance.now();
  let geo=JSON.parse(text);text=null;
  const geometryParseMs=performance.now()-t;
  if(geo.counts.length!==E) throw Error('geometry edge mismatch');
  const geomOffsets=new Uint32Array(E+1),deltas=Int32Array.from(geo.deltas);
  for(let i=0;i<E;i++)geomOffsets[i+1]=geomOffsets[i]+geo.counts[i];
  geo=null;
  postMessage({nodes:N,physicalEdges:E,directedArcs:A,fetchDecodeMs,parseMs,compileMs,geometryFetchDecodeMs,geometryParseMs,reachabilityMs,reachableNodes:qend,snapping:'Nearest node with both incoming and outgoing arcs on a residential/unclassified/tertiary-or-higher road; destination must be reachable from origin. Service/living streets excluded from endpoint selection only.',typedGraphBytes:offsets.byteLength+xy.byteLength+to.byteLength+cost.byteLength+edge.byteLength,typedGeometryBytes:geomOffsets.byteLength+deltas.byteLength,origin:[xy[2*start]/1e5,xy[2*start+1]/1e5],destination:[xy[2*goal]/1e5,xy[2*goal+1]/1e5],runs});
 } catch(e) { postMessage({error:String(e),stack:e.stack}); }
};`;
const server=createServer(async(req,res)=>{
 try {
  if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end('<title>PFAD sizing</title>');return;}
  if(req.url==='/worker.js') {res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
  if(!['/graph.json','/geometry-5m.json'].includes(req.url)) {res.writeHead(404);res.end();return;}
  const body=await readFile(root+'/runtime-'+req.url.slice(1)+'.gz');
  res.setHeader('Content-Type','application/json');res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Length',body.length);res.end(body);
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const report={machine:{cpu:cpus()[0].model,platform:platform(),arch:arch()},note:'Desktop headless browser, local HTTP gzip, straight distance costs, baseline connectivity only; routing restrictions retained in dataset but not enforced by benchmark; no rendering or mobile performance measured.',browsers:{}};
try {
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
  let browser;
  try {
   browser=await engine.launch({headless:true});
   const page=await browser.newPage();
   await page.goto('http://127.0.0.1:'+server.address().port);
   report.browsers[name]={version:browser.version(),result:await page.evaluate(()=>new Promise((resolve,reject)=>{const w=new Worker('/worker.js');w.onmessage=e=>{w.terminate();resolve(e.data)};w.onerror=e=>reject(String(e.message));w.postMessage({})}))};
   console.log(name,JSON.stringify(report.browsers[name]));
  }catch(e){report.browsers[name]={error:String(e)};console.log(name,String(e));}
  finally{if(browser)await browser.close();}
 }
 await writeFile(root+'/browser-report.json',JSON.stringify(report,null,2)+'\n');
}finally{server.close();}
