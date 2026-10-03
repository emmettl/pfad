import { preview } from 'vite'
import { chromium, webkit, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const out='.cache/sea-release-browser';await mkdir(out,{recursive:true})
const targetUrl=process.env.PFAD_URL
const server=targetUrl ? undefined : await preview({root:process.cwd(),preview:{host:'127.0.0.1',port:4216,strictPort:true}})
const report={measuredAt:new Date().toISOString(),browsers:[]}
try{
 for(const [name,engine] of [['chromium',chromium],['webkit-desktop',webkit]]){
  const record={name,errors:[],roadRequestsBeforeConsent:0};report.browsers.push(record)
  const browser=await engine.launch({args:name==='chromium'?['--use-angle=metal']:[]})
  try{
   const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'})
   page.on('pageerror',e=>record.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text())})
   let requests=0;page.on('request',r=>{if(r.url().includes('/sea-20261002-'))requests++})
   await page.goto(targetUrl ?? 'http://127.0.0.1:4216/',{waitUntil:'domcontentloaded',timeout:60000})
   await expect(page.locator('.study')).toHaveAttribute('data-state','ready',{timeout:120000})
   await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('sea')
   await expect(page.getByRole('dialog')).toContainText('116.5 MB');record.roadRequestsBeforeConsent=requests
   if(requests)throw Error('Road data requested before consent')
   const began=Date.now();await page.getByRole('button',{name:'Open Southeast Asia',exact:true}).click()
   await expect(page.locator('.study')).toHaveAttribute('data-state','ready',{timeout:240000});record.openingMs=Date.now()-began
   await expect(page.locator('canvas')).toHaveAttribute('data-outline-country','sea',{timeout:60000})
   await expect(page.locator('.route-caption')).toContainText('Yangon');record.defaultRoute=await page.locator('.route-caption').textContent()
   await page.getByRole('combobox',{name:'Destination place',exact:true}).selectOption('Singapore')
   await page.getByRole('button',{name:'Search',exact:true}).click()
   await expect(page.locator('.route-caption')).toContainText('Singapore',{timeout:90000})
   await expect(page.locator('.study')).toHaveAttribute('data-state','ready',{timeout:90000})
   await expect(page.locator('.route-caption')).toContainText('1795.2 km');record.singaporeRoute=await page.locator('.route-caption').textContent()
   await page.screenshot({path:out+'/'+name+'.png'})
   await page.getByRole('button',{name:'Ambient',exact:true}).click()
   await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','still',{timeout:90000})
   await expect(page.locator('.route-caption')).not.toContainText('A real search. A slower clock.',{timeout:90000})
   await expect(page.locator('.study')).toHaveAttribute('data-state','ready',{timeout:90000})
   record.ambientCaption=await page.locator('.route-caption').textContent();record.roadRequests=requests
   if(record.errors.length)throw Error(record.errors.join('; '))
  }catch(error){record.errors.push(String(error));process.exitCode=1}
  finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(record))}
 }
}finally{if(server)await new Promise(resolve=>server.httpServer.close(resolve))}
