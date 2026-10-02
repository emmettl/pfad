import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser=await chromium.launch({args:['--use-angle=metal']})
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
const errors=[];page.on('response',r=>{if(r.status()>=400)console.log(r.status(),r.url())});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
try{
 await page.goto('http://127.0.0.1:4216/?country=us&from=san-francisco&to=new-york&algorithm=bidirectional&duration=15')
 await page.getByRole('button',{name:/^Open United States/}).click()
 await page.getByTestId('compute-time').waitFor({timeout:180000})
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.roadVertices==='226125654',null,{timeout:180000})
 await page.screenshot({path:'.cache/us-desktop/ui-proof.png'})
 await writeFile('.cache/us-desktop/ui-proof.json',JSON.stringify({url:page.url(),computeTime:await page.getByTestId('compute-time').textContent(),roadVertices:await page.locator('canvas').getAttribute('data-road-vertices'),errors},null,2))
 if(errors.length)throw Error(errors.join('; '))
}finally{await browser.close()}
