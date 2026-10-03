// Local complete-country desktop experiment. Serve only the chosen immutable
// chunks, then use the worker/search/renderer from the selected checkout.
import { createServer } from 'vite'
import { chromium, webkit } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import { cpus, totalmem } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execute = promisify(execFile)

const manifestPath = resolve(process.argv[2]), out = resolve(process.argv[3] ?? '.cache/desktop-country')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
await mkdir(out, { recursive: true })
const journeys = process.argv[4] ? JSON.parse(await readFile(resolve(process.argv[4]), 'utf8')) : [
  { name: 'San Francisco–New York', start: { name: 'San Francisco', lon: -122.4194, lat: 37.7749 }, goal: { name: 'New York', lon: -74.006, lat: 40.7128 } },
  { name: 'Seattle–Miami', start: { name: 'Seattle', lon: -122.3321, lat: 47.6062 }, goal: { name: 'Miami', lon: -80.1918, lat: 25.7617 } },
]
const html = `<html><head><meta charset="utf-8"><title>PFAD Southern Africa desktop feasibility</title><link rel="icon" href="data:,">
<style>body{margin:0;background:#080d10;color:#bcdcd0;font:14px monospace}main{position:absolute;inset:0}.map-markers{display:none}header{position:absolute;left:20px;top:20px;pointer-events:none}#status{white-space:pre-wrap}</style></head><body><main></main><header>PFAD · Southern Africa desktop experiment<div id="status"></div></header><script type="module">
import { RoadScene } from '/src/map/RoadScene.ts';
import { replayFrame } from '/src/map/routeReveal.ts';
const scene=new RoadScene(document.querySelector('main'));
const worker=new Worker(new URL('/src/search/search.worker.ts',import.meta.url),{type:'module'});
const status=message=>{document.querySelector('#status').textContent=message;window.proof.stage=message};
window.proof={ready:false,errors:[],runs:[],geometryVertices:0,largestRoadId:0};
let pending;const started=performance.now();
worker.onmessage=({data})=>{
 if(data.type==='manifest')scene.setManifest(data.manifest);
 if(data.type==='progress')status(data.stage+' · '+Math.round(data.loaded/1e6)+' / '+Math.round(data.total/1e6)+' MB');
 if(data.type==='geometry'){
  scene.addGeometry(data.bytes,data.count);
  window.proof.geometryVertices+=data.count;
  const ids=${manifest.counts.edges > 16777216 ? 'new Uint32Array' : 'new Float32Array'}(data.bytes,data.count*8,data.count);
  window.proof.largestRoadId=Math.max(window.proof.largestRoadId,ids[ids.length-1]);
 }
 if(data.type==='ready'){window.proof.ready=true;window.proof.loadMs=performance.now()-started;window.proof.loading=data.measurements;status('Complete US graph ready');}
 if(data.type==='error'){window.proof.errors.push(data.message);if(pending){pending.reject(Error(data.message));pending=null;}}
 if(data.type==='result'){pending.resolve(data.result);pending=null;}
};
worker.onerror=e=>{window.proof.errors.push(e.message);if(pending){pending.reject(Error(e.message));pending=null;}};
worker.postMessage({type:'load',manifestUrl:location.origin+'/experiment/manifest.json'});
window.run=async (journey,algorithm,replay)=>{
 scene.clearResult();status('Computing '+journey.name+' · '+algorithm);
 const r=await new Promise((resolve,reject)=>{pending={resolve,reject};worker.postMessage({type:'search',requestId:1,algorithm,start:journey.start,goal:journey.goal});});
 if(r.routeMetres===null)throw Error('Coast-to-coast route disconnected');
 if(r.routeLengths.reduce((a,b)=>a+b,0)/100!==r.routeMetres)throw Error('Route length mismatch');
 status('Search complete · hashing exact trace');
 const traceSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.trace)),n=>n.toString(16).padStart(2,'0')).join('');
 const record={journey:journey.name,algorithm:r.algorithm,routeMetres:r.routeMetres,routeEdges:r.routeEdges.length,events:r.trace.length,traceBytes:r.trace.byteLength,traceSha256,searchMs:r.searchMs,snapMs:r.snapMs,heuristic:r.heuristic,nodesSettled:r.exploredNodes,arcsExamined:r.examinedArcs,maxQueue:r.maxQueue,tieBreak:r.tieBreak,dataset:r.dataset,textureWidth:r.textureWidth,textureHeight:r.textureHeight,timestampBytes:r.edgeTimes.byteLength+(r.backwardTimes?.byteLength??0),start:r.start,goal:r.goal};
 if(replay){
  status('Preparing full national drawing');const preparationStarted=performance.now();await scene.prepareResult(r);scene.setResult(r);scene.setProgress(0);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  record.preparationMs=performance.now()-preparationStarted;
  const intervals=[];let previous=performance.now(),begun=previous;
  status('Replaying exact coast-to-coast trace · 15 seconds');
  await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;const progress=Math.min(1,(now-begun)/15000);scene.setProgress(progress);if(progress<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
  record.replayMs=previous-begun;record.frames=intervals.length;record.averageFps=intervals.length*1000/record.replayMs;
  intervals.sort((a,b)=>a-b);record.frameIntervalMedianMs=intervals[Math.floor(intervals.length*.5)];record.frameIntervalP95Ms=intervals[Math.floor(intervals.length*.95)];
  for(const progress of [.8,.2,.65,1]){scene.setProgress(progress);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(Number(scene.renderer.domElement.dataset.event)!==Math.floor(replayFrame(progress,scene.replayDuration,true).search*r.trace.length))throw Error('Seeking changed the recorded event index');}
  record.webglError=scene.renderer.getContext().getError();if(record.webglError!==0)throw Error('WebGL error '+record.webglError);
  record.roadVertices=Number(scene.renderer.domElement.dataset.roadVertices);
  record.replayVertices=Number(scene.renderer.domElement.dataset.replayVertices);record.retainedRoadCpuBytes=Number(scene.renderer.domElement.dataset.roadCpuBytes);
 }
 window.proof.runs.push(record);status('Completed '+journey.name+' · '+algorithm);return record;
};
</script></body></html>`
const allowed = new Set(['manifest.json', ...manifest.chunks.map(c => c.path)])
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 4215, strictPort: true }, plugins: [{ name: 'desktop-country-experiment', configureServer(server) {
 server.middlewares.use(async (req,res,next)=>{
  if(req.url==='/desktop-proof'){res.setHeader('Content-Type','text/html');res.end(html);return}
  if(!req.url?.startsWith('/experiment/')){next();return}
  const name=req.url.slice('/experiment/'.length)
  if(basename(name)!==name||!allowed.has(name)){res.statusCode=404;res.end();return}
  try{res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'application/octet-stream');res.end(await readFile(resolve(dirname(manifestPath),name)))}catch(error){res.statusCode=500;res.end(String(error))}
 })
} }] })
const report={measuredAt:new Date().toISOString(),host:{cpu:cpus()[0].model,ramBytes:totalmem()},manifest,browsers:[],note:'Complete immutable graph and drawing, production algorithms; isolated measured resource guards and any ID/texture adaptations are recorded separately. Local serving excludes internet download latency. Desktop only; process-tree RSS is sampled once per second, can double-count shared pages or miss reparented/XPC helpers, and does not capture all GPU allocations.'}
const save=()=>writeFile(resolve(out,'desktop-report.json'),JSON.stringify(report,null,2)+'\n')
try{
 await server.listen()
 for(const [name,engine,args] of [['chromium-metal',chromium,['--use-angle=metal']],['webkit-desktop',webkit,[]]]){
  let browser, launched, observation;const record={name,errors:[],runs:[],peakProcessTreeRssBytes:0};report.browsers.push(record)
  try{
   launched=await engine.launchServer({args});browser=await engine.connect(launched.wsEndpoint());record.version=browser.version()
   const rootPid=launched.process().pid
   observation=setInterval(async()=>{
    try{
     const {stdout}=await execute('ps',['-axo','pid=,ppid=,rss='])
     const rows=stdout.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number)),selected=new Set([rootPid])
     let changed=true;while(changed){changed=false;for(const [pid,parent] of rows)if(selected.has(parent)&&!selected.has(pid)){selected.add(pid);changed=true}}
     const rss=rows.filter(([pid])=>selected.has(pid)).reduce((sum,row)=>sum+row[2]*1024,0)
     record.peakProcessTreeRssBytes=Math.max(record.peakProcessTreeRssBytes,rss)
    }catch(error){record.memoryObservationError=String(error)}
   },1000)
   const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
   page.on('pageerror',error=>record.errors.push(error.message))
   page.on('console',message=>{if(message.type()==='error')record.errors.push(message.text())})
   page.on('crash',()=>record.errors.push('Browser page crashed'))
   await page.goto('http://127.0.0.1:4215/desktop-proof')
   await page.waitForFunction(()=>window.proof?.ready||window.proof?.errors.length,null,{timeout:600000})
   const opening=await page.evaluate(()=>window.proof)
   if(!opening.ready)throw Error(opening.errors.join('; '))
   if(opening.geometryVertices!==manifest.counts.vertices||opening.largestRoadId!==manifest.counts.edges-1)throw Error('Drawing coverage or road-ID precision failed')
   record.loadMs=opening.loadMs;record.loading=opening.loading;record.largestRoadId=opening.largestRoadId;record.roadVertices=opening.geometryVertices
   record.gl=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)}})
   for(const [journey,algorithm,replay] of [[journeys[0],'bidirectional',true],[journeys[0],'bidirectional',true],[journeys[0],'astar',true],[journeys[0],'dijkstra',true],[journeys[1],'bidirectional',true]]){
    record.current={journey:journey.name,algorithm};await save()
    const run=await page.evaluate(async ({journey,algorithm,replay})=>Promise.race([window.run(journey,algorithm,replay),new Promise((_,reject)=>setTimeout(()=>reject(Error('Search/replay exceeded five minutes')),300000))]),{journey,algorithm,replay})
    record.runs.push(run);await save();console.log(name,JSON.stringify(run))
   }
   if(record.runs[0].traceSha256!==record.runs[1].traceSha256)throw Error('Repeated bidirectional trace differs')
   if(record.runs.slice(0,4).some(run=>run.routeMetres!==record.runs[0].routeMetres))throw Error('Algorithms disagree on shortest route cost')
   await page.screenshot({path:resolve(out,name+'.png')});record.errors.push(...await page.evaluate(()=>window.proof.errors));delete record.current
  }catch(error){record.errors.push(String(error));console.log(name,String(error))}
  finally{clearInterval(observation);await browser?.close();await launched?.close();await save()}
 }
}finally{await server.close();await save()}
if(report.browsers.some(browser=>browser.errors.length))process.exitCode=1
