// Manual acquisition of reviewed geographic reference assets. Never run by CI.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
const records = JSON.parse(await readFile(new URL('../../data/geography-sources.json', import.meta.url), 'utf8'))
let prepare = false
for (const record of records.assets.filter(asset => asset.preparation)) {
  try { await readFile(new URL(`../../${record.path}`, import.meta.url)) } catch (error) { if (error.code !== 'ENOENT') throw error; prepare = true }
}
if (prepare) {
  await mkdir(new URL('../../.cache/', import.meta.url), { recursive: true })
  for (const source of records.sources) {
    const response = await fetch(source.url)
    if (!response.ok) throw new Error(`Geographic source could not be acquired: ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error('Geographic source checksum mismatch')
    await writeFile(new URL(`../../.cache/${source.url.split('/').at(-1)}`, import.meta.url), bytes)
  }
  execFileSync('python3', ['scripts/data/prepare-uk-geography.py'], { cwd: new URL('../../', import.meta.url), stdio: 'inherit' })
}
for (const record of records.assets) {
  const target = new URL(`../../${record.path}`, import.meta.url)
  let bytes
  try { bytes = await readFile(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!bytes) {
    const response = await fetch(record.publishedUrl)
    if (!response.ok) throw new Error(`Geographic reference could not be acquired: ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  }
  if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error('Geographic reference checksum mismatch')
  await mkdir(dirname(target.pathname), { recursive: true }); await writeFile(target, bytes)
  console.log(`Verified ${record.path}: ${bytes.length} bytes`)
}
