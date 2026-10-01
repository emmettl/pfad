import { test, expect } from '@playwright/test'

test.describe('desktop outline controls', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })
  test('verified outlines can be toggled while roads are still downloading', async ({ page }) => {
    let release!: () => void
    const downloading = new Promise<void>(resolve => { release = resolve })
    await page.route('**/nodes-000-*', async route => { await downloading; await route.continue() })
    try {
      await page.goto('./')
      const button = page.getByRole('button', { name: 'Show border and lake outlines' })
      await expect(page.locator('canvas')).toHaveAttribute('data-outline-country', 'ch', { timeout: 35000 })
      await expect(page.locator('.study')).toHaveAttribute('data-state', 'loading')
      await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeDisabled()
      await expect(button).toBeEnabled()
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'false')
      await expect(page.locator('canvas')).toHaveAttribute('data-outlines', 'hidden')
      release()
      await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
      await expect(page.locator('canvas')).toHaveAttribute('data-outlines', 'hidden')
      await button.click()
      await expect(page.locator('canvas')).toHaveAttribute('data-outlines', 'visible')
    } finally { release() }
  })
})

test('failed external outlines leave genuine road searches available and can be retried', async ({ page }) => {
  await page.route('**/pfad-data/geo-ch-*/manifest.json', route => route.abort())
  await page.goto('/')
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 60000 })
  await expect(page.getByText('Outlines could not be loaded or verified. Road searches remain available.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toBeDisabled()
  const slider = page.getByRole('slider', { name: 'Search replay' })
  await slider.fill('30')
  await expect(page.locator('.route-caption em')).toBeVisible()
  const event = (await slider.getAttribute('aria-valuetext'))!.match(/; (\d+) recorded events/)![1]
  await expect(page.locator('canvas')).toHaveAttribute('data-event', event)
  await page.unroute('**/pfad-data/geo-ch-*/manifest.json')
  await page.getByRole('button', { name: 'Retry outlines' }).click()
  await expect(page.locator('canvas')).toHaveAttribute('data-outline-country', 'ch', { timeout: 60000 })
  await expect(page.locator('canvas')).toHaveAttribute('data-outlines', 'visible')
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toBeEnabled()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready')
  await slider.fill('30')
  await expect(page.locator('canvas')).toHaveAttribute('data-event', event)
})
