import { test, expect } from '@playwright/test'

test('drawing restores its recorded frame and geographic context after GPU context loss', async ({ page }) => {
  const errors: string[] = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 60000 })
  const canvas = page.locator('canvas'), slider = page.getByRole('slider', { name: 'Search replay' })
  await slider.fill('15')
  const event = (await slider.getAttribute('aria-valuetext'))!.match(/; (\d+) recorded events/)![1]
  await expect(canvas).toHaveAttribute('data-event', event)
  await expect(canvas).toHaveAttribute('data-outlines', 'visible', { timeout: 30000 })
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!
    const extension = gl.getExtension('WEBGL_lose_context')!
    extension.loseContext(); setTimeout(() => extension.restoreContext(), 200)
  })
  await expect(canvas).toHaveAttribute('data-road-uploads', 'deferred')
  await expect(canvas).toHaveAttribute('data-road-uploads', 'resident', { timeout: 30000 })
  await expect(canvas).toHaveAttribute('data-event', event)
  await expect(canvas).toHaveAttribute('data-outlines', 'visible')
  await expect(canvas).toHaveAttribute('data-road-cpu-bytes', '0')
  await slider.fill(await slider.getAttribute('max') ?? '30')
  await expect(page.locator('.route-caption em')).toBeVisible()
  expect(await canvas.evaluate(element => element.getContext('webgl2')!.getError())).toBe(0)
  expect(errors).toEqual([])
})
