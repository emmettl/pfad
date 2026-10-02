import { createServer } from 'vite'
import { chromium, webkit } from '@playwright/test'
import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { resolve,dirname,basename } from 'node:path'
const [variant,country='de',engineName='chromium',algorithm='bidirectional']=process.argv.slice(2)
const root=resolve('.cache/spatial-pipeline/'+variant),out=resolve('.cache/spatial-pipeline/'+variant+'-'+country+'-'+engineName+'-'+algorithm)
await mkdir(out,{recursive:true})
const path=country==='us'?(await readFile('.cache/replay-optimization/manifest-path.txt','utf8')).trim():resolve('.cache/countries/de-20260929-083582060611/manifest.json')
const manifest=JSON.parse(await readFile(path,'utf8')),allowed=new Set(['manifest.json',...manifest.chunks.map(c=>c.path)])
const html=`<html><head><link rel="icon" href="data:,"><style>body{margin:0}main{position:absolute;inset:0}.map-markers,.search-tip{display:none}</style></head><body><main></main><script type="module">
import {RoadScene} from '/src/map/RoadScene.ts';
window.scene=new RoadScene(document.querySelector('main'));window.ready=false;window.errors=[];
const worker=new Worker(new URL('/src/search/search.worker.ts',import.meta.url),{type:'module'});let pending;
worker.onmessage=({data})=>{if(data.type==='manifest')scene.setManifest(data.manifest);if(data.type==='geometry')scene.addGeometry(data.bytes,data.count,!!data.drawingEncoding);if(data.type==='ready')window.ready=true;if(data.type==='error')window.errors.push(data.message);if(data.type==='result')pending(data.result)};
worker.postMessage({type:'load',manifestUrl:location.origin+'/experiment/manifest.json',compactDrawing:true,releaseAfterSearch:true});
window.compute=async(start,goal,algorithm)=>{const r=await new Promise(resolve=>{pending=resolve;worker.postMessage({type:'search',requestId:1,start,goal,algorithm})});worker.terminate();window.result=r;const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.trace)),v=>v.toString(16).padStart(2,'0')).join('');const begun=performance.now();await scene.prepareResult(r);scene.setResult(r);return {sha,routeMetres:r.routeMetres,events:r.trace.length,preparationMs:performance.now()-begun,replayVertices:scene.renderer.domElement.dataset.replayVertices,batches:scene.roadBatches.length,roadCpuBytes:scene.renderer.domElement.dataset.roadCpuBytes}}
window.benchmark=async(zoom,x,y)=>{scene.setView({zoom,x,y});scene.setProgress(.5);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const intervals=[],draws=[],vertices=[];const gl=scene.renderer.getContext();const previous=gl.drawArrays.bind(gl);let calls=0,count=0;gl.drawArrays=(mode,first,n)=>{calls++;count+=n;return previous(mode,first,n)};let last=performance.now(),begin=last;await new Promise(resolve=>{function frame(now){intervals.push(now-last);draws.push(calls);vertices.push(count);calls=count=0;last=now;scene.setProgress(.2+.6*Math.min(1,(now-begin)/4000));if(now-begin<4000)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});gl.drawArrays=previous;intervals.sort((a,b)=>a-b);return {zoom,frames:intervals.length,fps:intervals.length*1000/(last-begin),medianMs:intervals[intervals.length>>1],p95Ms:intervals[Math.floor(intervals.length*.95)],averageDraws:draws.reduce((a,b)=>a+b,0)/draws.length,averageVertices:vertices.reduce((a,b)=>a+b,0)/vertices.length}}
</script></body></html>`
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4230,strictPort:true,fs:{allow:[root,resolve('node_modules')]}},plugins:[{name:'proof',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url==='/proof'){res.setHeader('Content-Type','text/html');return res.end(html)}if(!req.url?.startsWith('/experiment/'))return next();const name=req.url.slice(12);if(basename(name)!==name||!allowed.has(name)){res.statusCode=404;return res.end()}try{res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'application/octet-stream');res.end(await readFile(resolve(dirname(path),name)))}catch(e){res.statusCode=500;res.end(String(e))}})}}]})
await server.listen();const engine=engineName==='webkit'?webkit:chromium,browser=await engine.launch({args:engineName==='webkit'?[]:['--use-angle=metal']})
const report={variant,country,engineName,algorithm,manifestIdentity:manifest.identity,errors:[],measurements:[],images:[]}
try{
 report.browserVersion=browser.version();const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())})
 await page.goto('http://127.0.0.1:4230/proof');await page.waitForFunction(()=>window.ready||window.errors.length,null,{timeout:600000});console.log('loaded',variant,country)
 const start=country==='us'?{name:'San Francisco',lon:-122.4194,lat:37.7749}:{name:'Munich',lon:11.582,lat:48.1351},goal=country==='us'?{name:'New York',lon:-74.006,lat:40.7128}:{name:'Berlin',lon:13.405,lat:52.52}
 report.result=await page.evaluate(async({start,goal,algorithm})=>window.compute(start,goal,algorithm),{start,goal,algorithm});console.log('prepared',JSON.stringify(report.result))
 const view=await page.evaluate(()=>scene.getView());
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
 report.glError=await page.evaluate(()=>scene.renderer.getContext().getError());report.errors.push(...await page.evaluate(()=>window.errors))
}catch(e){report.errors.push(String(e));console.log('error',String(e))}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await server.close()}
if(report.errors.length)process.exitCode=1
