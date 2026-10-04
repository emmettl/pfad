import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { selectAlgorithm } from './algorithm-picker.ts'
test('Swiss ALT retains shortest distance, exposes exact buffer costs and reuses deterministic landmarks',async({page})=>{
 test.setTimeout(120000)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('./?algorithm=alt&from=zurich&to=geneve')
 const study=page.locator('.study'),slider=page.getByRole('slider',{name:'Search replay'})
 await expect(study).toHaveAttribute('data-algorithm','alt/1',{timeout:90000})
 await page.getByRole('button',{name:'Pause',exact:true}).click()
 await expect(page.getByRole('button',{name:'Estimated time',exact:true})).toBeDisabled()
 await expect(page.locator('.landmark-marker')).toHaveCount(4)
 await slider.fill('15')
 const event=(await slider.getAttribute('aria-valuetext'))!.match(/; (\d+) recorded events/)![1]
 await expect(page.locator('canvas')).toHaveAttribute('data-event',event)
 const examined=await page.getByTestId('examined-count').textContent()
 await page.screenshot({path:`test-results/alt-${test.info().project.name}.png`})
 await slider.fill('30');await expect(page.locator('.route-caption')).toContainText('262.7 km')
 await expect(page.locator('.replay-status')).toHaveText('Route found')
 await slider.fill('15');await expect(page.getByTestId('examined-count')).toHaveText(examined!)
 async function exportSearch(){
  await page.getByText('About this study',{exact:true}).click()
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export search record'}).click()
  const bytes=gunzipSync(await readFile((await (await download).path())!)),length=bytes.readUInt32LE(8)
  const record=JSON.parse(bytes.subarray(12,12+length).toString())
  await page.getByText('About this study',{exact:true}).click();return record
 }
 const first=await exportSearch(),landmarks=first.search.landmarks
 expect(landmarks.cached).toBe(false);expect(landmarks.nodes).toHaveLength(4)
 expect(landmarks.tableBytes).toBe(first.manifest.counts.nodes*32)
 expect(landmarks.peakBuildBufferBytes).toBeGreaterThan(landmarks.tableBytes)
 await writeFile(`test-results/alt-metrics-${test.info().project.name}.json`,JSON.stringify({landmarks,searchMs:first.search.searchMs,exploredNodes:first.search.exploredNodes,routeMetres:first.search.routeMetres},null,2))
 await page.getByRole('button',{name:'Search',exact:true}).click()
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.getByRole('button',{name:'Pause',exact:true}).click()
 const second=await exportSearch();expect(second.search.landmarks.cached).toBe(true);expect(second.search.landmarks.nodes).toEqual(landmarks.nodes)
 expect(second.search.routeMetres).toBe(first.search.routeMetres)
 await selectAlgorithm(page,'astar');await expect(study).toHaveAttribute('data-algorithm','astar/1')
 await page.getByRole('button',{name:'Pause',exact:true}).click()
 const baseline=await exportSearch();expect(first.search.routeMetres).toBe(baseline.search.routeMetres)
 await writeFile(`test-results/alt-comparison-${test.info().project.name}.json`,JSON.stringify({alt:{nodes:first.search.exploredNodes,searchMs:first.search.searchMs},astar:{nodes:baseline.search.exploredNodes,searchMs:baseline.search.searchMs}},null,2))
 await selectAlgorithm(page,'dijkstra');await expect(study).toHaveAttribute('data-algorithm','dijkstra/1')
 await page.getByRole('combobox',{name:'Country'}).selectOption('lu')
 await expect(study).toHaveAttribute('data-state','ready',{timeout:60000})
 await page.getByRole('combobox',{name:'Search algorithm'}).click()
 await expect(page.getByRole('option',{name:'ALT · landmarks',exact:true})).toHaveCount(0)
 expect(errors).toEqual([])
})
