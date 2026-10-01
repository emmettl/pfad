import { test, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

test('static sharing metadata, structured data and immutable image/icon bytes agree before browser startup', () => {
  const html = readFileSync('index.html', 'utf8'), meta = new Map(), links = []
  for (const tag of html.matchAll(/<(meta|link)\b[^>]*>/g)) {
    const attributes = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]))
    if (tag[1] === 'link') links.push(attributes)
    else if (attributes.name || attributes.property) {
      const key = attributes.name ?? attributes.property
      expect(meta.has(key), `Duplicate metadata: ${key}`).toBe(false); meta.set(key, attributes.content)
    }
  }
  const canonical = links.find(link => link.rel === 'canonical').href
  expect(canonical).toBe('https://motionstudies.app/pfad/')
  expect(meta.get('og:url')).toBe(canonical); expect(meta.get('og:type')).toBe('website')
  expect(meta.get('og:site_name')).toBe('Motion Studies')
  expect(meta.get('og:title')).toBe(meta.get('twitter:title'))
  const description = meta.get('description')
  expect(meta.get('og:description')).toBe(description); expect(meta.get('twitter:description')).toBe(description)
  expect(description.length).toBeGreaterThan(80); expect(description).not.toContain('in development')
  expect(meta.get('twitter:card')).toBe('summary_large_image')
  const image = meta.get('og:image'), alt = meta.get('og:image:alt')
  const evidence = JSON.parse(readFileSync('docs/evidence/sharing-2026-10-01/social-card.json', 'utf8'))
  expect(image).toBe(new URL(evidence.image.path, canonical).href)
  expect(meta.get('og:image:secure_url')).toBe(image); expect(meta.get('twitter:image')).toBe(image)
  expect(alt.length).toBeGreaterThan(50); expect(meta.get('twitter:image:alt')).toBe(alt)
  const bytes = readFileSync('public/' + evidence.image.path)
  expect(meta.get('og:image:type')).toBe('image/png')
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.readUInt32BE(16)).toBe(Number(meta.get('og:image:width')))
  expect(bytes.readUInt32BE(20)).toBe(Number(meta.get('og:image:height')))
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.image.sha256)
  const work = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  expect(work.url).toBe(canonical); expect(work.image.contentUrl).toBe(image)
  expect(work.image.width).toBe(bytes.readUInt32BE(16)); expect(work.image.height).toBe(bytes.readUInt32BE(20))
  for (const [rel, size] of [['apple-touch-icon', 180], ['icon', 32]]) {
    const icon = links.find(link => link.rel === rel && (rel !== 'icon' || link.type === 'image/png'))
    const data = readFileSync('public/' + icon.href)
    expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(data.readUInt32BE(16)).toBe(size); expect(data.readUInt32BE(20)).toBe(size)
  }
})
