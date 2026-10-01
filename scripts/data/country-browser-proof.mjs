import { preview } from 'vite'
import { webkit, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const [country='uk',...urls]=process.argv.slice(2)
const names={uk:'United Kingdom',is:'Iceland',nl:'Netherlands',nz:'New Zealand',lu:'Luxembourg',ie:'Ireland',sc:'Scandinavia',pl:'Poland',it:'Italy',es:'Spain',fr:'France',de:'Germany'}
if(!names[country])throw Error('Unknown country')
const port=Number(process.env.PFAD_PROOF_PORT??4197)
const server=urls.length?null:await preview({build:{outDir:process.env.PFAD_PROOF_DIST??'dist'},preview:{host:'127.0.0.1',port,strictPort:true}})
const browser=await webkit.launch(), reports=[]
let activePage, activeErrors
try {
 for(const url of urls.length?urls:[`http://127.0.0.1:${port}/`]) {
  const page=await browser.newPage({viewport:{width:402,height:874},hasTouch:true,isMobile:true,deviceScaleFactor:3}),errors=[],analyticsErrors=[]
  activePage=page;activeErrors=errors
  page.on('pageerror',e=>(e.message.includes('cloudflareinsights.com/cdn-cgi/rum')?analyticsErrors:errors).push(e.message))
  await page.goto(url,{waitUntil:'domcontentloaded'})
  await page.locator('.study[data-state="ready"]').waitFor({timeout:90000})
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption(country)
  const open=page.getByRole('button',{name:'Open '+names[country],exact:true})
  if(await open.isVisible())await open.click()
  await page.locator('.study[data-state="ready"], .study[data-state="error"]').waitFor({timeout:180000})
  if(await page.locator('.study').getAttribute('data-state')==='error')throw Error(await page.locator('.study').textContent())
  const runs=[]
  for(const mode of ['dijkstra','bidirectional','astar']) {
   if(mode!=='dijkstra')await page.getByRole('combobox',{name:'Search algorithm'}).selectOption(mode)
   await expect(page.locator('.study')).toHaveAttribute('data-algorithm',mode==='bidirectional'?'bidirectional-dijkstra/1':mode+'/1',{timeout:60000})
   await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled({timeout:60000})
   await page.getByRole('slider',{name:'Search replay'}).fill('30')
   await expect(page.locator('.route-caption em')).toBeVisible()
   await page.getByRole('slider',{name:'Search replay'}).fill('15')
   if(['uk','sc','pl','it','es','fr','de'].includes(country))await expect(page.locator('canvas')).toHaveAttribute('data-max-fps','30')
   const renderedEvent=(await page.getByRole('slider',{name:'Search replay'}).getAttribute('aria-valuetext')).match(/; (\d+) recorded events/)[1]
   await expect(page.locator('canvas')).toHaveAttribute('data-event',renderedEvent)
   runs.push({mode,caption:await page.locator('.route-caption').textContent(),canvas:await page.locator('canvas').evaluate(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight,maxFps:c.dataset.maxFps,event:c.dataset.event}))})
  }
  await expect.poll(async()=>{const url=new URL(await page.url());return {country:url.searchParams.get('country'),algorithm:url.searchParams.get('algorithm')}}).toEqual({country,algorithm:'astar'})
  await page.reload({waitUntil:'domcontentloaded'})
  await expect(page.getByRole('combobox',{name:'Country',exact:true})).toHaveValue(country)
  const reopen=page.getByRole('button',{name:'Open '+names[country],exact:true})
  if(await reopen.isVisible())await reopen.click()
  await page.locator('.study[data-state="ready"], .study[data-state="error"]').waitFor({timeout:180000})
  await expect(page.getByRole('combobox',{name:'Country',exact:true})).toHaveValue(country)
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm','astar/1',{timeout:60000})
  await page.getByRole('slider',{name:'Search replay'}).fill('15')
  const restoredEvent=(await page.getByRole('slider',{name:'Search replay'}).getAttribute('aria-valuetext')).match(/; (\d+) recorded events/)[1]
  await expect(page.locator('canvas')).toHaveAttribute('data-event',restoredEvent)
  const outlines=page.getByRole('button',{name:'Show border and lake outlines'})
  await expect(outlines).toBeEnabled()
  await outlines.click();await expect(page.locator('canvas')).toHaveAttribute('data-outlines','hidden')
  await outlines.click();await expect(page.locator('canvas')).toHaveAttribute('data-outlines','visible')
  await expect(page.locator('canvas')).toHaveAttribute('data-outline-country',country)
  await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-outline-segments'))).toBeGreaterThan(0)
  await page.screenshot({path:`.cache/${country}-context-phone.png`})
  const boundedStops=[]
  const waitAmbient=async phase=>{
   for(let retry=0;retry<=4;retry++) {
    await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase',new RegExp(`^(${phase}|stopped)$`),{timeout:60000})
    if(await page.locator('.study').getAttribute('data-ambient-phase')===phase) {
     await expect(page.locator('.study')).toHaveAttribute('data-state','ready',{timeout:60000})
     return
    }
    const message=await page.locator('.ambient-controls [role="status"]').textContent()
    if(!/^No (journey in this distance band|separated three-source study) after bounded attempts\./.test(message))throw Error(message)
    await expect(page.locator('.study')).toHaveAttribute('data-ambient-running','false')
    boundedStops.push({phase,message,retry})
    if(retry===4)throw Error('No accepted ambient study after four new-band requests')
    await expect(page.getByRole('button',{name:'Next journey',exact:true})).toBeEnabled()
    await page.getByRole('button',{name:'Next journey',exact:true}).click()
   }
   throw Error('No accepted ambient study after four new-band requests')
  }
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.getByRole('button',{name:'Ambient',exact:true}).click()
  const journeys=[]
  for(let i=0;i<8;i++) {
   await waitAmbient('still')
   const event=(await page.getByRole('slider',{name:'Search replay',includeHidden:true}).getAttribute('aria-valuetext')).match(/; (\d+) recorded events/)[1]
   await expect(page.locator('canvas')).toHaveAttribute('data-event',event)
   journeys.push({algorithm:await page.locator('.study').getAttribute('data-algorithm'),caption:await page.locator('.route-caption').textContent(),events:await page.locator('canvas').getAttribute('data-total-events')})
   if(i<7)await page.getByRole('button',{name:'Next journey',exact:true}).click()
  }
  await page.screenshot({path:`.cache/${country}-ambient-phone.png`})
  await page.getByRole('button',{name:'Exit ambient',exact:true}).click()
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','off')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.getByRole('button',{name:'Ambient',exact:true}).click()
  await waitAmbient('replay')
  const before=await page.locator('.study').getAttribute('data-algorithm'), stopsBeforeTransition=boundedStops.length
  await page.locator('main.map').focus();await page.keyboard.press('End');await page.keyboard.press('Space')
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','hold',{timeout:30000})
  await waitAmbient('replay')
  const automaticTransition={before,recoveredStops:boundedStops.length-stopsBeforeTransition,after:await page.locator('.study').getAttribute('data-algorithm'),caption:await page.locator('.route-caption').textContent()}
  if(automaticTransition.before===automaticTransition.after)throw Error('Algorithm did not rotate')
  await page.locator('main.map').focus();await page.keyboard.press('Escape')
  await expect(page.locator('.study')).toHaveAttribute('data-ambient-phase','off')
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('ch')
  await page.locator('.study[data-state="ready"]').waitFor({timeout:90000})
  if(errors.length||await page.locator('canvas').count()!==1)throw Error(JSON.stringify(errors))
  reports.push({country,note:'Desktop touch WebKit, not a physical iPhone. Eight real reduced-motion journeys via Next; one real hold/fade transition with any bounded-attempt Next recoveries recorded, after seeking the completed trace with map End/Space controls.',url,runs,journeys,boundedStops,automaticTransition,outlinesToggle:true,sharedStudyRestored:true,errors,analyticsErrors,swissRestored:true});console.log(JSON.stringify(reports.at(-1)))
  await page.close()
 }
 await writeFile(`.cache/${country}-context-report.json`,JSON.stringify(reports,null,2)+'\n')
}catch(error){
 if(activePage&&!activePage.isClosed()){await writeFile(`.cache/${country}-context-failure.json`,JSON.stringify({message:String(error),errors:activeErrors,state:await activePage.locator('body').ariaSnapshot()},null,2)+'\n');await activePage.screenshot({path:`.cache/${country}-context-failure.png`})}
 throw error
}finally{await browser.close();if(server)await new Promise(r=>server.httpServer.close(r))}
