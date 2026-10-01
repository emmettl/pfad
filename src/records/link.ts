import type { Point, SearchAlgorithm } from '../search/contracts.ts'
export interface StudyLink {
  schema: 'pfad-study-link/1'; country: string; dataset: string; profile: string
  start: Point; goal: Point; algorithm: SearchAlgorithm; duration: number; progress: number; outlines: boolean
  view?: { x: number; y: number; zoom: number }
}
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const point = (p: Point) => p && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 100 && finite(p.lon, -180, 180) && finite(p.lat, -90, 90)
export function readStudyLink(hash: string): { study?: StudyLink; error?: string } {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('study')
  if (raw === null) return {}
  try {
    if (raw.length > 4000) throw new Error()
    const s = JSON.parse(raw) as StudyLink
    if (!s || s.schema !== 'pfad-study-link/1' || !['ch', 'uk'].includes(s.country) || !/^[a-f0-9]{64}$/.test(s.dataset) || s.profile !== 'road-connectivity-distance-v1'
      || !point(s.start) || !point(s.goal) || !['dijkstra', 'bidirectional', 'astar'].includes(s.algorithm)
      || !finite(s.duration, 5, 120) || !finite(s.progress, 0, 1) || typeof s.outlines !== 'boolean'
      || (s.view && (!finite(s.view.x, -100, 100) || !finite(s.view.y, -100, 100) || !finite(s.view.zoom, .6, 24)))) throw new Error()
    return { study: s }
  } catch { return { error: 'This study link is invalid or uses an unsupported record version.' } }
}
export function studyUrl(base: string, study: StudyLink) {
  const url = new URL(base)
  url.hash = new URLSearchParams({ study: JSON.stringify(study) }).toString()
  return url.href
}
