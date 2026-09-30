// Manual acquisition of reviewed geographic reference assets. Never run by CI.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
const records = JSON.parse(await readFile(new URL('../../data/geography-sources.json', import.meta.url), 'utf8'))
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
