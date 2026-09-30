import { test, expect } from '@playwright/test'

test('the public introduction loads with an honest status and attribution', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'PFAD', exact: true })).toBeVisible()
  await expect(page.getByText('Edition in development', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /OpenStreetMap contributors/ })).toBeVisible()
  const manifest = await page.request.get('./data/pfad-manifest.json')
  expect(manifest.ok()).toBeTruthy()
  expect((await manifest.json()).graph).toBeNull()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: `test-results/scaffold-${test.info().project.name}.png`, fullPage: true })
})
