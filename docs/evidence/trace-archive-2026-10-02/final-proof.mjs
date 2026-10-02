import {execFileSync} from 'node:child_process'
import { createServer } from 'vite'
import { chromium, webkit } from '@playwright/test'
import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { resolve,dirname,basename } from 'node:path'
const [variant,country='de',engineName='chromium',algorithm='bidirectional']=process.argv.slice(2)
const root=resolve('.cache/trace-integration/us-final'),out=resolve('.cache/trace-integration/'+variant+'-'+country+'-'+engineName+'-'+algorithm+(process.env.PFAD_LOCAL_ROUTE?'-local':''))
await mkdir(out,{recursive:true})
const path=country==='us'?(await readFile('.cache/replay-optimization/manifest-path.txt','utf8')).trim():resolve('.cache/countries/de-20260929-083582060611/manifest.json')
const manifest=JSON.parse(await readFile(path,'utf8')),allowed=new Set(['manifest.json',...manifest.chunks.map(c=>c.path)])
const html=`<html><head><link rel="icon" href="data:,"><style>body{margin:0}main{position:absolute;inset:0}.map-markers,.search-tip{display:none}</style></head><body><main></main><script type="module">
import {RoadScene} from '/src/map/RoadScene.ts';import {archiveTrace,disposeTrace,TRACE_BLOCK_BYTES} from '/src/records/trace-storage.ts';import {traceLength} from '/src/search/trace.ts';import {countsAt} from '/src/search/engine.ts';
window.scene=new RoadScene(document.querySelector('main'));window.ready=false;window.errors=[];
const worker=new Worker(new URL('/src/search/search.worker.ts',import.meta.url),{type:'module'});let pending;
worker.onmessage=({data})=>{if(data.type==='manifest')scene.setManifest(data.manifest);if(data.type==='geometry')scene.addGeometry(data.bytes,data.count,!!data.drawingEncoding);if(data.type==='ready')window.ready=true;if(data.type==='error')window.errors.push(data.message);if(data.type==='result')pending(data.result)};
worker.postMessage({type:'load',manifestUrl:location.origin+'/experiment/manifest.json',compactDrawing:true,releaseAfterSearch:true});
window.compute=async(start,goal,algorithm)=>{await window.memoryPhase('search');if(window.startProfile)await window.startProfile();const r=await new Promise(resolve=>{pending=resolve;worker.postMessage({type:'search',requestId:1,start,goal,algorithm})});if(window.stopProfile)await window.stopProfile();worker.terminate();window.result=r;await window.memoryPhase('trace-hash');const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.trace)),v=>v.toString(16).padStart(2,'0')).join('');const traceCount=traceLength(r),expected=Array.from({length:101},(_,i)=>countsAt(r,i/100)),archiveStart=performance.now();await window.memoryPhase('archive');const archived=${variant!=='baseline'}?await archiveTrace(r):false;const archiveMs=performance.now()-archiveStart,countersExact=expected.every((v,i)=>JSON.stringify(v)===JSON.stringify(countsAt(r,i/100)));await window.memoryPhase('drawing-preparation');const begun=performance.now();let last=begun,maxGap=0;const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now},8);await scene.prepareResult(r);clearInterval(timer);scene.setResult(r);return {sha,routeMetres:r.routeMetres,events:traceCount,archived,archiveMs,countersExact,retainedTraceBytes:r.trace.byteLength,counterBytes:r.traceArchive?.kinds.byteLength??0,searchMs:r.searchMs,preparationMs:performance.now()-begun,maxPreparationTimerGapMs:maxGap,replayVertices:scene.renderer.domElement.dataset.replayVertices,batches:scene.roadBatches.length,roadCpuBytes:scene.renderer.domElement.dataset.roadCpuBytes,decodedChunks:scene.renderer.domElement.dataset.decodedChunks,eventTextureBytes:scene.renderer.domElement.dataset.eventTextureBytes,denseTextureBytes:r.edgeTimes.byteLength+(r.backwardTimes?.byteLength??0)+(r.edgeSources?.byteLength??0)+(r.goalProximity?.byteLength??0)}}
window.benchmark=async(zoom,x,y)=>{scene.setView({zoom,x,y});scene.setProgress(.5);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const intervals=[],draws=[],vertices=[];const gl=scene.renderer.getContext();const previous=gl.drawArrays.bind(gl);let calls=0,count=0;gl.drawArrays=(mode,first,n)=>{calls++;count+=n;return previous(mode,first,n)};let last=performance.now(),begin=last;await new Promise(resolve=>{function frame(now){intervals.push(now-last);draws.push(calls);vertices.push(count);calls=count=0;last=now;scene.setProgress(.2+.6*Math.min(1,(now-begin)/4000));if(now-begin<4000)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});gl.drawArrays=previous;intervals.sort((a,b)=>a-b);return {visibleGeometryBytes:scene.roadBatches.filter(b=>b.lines.visible).reduce((n,b)=>n+b.ends[b.ends.length-1]*12,0),totalGeometryBytes:scene.roadBatches.reduce((n,b)=>n+b.ends[b.ends.length-1]*12,0),zoom,frames:intervals.length,fps:intervals.length*1000/(last-begin),medianMs:intervals[intervals.length>>1],p95Ms:intervals[Math.floor(intervals.length*.95)],averageDraws:draws.reduce((a,b)=>a+b,0)/draws.length,averageVertices:vertices.reduce((a,b)=>a+b,0)/vertices.length}}
</script></body></html>`
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4245,strictPort:true,fs:{allow:[root,resolve('node_modules')]}},plugins:[{name:'proof',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url==='/proof'){res.setHeader('Content-Type','text/html');return res.end(html)}if(!req.url?.startsWith('/experiment/'))return next();const name=req.url.slice(12);if(basename(name)!==name||!allowed.has(name)){res.statusCode=404;return res.end()}try{res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'application/octet-stream');res.end(await readFile(resolve(dirname(path),name)))}catch(e){res.statusCode=500;res.end(String(e))}})}}]})
await server.listen();const engine=engineName==='webkit'?webkit:chromium,browser=await engine.launch({args:engineName==='webkit'?[]:['--use-angle=metal']})
const report={memorySamples:[],variant,country,engineName,algorithm,manifestIdentity:manifest.identity,errors:[],measurements:[],images:[]}
let phase='loading';const sample=()=>{if(!process.env.PFAD_SAMPLE_RSS)return;try{const rows=execFileSync('ps',['-axo','pid=,ppid=,rss='],{encoding:'utf8'}).trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));const children=new Set([process.pid]);let old=-1;while(old!==children.size){old=children.size;for(const [pid,parent]of rows)if(children.has(parent))children.add(pid)};const bytes=rows.filter(([pid])=>pid!==process.pid&&children.has(pid)).reduce((sum,row)=>sum+row[2]*1024,0);report.memorySamples.push({elapsedMs:performance.now(),phase,bytes})}catch{}};const timer=setInterval(sample,1000);sample();
try{
 if(process.env.PFAD_PROFILE && engineName==='chromium') {
  const cdp=await browser.newBrowserCDPSession(), pending=new Map();let id=0,session;
  cdp.on('Target.receivedMessageFromTarget',e=>{const m=JSON.parse(e.message);const cb=pending.get(m.id);if(cb){pending.delete(m.id);cb(m.result)}})
  report.profileStart=true;
  globalThis.startProfile=async()=>{const targets=await cdp.send('Target.getTargets');const target=targets.targetInfos.find(t=>t.type==='worker'&&t.url.includes('search.worker'));session=(await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false})).sessionId;
   const command=method=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);void cdp.send('Target.sendMessageToTarget',{sessionId:session,message:JSON.stringify({id:n,method})})});globalThis.profileCommand=command;await command('Profiler.enable');await command('Profiler.start');
  };
  globalThis.stopProfile=async()=>{const result=await globalThis.profileCommand('Profiler.stop');await writeFile(resolve(out,'search.cpuprofile'),JSON.stringify(result.profile));};
 }
 report.browserVersion=browser.version();const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});if(process.env.PFAD_PROFILE && engineName==='chromium'){await page.exposeFunction('startProfile',globalThis.startProfile);await page.exposeFunction('stopProfile',globalThis.stopProfile)};await page.exposeFunction('memoryPhase',p=>{phase=p;sample()});await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,options){return original.call(this,kind,kind==='webgl2'?{...options,preserveDrawingBuffer:true}:options)}});report.capturePreservedBuffer=true;page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())})
 await page.goto('http://127.0.0.1:4245/proof');await page.waitForFunction(()=>window.ready||window.errors.length,null,{timeout:600000});console.log('loaded',variant,country)
 const start=country==='us'?{name:'San Francisco',lon:-122.4194,lat:37.7749}:{name:'Munich',lon:11.582,lat:48.1351},goal=country==='us'?(process.env.PFAD_LOCAL_ROUTE?{name:'Sacramento',lon:-121.4944,lat:38.5816}:{name:'New York',lon:-74.006,lat:40.7128}):{name:'Berlin',lon:13.405,lat:52.52}
 report.result=await page.evaluate(async({start,goal,algorithm})=>window.compute(start,goal,algorithm),{start,goal,algorithm});console.log('prepared',JSON.stringify(report.result))
 phase='replay';sample();const view=await page.evaluate(()=>scene.getView());
 for(const zoom of [1,4,12]){
  report.measurements.push(await page.evaluate(async v=>window.benchmark(v.zoom,v.x,v.y),{...view,zoom}));console.log('benchmark',JSON.stringify(report.measurements.at(-1)))
  for(const progress of [.2,.5,.8,1]){
   await page.evaluate(async p=>{scene.setProgress(p);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))},progress)
   const filename='zoom'+zoom+'-progress'+progress+'.png';await page.locator('canvas').screenshot({path:resolve(out,filename)});report.images.push(filename)
  }
 }
 for(const [name,point] of [['start',start],['goal',goal]]) {
  await page.evaluate(p=>{const xy=scene.project(p);scene.setView({zoom:12,x:xy.x,y:xy.y})},point)
  for(const progress of [.2,.5,.8,1]) {
   await page.evaluate(async p=>{scene.setProgress(p);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))},progress)
   const filename=name+'-zoom12-progress'+progress+'.png';await page.locator('canvas').screenshot({path:resolve(out,filename)});report.images.push(filename)
  }
 }
 phase='context-recovery';sample();const previousFrame=await page.locator('canvas').getAttribute('data-road-frame');const beforeContext=await page.locator('canvas').screenshot({path:resolve(out,'before-context.png')});
 const contextEvent=await page.locator('canvas').getAttribute('data-event');
 await page.evaluate(()=>{const x=scene.renderer.getContext().getExtension('WEBGL_lose_context');x.loseContext();setTimeout(()=>x.restoreContext(),500)});
 await page.waitForFunction(()=>scene.renderer.domElement.dataset.roadUploads==='deferred');
 await page.waitForFunction(()=>scene.renderer.domElement.dataset.roadUploads==='resident',null,{timeout:180000});
 await page.waitForFunction(event=>scene.renderer.domElement.dataset.event===event,contextEvent);
 await page.waitForFunction(frame=>scene.renderer.domElement.dataset.roadFrame!==frame,previousFrame);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.locator('canvas').screenshot({path:resolve(out,'after-context.png')});report.contextEvent=contextEvent;
 phase='recording-verification';sample();report.blockProof=await page.evaluate(async()=>{const a=window.result.traceArchive;if(!a)return null;let bytes=0;for(let i=0;i<a.blocks;i++)bytes+=(await a.readBlock(i)).byteLength;return {blocks:a.blocks,verifiedBytes:bytes}});
 report.glError=await page.evaluate(()=>scene.renderer.getContext().getError());report.errors.push(...await page.evaluate(()=>window.errors));await page.evaluate(async()=>{const m=await import('/src/records/trace-storage.ts');await m.disposeTrace(window.result)})
}catch(e){report.errors.push(String(e));console.log('error',String(e))}
finally{clearInterval(timer);sample();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await server.close()}
if(report.errors.length)process.exitCode=1
