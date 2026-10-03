import { selectAlgorithm } from './algorithm-picker.ts'
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(90000)
async function seek(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'Search replay' })
  await slider.fill(String(value))
  const event = (await slider.getAttribute('aria-valuetext'))!.match(/; (\d+) recorded events/)![1]
  await expect(page.locator('canvas')).toHaveAttribute('data-event', event)
}
async function bidirectional(page: Page, guided: boolean) {
  await page.goto('./')
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await selectAlgorithm(page, guided ? 'bidirectional-astar' : 'bidirectional')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', guided ? 'bidirectional-astar/1' : 'bidirectional-dijkstra/1')
}

for (const guided of [false, true]) {
test(`${guided ? 'bidirectional A*' : 'bidirectional Dijkstra'}: two real fronts render their meeting light, preserve a paused frame and honour reduced motion`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await bidirectional(page, guided)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const canvas = page.locator('canvas')
  const meeting = Number(await canvas.getAttribute('data-meeting-event')), total = Number(await canvas.getAttribute('data-total-events'))
  expect(meeting).toBeGreaterThan(0); expect(meeting).toBeLessThanOrEqual(total)
  // The documented 30-second replay reserves its final three seconds for
  // the completed route. The meeting belongs to the 27-second search clock.
  const before = Math.floor((meeting / total * 27 - .15) * 100) / 100
  await seek(page, 15)
  await page.screenshot({ path: `test-results/${guided ? 'bidirectional-astar' : 'bidirectional'}-fronts-${test.info().project.name}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await seek(page, 30)
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  await expect(page.locator('.route-caption')).toContainText('262.7 km')
  await seek(page, before)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  // Pause in the same polling turn that observes the short light. Software
  // rendering in CI can otherwise consume most of its lifetime during a click.
  await page.waitForFunction(() => {
    if (document.querySelector('canvas')?.dataset.flashPhase !== 'flashing') return false
    const pause = [...document.querySelectorAll('button')].find(button => button.textContent === 'Pause')
    pause?.click(); return !!pause
  })
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(canvas).toHaveAttribute('data-flash-phase', 'flashing')
  const frozen = await canvas.getAttribute('data-flash-progress')
  await page.waitForTimeout(250)
  await expect(canvas).toHaveAttribute('data-flash-progress', frozen!)
  await page.screenshot({ path: `test-results/${guided ? 'bidirectional-astar' : 'bidirectional'}-meeting-${test.info().project.name}.png` })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  await expect(canvas).toHaveAttribute('data-route-phase', 'complete')
  await expect(canvas).toHaveAttribute('data-route-energy', '0')
  await selectAlgorithm(page, 'dijkstra')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'dijkstra/1')
  await expect(canvas).toHaveAttribute('data-meeting-event', '0')
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  if (guided) {
    await page.goto('./?algorithm=bidirectional-astar')
    await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'bidirectional-astar/1', { timeout: 45000 })
    await expect(page.locator('.route-caption')).toContainText('262.7 km')
  }
  expect(errors).toEqual([])
})

}
