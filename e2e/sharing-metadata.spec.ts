import { test, expect } from '@playwright/test'

test('a crawler receives the built sharing head and image without JavaScript or graph loading', async ({ browser, baseURL, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage(), graphRequests: string[] = []
    page.on('request', r => { if (/\.bin\.gz\.bin$|\.m4a$|pfad-manifest/.test(r.url())) graphRequests.push(r.url()) })
    await page.goto(baseURL!)
    await expect(page).toHaveTitle('PFAD — Motion Studies')
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://motionstudies.app/pfad/')
    const image = (await page.locator('meta[property="og:image"]').getAttribute('content'))!
    const local = new URL(new URL(image).pathname.slice('/pfad/'.length), baseURL)
    const response = await request.get(local.href)
    expect(response.status()).toBe(200); expect(response.headers()['content-type']).toContain('image/png')
    expect(graphRequests).toEqual([])
  } finally { await context.close() }
})
