import type { MapBoundary } from '@motionstudies/core/domain/boundary'
import type { MapWaterBodies } from '@motionstudies/core/domain/lakes'
import releases from './geography-releases.json'
import { sha256 } from '../search/chunks.ts'
export interface Geography { country: string; boundary: MapBoundary; water: MapWaterBodies }
export interface GeographyReference { url: string; bytes: number; sha256: string }
interface Asset { path: string; bytes: number; sha256: string }

async function verified(reference: GeographyReference, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(reference.url, { signal })
  if (!response.ok) throw new Error('Outline download failed')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length !== reference.bytes || await sha256(bytes) !== reference.sha256) throw new Error('Outline checksum mismatch')
  return JSON.parse(new TextDecoder().decode(bytes))
}
function asset(value: unknown, kind: string): asserts value is Asset {
  const a = value as Asset
  if (!a || !Number.isSafeInteger(a.bytes) || a.bytes < 1 || a.bytes > 8 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(a.sha256) || a.path !== `${kind}-${a.sha256.slice(0, 12)}.json`) throw new Error('Invalid outline asset')
}
export function validateGeography(boundary: unknown, water: unknown): asserts boundary is MapBoundary {
  const b = boundary as MapBoundary, w = water as MapWaterBodies
  const metadata = (value: unknown) => {
    const m = (value as { metadata?: { outputCrs?: string; attribution?: string } })?.metadata
    return m?.outputCrs === 'EPSG:4326' && typeof m.attribution === 'string' && m.attribution.length > 0
  }
  if (!metadata(b) || !metadata(w) || !Array.isArray(b.rings) || !b.rings.length || !Array.isArray(w.lakes)) throw new Error('Invalid outline layers')
  const rings = [...b.rings, ...w.lakes.flatMap(lake => lake.polygons.flatMap((polygon: readonly (readonly (readonly [number, number])[])[]) => polygon))]
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error('Invalid outline ring')
    for (const point of ring) if (!Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('Invalid outline coordinate')
    if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1]) throw new Error('Open outline ring')
  }
}
export async function loadGeography(country: string, signal?: AbortSignal, reference: GeographyReference = releases[country as keyof typeof releases]): Promise<Geography> {
  if (!reference) throw new Error('No outline release for country: ' + country)
  const manifest = await verified(reference, signal) as { schema: string; country: string; border: Asset; lakes: Asset }
  if (manifest.schema !== 'pfad-geography/1' || manifest.country !== country) throw new Error('Outline country mismatch')
  asset(manifest.border, 'border'); asset(manifest.lakes, 'lakes')
  const [boundary, water] = await Promise.all([manifest.border, manifest.lakes].map(a => verified({ ...a, url: new URL(a.path, reference.url).href }, signal)))
  validateGeography(boundary, water)
  return { country, boundary, water: water as MapWaterBodies }
}
