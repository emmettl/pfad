import { test, expect, vi, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { loadGeography } from '../src/map/geography-loader.ts'
import releases from '../src/map/geography-releases.json'
import worker from '../hosting/data-worker/index.mjs'
for (const date of new Set(Object.values(releases).map(reference => reference.url.match(/geo-[a-z]{2}-(\d{8})-/)[1]))) {
  execFileSync(process.execPath, ['scripts/data/package-geography.mjs', date, '--no-registry'])
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
afterEach(() => vi.unstubAllGlobals())
async function serve(country, edit = () => {}) {
  const reference = releases[country]
  const id = new URL(reference.url).pathname.split('/').at(-2)
  const directory = `.cache/geography/${id}`
  const raw = await readFile(`${directory}/manifest.json`)
  // CI can reconstruct these exact packages from the reviewed source assets.
  const manifest = JSON.parse(raw)
  const files = new Map([[reference.url, raw]])
  for (const kind of ['border', 'lakes']) files.set(new URL(manifest[kind].path, reference.url).href, await readFile(`${directory}/${manifest[kind].path}`))
  edit(files, manifest)
  vi.stubGlobal('fetch', vi.fn(async (url, options) => { options.signal?.throwIfAborted(); return new Response(files.get(url), { status: files.has(url) ? 200 : 404 }) }))
  return reference
}
test('all selected outline releases are independently pinned and verified, including empty lake layers', async () => {
  for (const country of Object.keys(releases)) {
    await serve(country)
    const context = await loadGeography(country)
    expect(context.boundary.rings.length).toBeGreaterThan(0)
    expect(context.water.lakes).toBeInstanceOf(Array)
  }
})
test('corrupt outline data and missing objects fail visibly rather than substituting another country', async () => {
  await serve('is', (files, manifest) => files.set(new URL(manifest.border.path, releases.is.url).href, Buffer.from('corrupt')))
  await expect(loadGeography('is')).rejects.toThrow('checksum')
  await serve('is', (files, manifest) => files.delete(new URL(manifest.lakes.path, releases.is.url).href))
  await expect(loadGeography('is')).rejects.toThrow('download')
  await expect(loadGeography('xx')).rejects.toThrow('No outline release')
})
test('country mismatches reject even when the manifest bytes are verified; cancellation stops downloads', async () => {
  await serve('is')
  await expect(loadGeography('nl', undefined, releases.is)).rejects.toThrow('country mismatch')
  const controller = new AbortController(); controller.abort()
  await expect(loadGeography('is', controller.signal)).rejects.toThrow()
  expect(digest(await readFile('.cache/geography/' + new URL(releases.is.url).pathname.split('/').at(-2) + '/manifest.json'))).toBe(releases.is.sha256)
})
test('data Worker serves only immutable outline keys with JSON, CORS and read-only methods', async () => {
  const key = new URL(releases.is.url).pathname
  const env = { DATA: { get: async () => ({ body: '{}', size: 2, uploaded: new Date(), httpEtag: '"hash"' }) } }
  const response = await worker.fetch(new Request('https://motionstudies.app' + key), env, { waitUntil() {} })
  expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toContain('application/json')
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  for (const path of [key.replace(/geo-is-[^/]+/, 'geo-is-latest'), key.replace('manifest.json', 'private.json')]) expect((await worker.fetch(new Request('https://motionstudies.app' + path), env, {})).status).toBe(404)
})
