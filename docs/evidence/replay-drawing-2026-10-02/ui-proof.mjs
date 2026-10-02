import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser=await chromium.launch({args:['--use-angle=metal']})
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
const errors=[];page.on('response',r=>{if(r.status()>=400)console.log(r.status(),r.url())});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
await page.addInitScript(() => { window.renderSamples = new Map(); const raf = window.requestAnimationFrame; window.requestAnimationFrame = callback => raf.call(window, time => { window.renderTime = time; callback(time) }); const draw = WebGL2RenderingContext.prototype.drawArrays; WebGL2RenderingContext.prototype.drawArrays = function(mode, first, count) { if(mode === this.LINES) { window.renderSamples.set(window.renderTime, (window.renderSamples.get(window.renderTime) ?? 0) + count); if(window.renderSamples.size > 128) window.renderSamples.delete(window.renderSamples.keys().next().value) } return draw.call(this, mode, first, count) }; window.drawingProof = { chunks: 0, compressed: 0, bytes: 0 }; const NativeWorker = window.Worker; window.Worker = class extends NativeWorker { constructor(...args) { super(...args); this.addEventListener('message', ({data}) => { if(data.type === 'geometry') { window.drawingProof.chunks++; window.drawingProof.bytes += data.bytes.byteLength; if(data.drawingEncoding) window.drawingProof.compressed++ } }) } } })
try{
 await page.goto('http://127.0.0.1:4218/?country=us&from=san-francisco&to=new-york&algorithm=bidirectional&duration=15')
 await page.getByRole('button',{name:/^Open United States/}).click()
 await page.getByTestId('compute-time').waitFor({timeout:180000})
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.roadVertices==='226125654',null,{timeout:180000})
 await page.getByRole('slider', {name:'Search replay'}).fill('15')
 await page.waitForFunction(() => document.querySelector('canvas')?.dataset.event === document.querySelector('canvas')?.dataset.totalEvents)
 const drawing = await page.evaluate(() => ({ ...window.drawingProof, retainedCpuBytes: Number(document.querySelector('canvas').dataset.roadCpuBytes), replayVertices: Number(document.querySelector('canvas').dataset.replayVertices), glError: document.querySelector('canvas').getContext('webgl2').getError() }))
 if (drawing.chunks !== drawing.compressed || drawing.retainedCpuBytes !== 0 || drawing.glError !== 0) throw Error('US drawing retention or upload error')
 const normalVertices = await page.evaluate(() => Array.from(window.renderSamples.values()).at(-1))
 await page.mouse.move(720,450); await page.mouse.wheel(0,-2000); await page.waitForTimeout(250)
 const zoomedVertices = await page.evaluate(() => Array.from(window.renderSamples.values()).at(-1))
 if (!(zoomedVertices < normalVertices)) throw Error('Viewport culling did not reduce submitted drawing')
 drawing.viewport = { normalVertices, zoomedVertices }
 await page.mouse.wheel(0,2000); await page.waitForTimeout(250)
 await page.screenshot({path:'.cache/replay-optimization/ui-proof.png'})
 await writeFile('.cache/replay-optimization/ui-proof.json',JSON.stringify({url:page.url(),computeTime:await page.getByTestId('compute-time').textContent(),drawing,roadVertices:await page.locator('canvas').getAttribute('data-road-vertices'),errors},null,2))
 if(errors.length)throw Error(errors.join('; '))
}finally{await browser.close()}
