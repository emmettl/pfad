import { preview } from 'vite'
import { webkit, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const server=await preview({root:'.cache/balanced-memory/release-tree',build:{outDir:'../instrumented-dist'},preview:{host:'127.0.0.1',port:4219,strictPort:true}})
const browser=await webkit.launch(),page=await browser.newPage({viewport:{width:402,height:874},hasTouch:true,isMobile:true}),errors=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
await page.addInitScript(()=>{localStorage.setItem('pfad-country-warning:de','1');const Native=window.Worker;window.Worker=class extends Native{constructor(...a){super(...a);this.addEventListener('message',({data})=>{if(data.type==='result'){const r=data.result;window.scratchResult={algorithm:r.algorithm,events:r.trace.length,routeMetres:r.routeMetres,scratch:r.memoryProof};crypto.subtle.digest('SHA-256',r.trace).then(hash=>window.scratchResult.traceSha256=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''))}})}}})
try{
 await page.goto('http://127.0.0.1:4219/?country=de&from=munich&to=berlin&algorithm=bidirectional-astar&duration=15')
 await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled({timeout:180000})
 await expect.poll(()=>page.evaluate(()=>!!window.scratchResult?.traceSha256)).toBe(true)
 const report=await page.evaluate(()=>window.scratchResult)
 if(!report.scratch||report.scratch.searchBytes<=0||errors.length)throw Error(JSON.stringify({report,errors}))
 await writeFile('.cache/balanced-memory/scratch-proof.json',JSON.stringify({note:'Test-only wrapper of ArrayBuffer.transfer(0). Bytes count distinct scratch buffers detached across phases, not a measured peak RSS reduction.',...report,errors},null,2)+'\n');console.log(JSON.stringify(report))
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
