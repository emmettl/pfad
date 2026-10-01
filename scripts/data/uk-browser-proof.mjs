import { preview } from 'vite'
import { webkit, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const urls=process.argv.slice(2)
const server=urls.length?null:await preview({preview:{host:'127.0.0.1',port:4197,strictPort:true}})
const browser=await webkit.launch(), reports=[]
try {
 for(const url of urls.length?urls:['http://127.0.0.1:4197/']) {
  const page=await browser.newPage({viewport:{width:402,height:874},hasTouch:true,isMobile:true,deviceScaleFactor:3}),errors=[],analyticsErrors=[]
  page.on('pageerror',e=>(e.message.includes('cloudflareinsights.com/cdn-cgi/rum')?analyticsErrors:errors).push(e.message))
  await page.goto(url,{waitUntil:'domcontentloaded'})
  await page.locator('.study[data-state="ready"]').waitFor({timeout:90000})
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('uk')
  await page.getByRole('button',{name:'Open United Kingdom',exact:true}).click()
  await page.locator('.study[data-state="ready"]').waitFor({timeout:180000})
  const runs=[]
  for(const mode of ['dijkstra','bidirectional','astar']) {
   if(mode==='dijkstra')await page.getByRole('button',{name:'Search',exact:true}).click()
   else await page.getByRole('combobox',{name:'Search algorithm'}).selectOption(mode)
   await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled({timeout:60000})
   await page.getByRole('slider',{name:'Search replay'}).fill('15')
   await expect(page.locator('canvas')).toHaveAttribute('data-max-fps','30')
   const renderedEvent=(await page.getByRole('slider',{name:'Search replay'}).getAttribute('aria-valuetext')).match(/; (\d+) recorded events/)[1]
   await expect(page.locator('canvas')).toHaveAttribute('data-event',renderedEvent)
   runs.push({mode,caption:await page.locator('.route-caption').textContent(),canvas:await page.locator('canvas').evaluate(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight,maxFps:c.dataset.maxFps,event:c.dataset.event}))})
  }
  const outlines=page.getByRole('button',{name:'Show border and lake outlines'})
  await expect(outlines).toBeEnabled()
  await outlines.click();await expect(page.locator('canvas')).toHaveAttribute('data-outlines','hidden')
  await outlines.click();await expect(page.locator('canvas')).toHaveAttribute('data-outlines','visible')
  await page.screenshot({path:'.cache/uk-context-phone.png'})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.getByRole('button',{name:'Ambient',exact:true}).click()
  const journeys=[]
  for(let i=0;i<8;i++) {
   await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','still',{timeout:60000})
   const event=(await page.getByRole('slider',{name:'Search replay',includeHidden:true}).getAttribute('aria-valuetext')).match(/; (\d+) recorded events/)[1]
   await expect(page.locator('canvas')).toHaveAttribute('data-event',event)
   journeys.push({algorithm:await page.locator('.study').getAttribute('data-algorithm'),caption:await page.locator('.route-caption').textContent(),events:await page.locator('canvas').getAttribute('data-total-events')})
   if(i<7)await page.getByRole('button',{name:'Next journey',exact:true}).click()
  }
  await page.screenshot({path:'.cache/uk-ambient-phone.png'})
  await page.getByRole('button',{name:'Exit ambient',exact:true}).click()
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','off')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.getByRole('button',{name:'Ambient',exact:true}).click()
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','replay',{timeout:60000})
  const before=await page.locator('.study').getAttribute('data-algorithm')
  await page.locator('main.map').focus();await page.keyboard.press('End');await page.keyboard.press('Space')
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','hold',{timeout:30000})
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','replay',{timeout:60000})
  const automaticTransition={before,after:await page.locator('.study').getAttribute('data-algorithm'),caption:await page.locator('.route-caption').textContent()}
  if(automaticTransition.before===automaticTransition.after)throw Error('Algorithm did not rotate')
  await page.getByRole('button',{name:'Exit ambient',exact:true}).click()
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('ch')
  await page.locator('.study[data-state="ready"]').waitFor({timeout:90000})
  if(errors.length||await page.locator('canvas').count()!==1)throw Error(JSON.stringify(errors))
  reports.push({note:'Desktop touch WebKit, not a physical iPhone. Eight real reduced-motion journeys via Next; one real hold/fade transition after seeking the completed trace with map End/Space controls.',url,runs,journeys,automaticTransition,outlinesToggle:true,errors,analyticsErrors,swissRestored:true});console.log(JSON.stringify(reports.at(-1)))
  await page.close()
 }
 await writeFile('.cache/uk-context-report.json',JSON.stringify(reports,null,2)+'\n')
}finally{await browser.close();if(server)await new Promise(r=>server.httpServer.close(r))}
