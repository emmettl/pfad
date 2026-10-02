import { preview } from 'vite'
import {webkit,chromium,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
if (!process.argv[2]) throw Error('Usage: node proof.mjs <baseline-dist> [corrected-dist]');
const report=[];
for(const [version,outDir,port]of [['before',process.argv[2],4194],['after',process.argv[3]??'dist',4195]]){
 const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port,strictPort:true}});
 try{for(const [engineName,engine]of [['webkit',webkit],['chromium',chromium]]){
 const browser=await engine.launch();try{
 const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(`http://127.0.0.1:${port}/?country=at`,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.study')).toHaveAttribute('data-state','ready',{timeout:90000});
 await expect(page.locator('canvas')).toHaveAttribute('data-outline-country','at',{timeout:30000});
 const button=page.getByRole('button',{name:'Show border and lake outlines'}),canvas=page.locator('canvas');
 await page.getByRole('slider',{name:'Search replay'}).fill('30');
 for(const visible of [false,true]){
 const pressed=await button.getAttribute('aria-pressed');if((pressed==='true')!==visible)await button.click();
 await expect(canvas).toHaveAttribute('data-outlines',visible?'visible':'hidden');
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await canvas.screenshot({path:`.cache/outline-phone/${version}-${engineName}-${visible?'on':'off'}.png`});
 }
 await page.screenshot({path:`.cache/outline-phone/${version}-${engineName}-app.png`});
 report.push({version,engine:engineName,outlineCountry:await canvas.getAttribute('data-outline-country'),segments:await canvas.getAttribute('data-outline-segments'),errors});if(errors.length)throw Error(JSON.stringify(errors));
 }finally{await browser.close()}
 }}finally{await server.close()}
}
await writeFile('.cache/outline-phone/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
