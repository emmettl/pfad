import { test, expect } from '@playwright/test'
import { selectAlgorithm } from './algorithm-picker.ts'
test('bidirectional breadth-first displays two genuine fronts, a connection-count route and shareable mode',async({page})=>{
 test.setTimeout(90000)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('./?algorithm=bidirectional-breadth-first&from=zurich&to=geneve')
 const study=page.locator('.study'),canvas=page.locator('canvas')
 await expect(study).toHaveAttribute('data-algorithm','bidirectional-breadth-first/1',{timeout:60000})
 await page.getByRole('button',{name:'Pause',exact:true}).click()
 await expect(page.getByRole('button',{name:'Estimated time',exact:true})).toBeDisabled()
 await expect(page.locator('.front-key')).toContainText('AB')
 const slider=page.getByRole('slider',{name:'Search replay'});await slider.fill('15')
 const count=await page.getByTestId('examined-count').textContent()
 const event=(await slider.getAttribute('aria-valuetext'))!.match(/; (\d+) recorded events/)![1]
 await expect(canvas).toHaveAttribute('data-event',event)
 await page.screenshot({path:`test-results/bidirectional-breadth-first-${test.info().project.name}.png`})
 await slider.fill('30');await expect(page.locator('.replay-status')).toHaveText('Fewest-connection route found')
 await expect(canvas).toHaveAttribute('data-route-phase','complete')
 await slider.fill('15');await expect(page.getByTestId('examined-count')).toHaveText(count!)
 await expect(page).toHaveURL(/algorithm=bidirectional-breadth-first/)
 await selectAlgorithm(page,'dijkstra');await expect(study).toHaveAttribute('data-algorithm','dijkstra/1')
 expect(errors).toEqual([])
})
