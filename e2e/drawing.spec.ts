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
  const bounds = (await canvas.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await canvas.dispatchEvent('wheel', { deltaY: -1500, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 })
  await expect.poll(async () => JSON.parse((await canvas.getAttribute('data-view'))!).zoom).toBeGreaterThan(4)
  const beforePan = JSON.parse((await canvas.getAttribute('data-view'))!).x
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2 + 40); await page.mouse.up()
  await expect.poll(async () => JSON.parse((await canvas.getAttribute('data-view'))!).x).not.toBe(beforePan)
  const view = (await canvas.getAttribute('data-view'))!
  const generation = await canvas.getAttribute('data-road-frame')
  const frame = await canvas.screenshot()
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!
    const extension = gl.getExtension('WEBGL_lose_context')!
    extension.loseContext(); setTimeout(() => extension.restoreContext(), 200)
  })
  await expect(canvas).toHaveAttribute('data-road-uploads', 'deferred')
  await expect(canvas).toHaveAttribute('data-road-uploads', 'resident', { timeout: 30000 })
  await expect.poll(() => canvas.getAttribute('data-road-frame')).not.toBe(generation)
  await expect(canvas).toHaveAttribute('data-event', event)
  await expect(canvas).toHaveAttribute('data-outlines', 'visible')
  await expect(canvas).toHaveAttribute('data-road-cpu-bytes', '0')
  await expect(canvas).toHaveAttribute('data-view', view)
  const restoredFrame = await canvas.screenshot()
  await test.info().attach('before-context', { body: frame, contentType: 'image/png' })
  await test.info().attach('after-context', { body: restoredFrame, contentType: 'image/png' })
  const maximumDifference = await page.evaluate(async ({ before, after }) => {
    const pixels = async (encoded: string) => {
      const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode()
      const copy = document.createElement('canvas'); copy.width = image.width; copy.height = image.height
      const context = copy.getContext('2d')!; context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, image.width, image.height).data
    }
    const a = await pixels(before), b = await pixels(after)
    let maximum = 0
    for (let i = 0; i < a.length; i++) maximum = Math.max(maximum, Math.abs(a[i] - b[i]))
    return maximum
  }, { before: frame.toString('base64'), after: restoredFrame.toString('base64') })
  // A fresh GPU context can round a blended channel two 8-bit levels differently.
  // Camera, event index and all source geometry still match exactly.
  expect(maximumDifference).toBeLessThanOrEqual(2)
  await slider.fill(await slider.getAttribute('max') ?? '30')
  await expect(page.locator('.route-caption em')).toBeVisible()
  expect(await canvas.evaluate(element => element.getContext('webgl2')!.getError())).toBe(0)
  expect(errors).toEqual([])
})
