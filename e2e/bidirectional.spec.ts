import { test, expect, type Page } from '@playwright/test'

test.setTimeout(90000)
async function seek(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'Search replay' })
  await slider.fill(String(value))
  const event = (await slider.getAttribute('aria-valuetext'))!.match(/; (\d+) recorded events/)![1]
  await expect(page.locator('canvas')).toHaveAttribute('data-event', event)
}
async function bidirectional(page: Page) {
  await page.goto('./')
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await page.getByRole('combobox', { name: 'Search algorithm' }).selectOption('bidirectional')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'bidirectional-dijkstra/1')
}

test('two-front search retains the shortest route and the real meeting light pauses, resumes and replays', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await bidirectional(page)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const canvas = page.locator('canvas')
  const meeting = Number(await canvas.getAttribute('data-meeting-event')), total = Number(await canvas.getAttribute('data-total-events'))
  expect(meeting).toBeGreaterThan(0); expect(meeting).toBeLessThanOrEqual(total)
  const before = Math.floor((meeting / total * 30 - .15) * 100) / 100
  await seek(page, 15)
  await page.screenshot({ path: `test-results/bidirectional-fronts-${test.info().project.name}.png` })
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
  await page.screenshot({ path: `test-results/bidirectional-meeting-${test.info().project.name}.png` })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  await expect(page.getByText('Route found', { exact: true })).toBeVisible({ timeout: 20000 })
  await seek(page, before)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(canvas).toHaveAttribute('data-flash-phase', 'flashing')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  await expect(canvas).toHaveAttribute('data-route-energy', '0')
  await page.getByRole('combobox', { name: 'Search algorithm' }).selectOption('dijkstra')
  await expect(page.locator('.study')).toHaveAttribute('data-algorithm', 'dijkstra/1')
  await expect(canvas).toHaveAttribute('data-meeting-event', '0')
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  expect(errors).toEqual([])
})

test('reduced motion skips meeting and route flourishes when switching algorithms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await bidirectional(page)
  const canvas = page.locator('canvas')
  await expect(page.locator('.study')).toHaveAttribute('data-progress', '1')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  await expect(canvas).toHaveAttribute('data-route-phase', 'complete')
  await expect(page.locator('.route-caption')).toContainText('262.7 km')
  await page.getByRole('combobox', { name: 'Replay duration' }).selectOption('5')
  await page.getByRole('button', { name: 'Replay search from the beginning' }).click()
  await expect(canvas).toHaveAttribute('data-route-phase', 'hidden')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const meeting = Number(await canvas.getAttribute('data-meeting-event')), total = Number(await canvas.getAttribute('data-total-events'))
  await page.getByRole('slider', { name: 'Search replay' }).fill(String(Math.floor((meeting / total * 5 - .08) * 100) / 100))
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByText('Route found', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(canvas).toHaveAttribute('data-flash-phase', 'hidden')
  await expect(canvas).toHaveAttribute('data-route-energy', '0')
})
