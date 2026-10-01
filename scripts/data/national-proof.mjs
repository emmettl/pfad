// Local-only experiment: use the production worker, engine and road renderer.
// The published edition and its resource guards remain unchanged.
import { createServer } from 'vite'
import { chromium, webkit } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import { cpus, platform, networkInterfaces } from 'node:os'
import { createHash } from 'node:crypto'

const manifestPath = resolve(process.argv[2])
const out = resolve(process.argv[3] ?? '.cache/uk-browser')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const phone = process.argv.includes('--phone')
let phoneReport
const endpoints = process.argv[4] && !process.argv[4].startsWith('--') ? JSON.parse(await readFile(resolve(process.argv[4]), 'utf8')) : { start: { name: "Land's End", lon: -5.714, lat: 50.066 }, goal: { name: "John o' Groats", lon: -3.069, lat: 58.638 } }
await mkdir(out, { recursive: true })
const pageSource = `<html><head><meta charset="utf-8"><title>PFAD national feasibility experiment</title>
<style>body{margin:0;background:#080d10}main{position:absolute;inset:0}.map-markers{display:none}</style></head>
<body><main></main><script type="module">
import { RoadScene } from '/src/map/RoadScene.ts';
const scene = new RoadScene(document.querySelector('main'));
const worker = new Worker(new URL('/src/search/search.worker.ts', import.meta.url), {type:'module'});
const endpoints = ${JSON.stringify(endpoints)};
const digest = bytes => ${phone ? "fetch('/experiment-sha256',{method:'POST',body:bytes}).then(r=>r.arrayBuffer())" : "crypto.subtle.digest('SHA-256',bytes)"};
const started = performance.now(); let pending;
window.proof = {ready:false, errors:[], runs:[]};
const gl=scene.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
window.proof.renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
window.proof.maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
worker.onmessage = ({data}) => {
 if(data.type==='manifest') {scene.setManifest(data.manifest);scene.setGeographyVisible(false)}
 if(data.type==='geometry') scene.addGeometry(data.bytes,data.count);
 if(data.type==='ready') {window.proof.loadMs=performance.now()-started;window.proof.ready=true}
 if(data.type==='error') {window.proof.errors.push(data.message);if(pending){pending.reject(Error(data.message));pending=null}}
 if(data.type==='result') {pending.resolve(data.result);pending=null}
};
worker.onerror = e => window.proof.errors.push(e.message);
worker.postMessage({type:'load',manifestUrl:location.origin+'/experiment/manifest.json'});
window.run = async (algorithm) => {
 const r=await new Promise((resolve,reject)=>{pending={resolve,reject};worker.postMessage({type:'search',requestId:1,algorithm,...endpoints})});
 if(r.routeMetres===null) throw Error('Long route is disconnected');
 if(r.routeLengths.reduce((a,b)=>a+b,0)/100!==r.routeMetres) throw Error('Route length mismatch');
 const traceSha256=Array.from(new Uint8Array(await digest(r.trace)),v=>v.toString(16).padStart(2,'0')).join('');
 const record={algorithm:r.algorithm,tieBreak:r.tieBreak,dataset:r.dataset,start:r.start,goal:r.goal,searchMs:r.searchMs,snapMs:r.snapMs,snapping:r.snapping,heuristic:r.heuristic,events:r.trace.length,traceBytes:r.trace.byteLength,edgeTextureBytes:r.edgeTimes.byteLength+(r.backwardTimes?.byteLength??0),nodesSettled:r.exploredNodes,arcsExamined:r.examinedArcs,routeMetres:r.routeMetres,maxQueue:r.maxQueue,traceSha256};
 scene.setResult(r);
 // Warm GPU uploads before sampling playback of the actual national drawing.
 scene.setProgress(.2);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const intervals=[];let previous=performance.now();
 await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;scene.setProgress(.2+.6*intervals.length/180,true);if(intervals.length<180)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});
 intervals.sort((a,b)=>a-b);
 record.frameIntervalMedianMs=intervals[90];record.frameIntervalP95Ms=intervals[171];
 record.webglError=scene.renderer.getContext().getError();
 record.integerEventTextures=r.edgeTimes instanceof Uint32Array;
 record.withinExactFloatEventRange=r.trace.length<=16777216;
 record.roundedFirstExaminationTimestamps=r.edgeTimes instanceof Uint32Array ? 0 : null;
 record.drawingVertices=scene.renderer.info.render.lines*2;
 record.maxFps=Number(scene.renderer.domElement.dataset.maxFps);record.pixelRatio=scene.renderer.getPixelRatio();
 record.traceBackingBytes=r.trace.buffer.byteLength;
 window.proof.runs.push(record);return record;
};
${phone ? `
try {
 await new Promise((resolve,reject)=>{const check=()=>{if(window.proof.errors.length)reject(Error(window.proof.errors.join('; ')));else if(window.proof.ready)resolve();else setTimeout(check,100)};check()});
 for(const algorithm of ['dijkstra','dijkstra','bidirectional','astar']) await window.run(algorithm);
 if(window.proof.runs[0].traceSha256!==window.proof.runs[1].traceSha256)throw Error('Repeated trace differs');
 if(window.proof.runs[0].routeMetres!==window.proof.runs[2].routeMetres)throw Error('Route costs differ');
}catch(e){window.proof.errors.push(String(e))}
window.proof.userAgent=navigator.userAgent;window.proof.viewport=[innerWidth,innerHeight];window.proof.devicePixelRatio=devicePixelRatio;
await fetch('/experiment-report',{method:'POST',body:JSON.stringify(window.proof)});
` : ''}
</script></body></html>`
const server = await createServer({ configFile: false, server: { host: phone ? '::' : '127.0.0.1', port: 4201, strictPort: true }, plugins: [{
  name: 'national-feasibility-only',
  enforce: 'pre',
  transform(code, id) {
    if (phone && id.endsWith('/src/search/search.worker.ts')) {
      // HTTP LAN origins lack WebCrypto. Hash the exact received bytes on the
      // local host; checksum comparison still runs in the worker. Opening time
      // includes this additional upload and is not comparable to localhost.
      return code.replace("crypto.subtle.digest('SHA-256', compressed)", "fetch('/experiment-sha256', { method: 'POST', body: compressed }).then(r => r.arrayBuffer())")
    }
  },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (phone && ['/experiment-sha256', '/experiment-report'].includes(req.url) && req.method === 'POST') {
        const parts = []; for await (const part of req) parts.push(part)
        const body = Buffer.concat(parts)
        if (req.url === '/experiment-sha256') res.end(createHash('sha256').update(body).digest())
        else { phoneReport = JSON.parse(body); res.end('Saved') }
        return
      }
      if (req.url === '/national-proof') { res.setHeader('Content-Type', 'text/html'); res.end(pageSource); return }
      if (!req.url?.startsWith('/experiment/')) { next(); return }
      const name = req.url.slice('/experiment/'.length)
      const allowed = ['manifest.json', ...manifest.chunks.map(c => c.path)]
      if (basename(name) !== name || !allowed.includes(name)) { res.statusCode = 404; res.end(); return }
      try { const bytes = await readFile(resolve(dirname(manifestPath), name)); res.setHeader('Content-Type', name.endsWith('.json') ? 'application/json' : 'application/octet-stream'); res.end(bytes) }
      catch (e) { res.statusCode = 500; res.end(String(e)) }
    })
  },
}] })
const report = { measuredAt: new Date().toISOString(), host: { cpu: cpus()[0].model, platform: platform() }, manifest: { id: manifest.id, counts: manifest.counts, downloadBytes: manifest.downloadBytes, source: manifest.source }, note: 'Production worker/engine/renderer with national manifest resource guards. Local Vite serving; no network simulation. WebKit viewport runs on desktop, not a physical phone. Outlines hidden. Timings exclude trace hashing. Byte accounting is retained buffers, not browser peak memory.', browsers: [] }
report.bufferAccounting = {
  workerGraphBytes: 16 * manifest.counts.nodes + 14 * manifest.counts.edges + 8 * manifest.counts.directedArcs + 4,
  reverseCsrBytes: 4 * (manifest.counts.nodes + 1) + 4 * manifest.counts.directedArcs,
  uploadedRoadAttributeBytes: 12 * manifest.counts.vertices,
  drawingCoordinateAndOffsetBytes: 8 * manifest.counts.vertices + 4 * manifest.counts.edges + 4 * manifest.chunks.filter(c => c.kind === 'geometry').length,
  note: 'Drawing coordinates share the uploaded attribute array: do not sum that field twice. Road attributes are CPU buffers; GPU copies are additional. Excludes search working allocations, transient decoding, route ribbon, textures, GPU copies, application/browser overhead and music.',
}
try {
  await server.listen()
  if (phone) {
    const addresses = Object.values(networkInterfaces()).flat().filter(a => a && !a.internal && !a.address.startsWith('fe80:')).map(a => a.family === 'IPv6' ? `[${a.address}]` : a.address)
    console.log('Physical-phone URLs:', addresses.map(a => `http://${a}:4201/national-proof`).join(' '))
    const begun = Date.now()
    while (!phoneReport && Date.now() - begun < 1800000) await new Promise(resolve => setTimeout(resolve, 1000))
    if (!phoneReport) throw Error('No physical-phone report received within thirty minutes')
    report.note += ' Physical phone uses HTTP LAN with exact received-byte SHA-256 computed on host; opening includes extra checksum uploads. Trace hash also uploads to host after search timing.'
    report.browsers.push({ name: 'physical-phone-safari', ...phoneReport })
    await writeFile(resolve(out, 'phone-report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(phoneReport))
  } else {
  for (const [name, engine, viewport, args] of [['chromium-metal', chromium, { width: 1440, height: 900 }, ['--use-angle=metal']], ['webkit-mobile-viewport', webkit, { width: 390, height: 844 }, []]]) {
    let browser
    const record = { name, errors: [] }
    report.browsers.push(record)
    try {
      browser = await engine.launch({ args })
      record.version = browser.version()
      const page = await browser.newPage({ viewport, ...(process.argv.includes('--mobile-budget') && name === 'webkit-mobile-viewport' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) })
      page.on('pageerror', e => record.errors.push(String(e)))
      page.on('console', message => { if (message.type() === 'error') record.errors.push(message.text()) })
      await page.goto('http://127.0.0.1:4201/national-proof')
      await page.waitForFunction(() => window.proof?.ready || window.proof?.errors.length, null, { timeout: 180000 })
      const state = await page.evaluate(() => window.proof)
      if (!state.ready) throw Error(state.errors.join('; '))
      record.loadMs = state.loadMs
      record.maxTextureSize = state.maxTextureSize
      record.renderer = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) })
      record.runs = []
      for (const algorithm of ['dijkstra', 'dijkstra', 'bidirectional', 'astar']) {
        record.runs.push(await page.evaluate(algorithm => window.run(algorithm), algorithm))
        console.log(name, JSON.stringify(record.runs.at(-1)))
      }
      if (record.runs[0].traceSha256 !== record.runs[1].traceSha256) throw Error('Repeated Dijkstra trace differs')
      if (record.runs.some(run => run.routeMetres !== record.runs[0].routeMetres)) throw Error('Algorithms disagree on route cost')
      await page.screenshot({ path: resolve(out, `${name}.png`) })
      record.errors.push(...await page.evaluate(() => window.proof.errors))
    } catch (e) { record.errors.push(String(e)); console.log(name, String(e)) }
    finally { await browser?.close(); await writeFile(resolve(out, 'replay-report.json'), JSON.stringify(report, null, 2) + '\n') }
  }
  }
} finally { await server.close() }
if (report.browsers.some(b => b.errors.length)) process.exitCode = 1
