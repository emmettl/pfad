import { DEFAULT_DISTANCE_PROFILE, straightLineKm, type AmbientPlace } from './selector.ts'
import type { AmbientPool } from './pools.ts'
export const TERRITORY_SELECTOR_VERSION = 'separated-three-sources/1'
export interface TerritoryStudy { sources: [AmbientPlace, AmbientPlace, AmbientPlace]; start: AmbientPlace; goal: AmbientPlace }

/** Seeded triples from one authored road region, with bounded repeat history. */
export class TerritorySelector {
  private state: number
  private recent: string[] = []
  private attempted = new Set<string>()
  selections = 0
  readonly seed: number
  readonly pool: AmbientPool
  constructor(seed: number, pool: AmbientPool) { this.seed = seed; this.pool = pool; this.state = seed || 0x6d2b79f5 }
  private random() {
    let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5
    this.state = x >>> 0; return this.state / 4294967296
  }
  beginStudy() { this.attempted.clear() }
  choose(): TerritoryStudy | null {
    const places = this.pool.places, minimum = (this.pool.distance ?? DEFAULT_DISTANCE_PROFILE).minimumKm
    const candidates: { sources: [AmbientPlace, AmbientPlace, AmbientPlace]; key: string; separation: number }[] = []
    for (let a = 0; a < places.length; a++) for (let b = a + 1; b < places.length; b++) for (let c = b + 1; c < places.length; c++) {
      const sources: [AmbientPlace, AmbientPlace, AmbientPlace] = [places[a], places[b], places[c]]
      if (sources.some(source => source.region !== sources[0].region)) continue
      const key = sources.map(source => source.id).sort().join('/')
      if (this.recent.includes(key) || this.attempted.has(key)) continue
      const lengths = [straightLineKm(sources[0], sources[1]), straightLineKm(sources[0], sources[2]), straightLineKm(sources[1], sources[2])]
      const separation = Math.min(...lengths)
      if (separation < minimum || separation < Math.max(...lengths) * .2) continue
      candidates.push({ sources, key, separation })
    }
    let draw = this.random() * candidates.reduce((sum, candidate) => sum + candidate.separation, 0)
    const selected = candidates.find(candidate => (draw -= candidate.separation) < 0) ?? candidates.at(-1)
    if (!selected) return null
    this.attempted.add(selected.key); this.selections++
    const sources = [...selected.sources] as TerritoryStudy['sources']
    for (let i = 2; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [sources[i], sources[j]] = [sources[j], sources[i]] }
    return { sources, start: sources[0], goal: sources[1] }
  }
  accept(study: TerritoryStudy) { this.recent.push(study.sources.map(source => source.id).sort().join('/')); this.recent = this.recent.slice(-3) }
}
