import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

test('crawlers receive coherent share metadata and valid image/icon assets without JavaScript or graph loading', async ({ browser, baseURL, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage(), graphRequests: string[] = []
    page.on('request', r => { if (/\.bin\.gz\.bin$|\.m4a$|pfad-manifest/.test(r.url())) graphRequests.push(r.url()) })
    await page.goto(baseURL!)
    const og = (name: string) => page.locator(`meta[property="og:${name}"]`).getAttribute('content')
    const twitter = (name: string) => page.locator(`meta[name="twitter:${name}"]`).getAttribute('content')
    const canonical = (await page.locator('link[rel="canonical"]').getAttribute('href'))!
    expect(canonical).toBe('https://motionstudies.app/pfad/'); expect(await og('url')).toBe(canonical)
    expect(await og('type')).toBe('website'); expect(await og('site_name')).toBe('Motion Studies')
    expect(await og('title')).toBe(await twitter('title'))
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(await og('description')).toBe(description); expect(await twitter('description')).toBe(description)
    expect(description!.length).toBeGreaterThan(80); expect(description).not.toContain('in development')
    expect(await twitter('card')).toBe('summary_large_image')
    const image = (await og('image'))!, alt = (await og('image:alt'))!
    expect(image.startsWith(canonical + 'share/')).toBe(true)
    expect(await og('image:secure_url')).toBe(image); expect(await twitter('image')).toBe(image)
    expect(alt.length).toBeGreaterThan(50); expect(await twitter('image:alt')).toBe(alt)
    const evidence = JSON.parse(await readFile('docs/evidence/sharing-2026-10-01/social-card.json', 'utf8'))
    expect(image).toBe(new URL(evidence.image.path, canonical).href)
    const localAsset = (url: string) => new URL(new URL(url).pathname.slice('/pfad/'.length), baseURL).href
    const response = await request.get(localAsset(image)), bytes = await response.body()
    expect(response.status()).toBe(200); expect(response.headers()['content-type']).toContain(await og('image:type'))
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(bytes.readUInt32BE(16)).toBe(Number(await og('image:width')))
    expect(bytes.readUInt32BE(20)).toBe(Number(await og('image:height')))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.image.sha256)
    const work = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)
    expect(work.url).toBe(canonical); expect(work.image.contentUrl).toBe(image); expect(work.image.width).toBe(bytes.readUInt32BE(16))
    for (const [selector, size] of [['link[rel="apple-touch-icon"]', 180], ['link[rel="icon"][type="image/png"]', 32]] as const) {
      const icon = await request.get(new URL((await page.locator(selector).getAttribute('href'))!, baseURL).href)
      expect(icon.status()).toBe(200); expect(icon.headers()['content-type']).toContain('image/png')
      const data = await icon.body(); expect(data.readUInt32BE(16)).toBe(size); expect(data.readUInt32BE(20)).toBe(size)
    }
    expect(graphRequests).toEqual([])
  } finally { await context.close() }
})
