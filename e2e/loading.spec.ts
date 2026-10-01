import { test, expect } from '@playwright/test'
test.setTimeout(120000)

test('verified chunks survive a failed opening and reload without chunk requests', async ({ page }) => {
  const downloads: string[] = []
  page.on('request', request => { if (request.url().endsWith('.bin.gz.bin')) downloads.push(request.url()) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/geometry-000-*.bin.gz.bin', route => route.fulfill({ status: 503, body: '' }))
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('incomplete graph cannot be searched', { timeout: 45000 })
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeDisabled()
  await page.unroute('**/geometry-000-*.bin.gz.bin'); downloads.length = 0
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  expect(downloads.some(url => /\/(nodes|edges)-/.test(url))).toBe(false)
  await expect(page.locator('.route-caption')).toContainText('262.7 km')
  downloads.length = 0; await page.reload()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  await expect(page.locator('.study')).toHaveAttribute('data-progress', '0')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  expect(downloads).toEqual([])
  await page.getByText('About this study', { exact: true }).click()
  await expect(page.locator('.about-panel')).toContainText('0.0 MB downloaded, 15.9 MB from verified cache')
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('pfad-road-chunks-v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const tx = db.transaction('chunks', 'readwrite'), store = tx.objectStore('chunks'), keys = store.getAllKeys()
    keys.onsuccess = () => store.put(new TextEncoder().encode('damaged').buffer, keys.result.find(key => !String(key).endsWith('/record'))!)
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close()
  })
  downloads.length = 0; await page.reload()
  await expect(page.locator('.study')).toHaveAttribute('data-state', 'ready', { timeout: 45000 })
  expect(downloads).toHaveLength(1)
  // Reloaded journey links start at the beginning. Inspect the result explicitly
  // before checking its cost; cache integrity must not depend on a saved offset.
  await expect(page.locator('.study')).toHaveAttribute('data-progress', '0')
  await page.getByRole('slider', { name: 'Search replay' }).fill('30')
  await expect(page.locator('.route-caption')).toContainText('262.7 km')
})
