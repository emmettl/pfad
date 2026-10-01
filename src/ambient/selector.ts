import type { Point } from '../search/contracts.ts'

export const SELECTOR_VERSION = 'distance-balanced-pairs/3'
export const POOL_VERSION = 'swiss-places/1'
// A versioned authored pool, independent of future additions to the manual picker.
export const AMBIENT_PLACES: AmbientPlace[] = [
  { id: 'zurich', name: 'Zürich', lon: 8.5417, lat: 47.3769 },
  { id: 'geneva', name: 'Genève', lon: 6.1432, lat: 46.2044 },
  { id: 'basel', name: 'Basel', lon: 7.5886, lat: 47.5596 },
  { id: 'bern', name: 'Bern', lon: 7.4474, lat: 46.948 },
  { id: 'lausanne', name: 'Lausanne', lon: 6.6323, lat: 46.5197 },
  { id: 'lucerne', name: 'Luzern', lon: 8.3093, lat: 47.0502 },
  { id: 'lugano', name: 'Lugano', lon: 8.9511, lat: 46.0037 },
  { id: 'chur', name: 'Chur', lon: 9.532, lat: 46.8508 },
  { id: 'st-gallen', name: 'St. Gallen', lon: 9.3767, lat: 47.4245 },
  { id: 'st-moritz', name: 'St. Moritz', lon: 9.8355, lat: 46.4908 },
  { id: 'sion', name: 'Sion', lon: 7.3596, lat: 46.2331 },
  { id: 'andermatt', name: 'Andermatt', lon: 8.5948, lat: 46.6353 },
]
export type AmbientPlace = Point & { id: string; region?: string }
export type DistanceBand = 'regional' | 'interregional' | 'national'
export interface JourneyPair { start: AmbientPlace; goal: AmbientPlace; band: DistanceBand; estimateKm: number }
export interface JourneyRecord {
  start: string; goal: string; band: DistanceBand; estimateKm: number
  roadKm: number | null; accepted: boolean
}
export const replaySeconds = (km: number) => Math.min(65, Math.max(25, 30 * Math.sqrt(km / 100)))
export interface DistanceProfile { minimumKm: number; regionalBelowKm: number; interregionalBelowKm: number }
export const DEFAULT_DISTANCE_PROFILE: DistanceProfile = { minimumKm: 30, regionalBelowKm: 100, interregionalBelowKm: 220 }
export function distanceBand(km: number, profile = DEFAULT_DISTANCE_PROFILE): DistanceBand | null {
  return km < profile.minimumKm ? null : km < profile.regionalBelowKm ? 'regional' : km < profile.interregionalBelowKm ? 'interregional' : 'national'
}
export function straightLineKm(a: Point, b: Point) {
  const rad = Math.PI / 180, dy = (b.lat - a.lat) * rad, dx = (b.lon - a.lon) * rad
  const h = Math.sin(dy / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dx / 2) ** 2
  return 12742.0176 * Math.asin(Math.sqrt(Math.min(1, h)))
}
const pairKey = (a: string, b: string) => [a, b].sort().join('/')

/** Retains six recent pairs and endpoint counts, never graph or event buffers. */
export class JourneySelector {
  readonly seed: number
  readonly places: AmbientPlace[]
  readonly distance: DistanceProfile
  private randomState: number
  private history: string[] = []
  private uses = new Map<string, number>()
  private attempted = new Set<string>()
  private band: DistanceBand | undefined
  selections = 0
  constructor(seed: number, places = AMBIENT_PLACES, distance = DEFAULT_DISTANCE_PROFILE) {
    this.seed = seed >>> 0; this.randomState = this.seed || 0x6d2b79f5; this.places = places; this.distance = distance
  }
  private random() {
    let x = this.randomState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5
    this.randomState = x >>> 0; return this.randomState / 4294967296
  }
  beginJourney() {
    this.attempted.clear()
    const draw = this.random() * 7
    this.band = draw < 1 ? 'regional' : draw < 4 ? 'interregional' : 'national'
  }
  choose(): JourneyPair | null {
    if (!this.band) this.beginJourney()
    const candidates: { pair: JourneyPair; key: string; weight: number }[] = []
    for (const start of this.places) for (const goal of this.places) {
      if (start.id === goal.id || start.region !== goal.region) continue
      const key = pairKey(start.id, goal.id)
      if (this.history.includes(key) || this.attempted.has(key)) continue
      const direct = straightLineKm(start, goal), estimateKm = direct * 1.25
      if (direct < this.distance.minimumKm || distanceBand(estimateKm, this.distance) !== this.band) continue
      candidates.push({ pair: { start, goal, band: this.band!, estimateKm }, key, weight: 1 / (1 + (this.uses.get(start.id) ?? 0) + (this.uses.get(goal.id) ?? 0)) })
    }
    let draw = this.random() * candidates.reduce((sum, item) => sum + item.weight, 0)
    const selected = candidates.find(item => (draw -= item.weight) < 0) ?? candidates.at(-1)
    if (!selected) return null
    this.attempted.add(selected.key); this.selections++
    return selected.pair
  }
  record(pair: JourneyPair, roadKm: number | null): JourneyRecord {
    const accepted = roadKm !== null && Number.isFinite(roadKm) && distanceBand(roadKm, this.distance) === pair.band
    if (accepted) {
      this.history.push(pairKey(pair.start.id, pair.goal.id)); this.history = this.history.slice(-6)
      for (const point of [pair.start, pair.goal]) this.uses.set(point.id, (this.uses.get(point.id) ?? 0) + 1)
    }
    return { start: pair.start.id, goal: pair.goal.id, band: pair.band, estimateKm: pair.estimateKm, roadKm, accepted }
  }
}
