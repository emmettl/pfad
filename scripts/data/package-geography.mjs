// Pack independent, immutable context releases; road identities remain untouched.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const date = process.argv[2]
if (!/^\d{8}$/.test(date ?? '')) throw Error('Usage: node scripts/data/package-geography.mjs YYYYMMDD')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const sources = JSON.parse(await readFile('data/geography-sources.json', 'utf8'))
const selected = process.argv.includes('--country') ? process.argv[process.argv.indexOf('--country') + 1] : undefined
if (selected !== undefined && !/^[a-z]{2,8}$/.test(selected)) throw Error('Invalid country ID')
const registry = selected ? JSON.parse(await readFile('src/map/geography-releases.json', 'utf8')) : {}
const countries = [...new Set(sources.assets.filter(a => a.path.endsWith('-border.json')).map(a => a.path.split('/').at(-1).replace('-border.json', '').replace('switzerland', 'ch')))]
if (selected && !countries.includes(selected)) throw Error('Unknown country: ' + selected)
for (const country of countries.filter(country => !selected || country === selected)) {
  const prefix = country === 'ch' ? 'switzerland' : country
  const assets = []
  for (const kind of ['border', 'lakes']) {
    const path = `src/map/data/${prefix}-${kind}.json`
    const source = sources.assets.find(asset => asset.path === path)
    const bytes = await readFile(path)
    if (!source || source.bytes !== bytes.length || source.sha256 !== digest(bytes)) throw Error('Unverified outline: ' + path)
    assets.push({ kind, bytes, reference: { path: `${kind}-${source.sha256.slice(0, 12)}.json`, bytes: bytes.length, sha256: source.sha256 } })
  }
  const payload = { schema: 'pfad-geography/1', country, border: assets[0].reference, lakes: assets[1].reference }
  const identity = digest(JSON.stringify(payload))
  const id = `geo-${country}-${date}-${identity.slice(0, 12)}`
  const directory = `.cache/geography/${id}`
  await mkdir(directory, { recursive: true })
  for (const asset of assets) await writeFile(`${directory}/${asset.reference.path}`, asset.bytes)
  const raw = Buffer.from(JSON.stringify({ ...payload, id, identity }, null, 2) + '\n')
  await writeFile(`${directory}/manifest.json`, raw)
  registry[country] = { url: `https://motionstudies.app/pfad-data/${id}/manifest.json`, bytes: raw.length, sha256: digest(raw) }
  console.log(directory)
}
if (!process.argv.includes('--no-registry')) await writeFile('src/map/geography-releases.json', JSON.stringify(registry, null, 2) + '\n')
