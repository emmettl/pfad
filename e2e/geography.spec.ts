import { test, expect } from '@playwright/test'

test('failed external outlines leave genuine road searches available and can be retried', async ({ page }) => {
  await page.route('**/pfad-data/geo-ch-*/manifest.json', route => route.abort())
  await page.goto('/')
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 60000 })
  await expect(page.getByText('Outlines could not be loaded or verified. Road searches remain available.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toBeDisabled()
  await page.getByRole('slider', { name: 'Search replay' }).fill('30')
  await expect(page.locator('.route-caption em')).toBeVisible()
  const event = await page.locator('canvas').getAttribute('data-event')
  await page.unroute('**/pfad-data/geo-ch-*/manifest.json')
  await page.getByRole('button', { name: 'Retry outlines' }).click()
  await expect(page.locator('canvas')).toHaveAttribute('data-outline-country', 'ch', { timeout: 60000 })
  await expect(page.locator('canvas')).toHaveAttribute('data-outlines', 'visible')
  await expect(page.getByRole('button', { name: 'Show border and lake outlines' })).toBeEnabled()
  await expect(page.locator('canvas')).toHaveAttribute('data-event', event!)
})
