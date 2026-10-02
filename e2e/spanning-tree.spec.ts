import { selectAlgorithm } from './algorithm-picker.ts'
import { test, expect } from '@playwright/test'
test('spanning tree is a goal-directed manual journey with reversible real acceptance',async({page})=>{
 test.setTimeout(90000)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('./?algorithm=spanning-tree')
 await expect(page.locator('.study')).toHaveAttribute('data-algorithm','spanning-tree/1',{timeout:60000})
 await page.getByRole('button',{name:'Pause',exact:true}).click()
 await expect(page.getByRole('button',{name:'Swap start and destination'})).toHaveCount(1)
 await expect(page.getByRole('group',{name:'Routing objective'})).toHaveCount(0)
 const slider=page.getByRole('slider',{name:'Search replay'});await slider.fill('15')
 const event=(await slider.getAttribute('aria-valuetext'))!.match(/; (\d+) recorded events/)![1]
 await expect(page.locator('canvas')).toHaveAttribute('data-event',event)
 const count=await page.getByTestId('examined-count').textContent()
 await page.screenshot({path:`test-results/spanning-tree-${test.info().project.name}.png`})
 await slider.fill('30');await expect(page.locator('.replay-status')).toHaveText('Tree route found')
 await expect(page.locator('canvas')).toHaveAttribute('data-route-phase','complete')
 await expect(page.getByText('Undirected tree growth towards B')).toBeVisible()
 await slider.fill('15');await expect(page.getByTestId('examined-count')).toHaveText(count!)
 await selectAlgorithm(page, 'dijkstra')
 await expect(page.locator('.study')).toHaveAttribute('data-algorithm','dijkstra/1');expect(errors).toEqual([])
})
