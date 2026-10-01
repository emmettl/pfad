import { COUNTRIES, type Country } from '../countries.ts'
import type { Point, SearchAlgorithm } from '../search/contracts.ts'
export interface StudyLink {
  schema: 'pfad-study-link/1'; country: string; dataset: string; profile: string
  start: Point; goal: Point; algorithm: SearchAlgorithm; duration: number; progress: number; outlines: boolean
  view?: { x: number; y: number; zoom: number }
}
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const point = (p: Point) => p && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 100 && finite(p.lon, -180, 180) && finite(p.lat, -90, 90)
const keys = ['country', 'from', 'to', 'algorithm', 'duration', 'outlines', 'view', 'from-name', 'to-name']
const slug = (name: string) => name.toLowerCase().replace(/[ðþæøß]/g, letter => ({ ð: 'd', þ: 'th', æ: 'ae', ø: 'o', ß: 'ss' })[letter]!)
  .normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const places = (country: Country) => [...country.places, ...country.ambient.places]
const cleanPoint = ({ name, lon, lat }: Point): Point => ({ name, lon, lat })
const samePoint = (a: Point, b: Point) => a.name === b.name && a.lon === b.lon && a.lat === b.lat

/** The fitted country view needs no parameter, even when its centre is nonzero. */
export function shareView(view: StudyLink['view'], bounds?: [number, number, number, number]) {
  if (!view || !bounds) return view
  const x = (bounds[0] + bounds[2]) / 2, y = (bounds[1] + bounds[3]) / 2
  return Math.abs(view.x - x) <= .000001 && Math.abs(view.y - y) <= .000001 && view.zoom === 1 ? undefined : view
}

function numbers(value: string, bounds: [number, number][]) {
  const parts = value.split(',')
  if (parts.length !== bounds.length || parts.some(part => !/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(part))) throw new Error()
  const values = parts.map(Number)
  if (values.some((number, i) => !finite(number, ...bounds[i]))) throw new Error()
  return values
}
function endpoint(parameters: URLSearchParams, key: 'from' | 'to', country: Country): Point {
  const value = parameters.get(key), name = parameters.get(`${key}-name`)
  const fallback = country.places[key === 'from' ? 0 : 1]
  if (value === null) { if (name !== null) throw new Error(); return cleanPoint(fallback) }
  if (value.includes(',')) {
    const [lon, lat] = numbers(value, [[-180, 180], [-90, 90]])
    const result = { name: name ?? (key === 'from' ? 'Point A' : 'Point B'), lon, lat }
    if (!point(result)) throw new Error()
    return result
  }
  const matches = places(country).filter(place => slug(place.name) === value)
  if (!matches.length || matches.some(place => !samePoint(place, matches[0])) || name !== null) throw new Error()
  return cleanPoint(matches[0])
}
function legacyStudy(raw: string): StudyLink {
  if (raw.length > 4000) throw new Error()
  const s = JSON.parse(raw) as StudyLink
  if (!s || s.schema !== 'pfad-study-link/1' || !COUNTRIES.some(country => country.id === s.country) || !/^[a-f0-9]{64}$/.test(s.dataset) || s.profile !== 'road-connectivity-distance-v1'
    || !point(s.start) || !point(s.goal) || !['dijkstra', 'bidirectional', 'astar', 'bidirectional-astar'].includes(s.algorithm)
    || !finite(s.duration, 5, 120) || !finite(s.progress, 0, 1) || typeof s.outlines !== 'boolean'
    || (s.view && (!finite(s.view.x, -100, 100) || !finite(s.view.y, -100, 100) || !finite(s.view.zoom, .6, 24)))) throw new Error()
  return s
}

/** Read native query parameters, or an existing exact-record JSON fragment. */
export function readStudyLink(address: string): { study?: StudyLink; error?: string } {
  try {
    const url = new URL(address, 'https://pfad.invalid/'), fragment = new URLSearchParams(url.hash.slice(1))
    if (fragment.has('study')) {
      if (fragment.getAll('study').length !== 1) throw new Error()
      return { study: legacyStudy(fragment.get('study')!) }
    }
    const parameters = url.searchParams
    if (!keys.some(key => parameters.has(key))) return {}
    if (keys.some(key => parameters.getAll(key).length > 1 || (parameters.get(key)?.length ?? 0) > 200)) throw new Error()
    const country = COUNTRIES.find(country => country.id === (parameters.get('country') ?? 'ch'))
    if (!country) throw new Error()
    const algorithm = parameters.get('algorithm') ?? 'dijkstra'
    if (!['dijkstra', 'bidirectional', 'astar', 'bidirectional-astar'].includes(algorithm)) throw new Error()
    const duration = numbers(parameters.get('duration') ?? '30', [[5, 120]])[0]
    const outlines = parameters.get('outlines') ?? '1'
    if (!['0', '1'].includes(outlines)) throw new Error()
    const view = parameters.has('view') ? numbers(parameters.get('view')!, [[-100, 100], [-100, 100], [.6, 24]]) : undefined
    return { study: { schema: 'pfad-study-link/1', country: country.id, dataset: country.identity, profile: 'road-connectivity-distance-v1',
      start: endpoint(parameters, 'from', country), goal: endpoint(parameters, 'to', country), algorithm: algorithm as SearchAlgorithm,
      duration, progress: 0, outlines: outlines === '1', ...(view ? { view: { x: view[0], y: view[1], zoom: view[2] } } : {}) } }
  } catch { return { error: 'This study link is invalid or uses an unsupported record version.' } }
}

/** Remove only study parameters, preserving unrelated query/fragment state. */
export function clearStudyUrl(base: string) {
  const url = new URL(base)
  keys.forEach(key => url.searchParams.delete(key))
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (fragment.has('study')) { fragment.delete('study'); url.hash = fragment.toString() }
  return url.href
}
export function studyUrl(base: string, study: StudyLink) {
  const url = new URL(clearStudyUrl(base)), parameters = url.searchParams
  const country = COUNTRIES.find(country => country.id === study.country)
  if (study.country !== 'ch') parameters.set('country', study.country)
  for (const [key, p] of [['from', study.start], ['to', study.goal]] as const) {
    const named = country && places(country).find(place => samePoint(place, p))
    parameters.set(key, named ? slug(named.name) : `${p.lon},${p.lat}`)
    if (!named && p.name !== (key === 'from' ? 'Point A' : 'Point B')) parameters.set(`${key}-name`, p.name)
  }
  if (study.algorithm !== 'dijkstra') parameters.set('algorithm', study.algorithm)
  const duration = Number(study.duration.toFixed(2))
  if (duration !== 30) parameters.set('duration', String(duration))
  if (!study.outlines) parameters.set('outlines', '0')
  if (study.view) {
    const view = [study.view.x, study.view.y, study.view.zoom].map(value => Number(value.toFixed(6)))
    if (view[0] !== 0 || view[1] !== 0 || view[2] !== 1) parameters.set('view', view.join(','))
  }
  // Commas are valid query characters and make coordinates/view easier to read.
  url.search = parameters.toString().replace(/%2C/gi, ',')
  return url.href
}

/** Replace one history entry, at most twice a second, with journey/view changes. */
export class StudyUrlBinding {
  private study: StudyLink | null = null
  private timer?: ReturnType<typeof setTimeout>
  private writtenAt = -Infinity
  private disposed = false
  private read: () => string
  private write: (url: string) => void
  constructor(read: () => string, write: (url: string) => void) { this.read = read; this.write = write }
  update(study: StudyLink | null) {
    if (this.disposed) return
    this.study = study
    if (!study) { this.cancel(); return }
    const current = this.read()
    if (studyUrl(current, study) === current) { this.cancel(); return }
    if (this.timer !== undefined) return
    const wait = 500 - (performance.now() - this.writtenAt)
    if (wait <= 0) this.flush()
    else this.timer = setTimeout(() => this.flush(), wait)
  }
  flush() {
    this.cancel()
    if (!this.study) return
    const current = this.read(), url = studyUrl(current, this.study)
    if (url !== current) { this.write(url); this.writtenAt = performance.now() }
    return url
  }
  private cancel() { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined }
  dispose() { this.cancel(); this.study = null; this.disposed = true }
}
