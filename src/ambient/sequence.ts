import type { SearchAlgorithm, SearchResult } from '../search/contracts.ts'
import { JourneySelector, replaySeconds, POOL_VERSION, SELECTOR_VERSION, type JourneyPair, type DistanceProfile, type JourneyRecord } from './selector.ts'
import { TerritorySelector, TERRITORY_SELECTOR_VERSION, type TerritoryStudy } from './territories.ts'
import { SWISS_POOL, type AmbientPool } from './pools.ts'

export type AmbientPhase = 'off' | 'preparing' | 'replay' | 'hold' | 'fade' | 'still' | 'stopped'
export interface AmbientState { active: boolean; running: boolean; phase: AmbientPhase; opacity: number; message: string }
interface AmbientEvidence {
  dataset?: SearchResult['dataset']; algorithm: SearchResult['algorithm']; searchMs: number
  events: number; replaySeconds: number | null; selector: string; pool: string; seed: number; selection: number
  cycle: string; journey: number; distanceProfile: DistanceProfile
}
export type AmbientRecord = AmbientEvidence & (JourneyRecord | { kind: 'territories'; sources: string[]; accepted: boolean; maximumMetres: number; sourceNodes: number[] })
export const ALGORITHM_CYCLE_VERSION = 'five-algorithms-with-territories/1'
const ALGORITHMS: SearchAlgorithm[] = ['dijkstra', 'bidirectional', 'astar', 'bidirectional-astar', 'greedy']
const HOLD_MS = 6000, FADE_MS = 2000, ATTEMPTS = 5
const off = (): AmbientState => ({ active: false, running: false, phase: 'off', opacity: 1, message: '' })

/** One active trace; bounded metadata history. Presentation time never changes search events. */
export class AmbientSequence {
  state: AmbientState = off()
  records: AmbientRecord[] = []
  duration = 30
  algorithm: SearchAlgorithm = 'dijkstra'
  private algorithmIndex = 0
  private journey = 0
  private selector?: JourneySelector
  private territorySelector?: TerritorySelector
  private pair?: JourneyPair | TerritoryStudy
  private attempts = 0
  private elapsed = 0
  private frame = 0
  private reduced = false
  private poolVersion = POOL_VERSION
  private changed: (state: AmbientState) => void
  private search: (pair: JourneyPair | TerritoryStudy, algorithm: SearchAlgorithm) => void
  constructor(changed: (state: AmbientState) => void, search: (pair: JourneyPair | TerritoryStudy, algorithm: SearchAlgorithm) => void) { this.changed = changed; this.search = search }
  private publish(update: Partial<AmbientState>) { this.state = { ...this.state, ...update }; this.changed(this.state) }
  start(seed: number, reduced: boolean, firstAlgorithm: SearchAlgorithm = 'dijkstra', pool: AmbientPool = SWISS_POOL) {
    this.cancel(); this.selector = new JourneySelector(seed, pool.places, pool.distance); this.territorySelector = new TerritorySelector(seed ^ 0x74657272, pool); this.poolVersion = pool.version; this.records = []; this.reduced = reduced
    this.algorithmIndex = Math.max(0, ALGORITHMS.indexOf(firstAlgorithm)) - 1; this.journey = 0
    this.publish({ active: true, running: true, phase: 'preparing', opacity: 1, message: '' }); this.next()
  }
  next() {
    if (!this.state.active) return
    this.journey++; this.algorithm = this.journey % 5 === 0 ? 'multisource' : ALGORITHMS[++this.algorithmIndex % ALGORITHMS.length]
    this.cancel(); this.elapsed = 0; this.attempts = 0; this.selector!.beginJourney(); this.territorySelector!.beginStudy(); this.select()
  }
  private select() {
    this.pair = (this.algorithm === 'multisource' ? this.territorySelector!.choose() : this.selector!.choose()) ?? undefined
    if (!this.pair || ++this.attempts > ATTEMPTS) {
      this.publish({ phase: 'stopped', running: false, opacity: 1, message: this.algorithm === 'multisource' ? 'No separated three-source study after bounded attempts. Choose Next.' : 'No journey in this distance band after bounded attempts. Choose Next to try another band.' }); return
    }
    this.publish({ phase: 'preparing', opacity: this.reduced ? 1 : 0, message: '' }); this.search(this.pair, this.algorithm)
  }
  receive(result: SearchResult) {
    if (!this.state.active || !this.pair) return false
    if ('sources' in this.pair) {
      const study = this.pair, territory = result.territories
      const accepted = !!territory && result.algorithm === 'multisource-dijkstra/1' && result.sources?.length === 3 && territory.sourceNodes.length === 3 && territory.sourceNodes.every(count => count > 0) && Number.isFinite(territory.maximumMetres)
      // Coverage distance is a real nearest-source distance, not a route length.
      this.duration = accepted ? replaySeconds((territory.maximumMetres ?? 0) / 1000) : 30
      this.records.push({ kind: 'territories', sources: study.sources.map(source => source.id), accepted,
        maximumMetres: territory?.maximumMetres ?? 0, sourceNodes: territory?.sourceNodes ?? [],
        dataset: result.dataset, algorithm: result.algorithm, searchMs: result.searchMs, events: result.trace.length,
        replaySeconds: accepted ? this.duration : null, selector: TERRITORY_SELECTOR_VERSION, pool: this.poolVersion,
        seed: this.territorySelector!.seed, selection: this.territorySelector!.selections,
        cycle: ALGORITHM_CYCLE_VERSION, journey: this.journey, distanceProfile: this.selector!.distance })
      this.records = this.records.slice(-12)
      if (!accepted) { this.select(); return false }
      this.territorySelector!.accept(study); this.publish({ phase: this.reduced ? 'still' : 'replay', opacity: 1 }); return true
    }
    const record = this.selector!.record(this.pair, result.routeMetres === null ? null : result.routeMetres / 1000)
    this.duration = record.accepted ? replaySeconds(record.roadKm!) : 30
    this.records.push({ ...record, dataset: result.dataset, algorithm: result.algorithm, searchMs: result.searchMs, events: result.trace.length,
      replaySeconds: record.accepted ? this.duration : null, selector: SELECTOR_VERSION, pool: this.poolVersion, distanceProfile: this.selector!.distance, seed: this.selector!.seed, selection: this.selector!.selections,
      cycle: ALGORITHM_CYCLE_VERSION, journey: this.journey })
    this.records = this.records.slice(-12)
    if (!record.accepted) { this.select(); return false }
    this.publish({ phase: this.reduced ? 'still' : 'replay', opacity: 1 })
    return true
  }
  complete() {
    if (!this.state.active || this.state.phase !== 'replay') return
    this.elapsed = 0; this.publish({ phase: this.reduced ? 'still' : 'hold' }); this.schedule()
  }
  pause() { this.cancel(); this.publish({ running: false }) }
  resume() {
    if (!this.state.active || this.state.phase === 'stopped') return
    this.publish({ running: true }); this.schedule()
  }
  inspect() { this.cancel(); this.elapsed = 0; this.publish({ phase: 'replay', running: false, opacity: 1 }) }
  fail(message: string) { this.cancel(); this.publish({ phase: 'stopped', running: false, opacity: 1, message }) }
  setReduced(value: boolean) {
    this.reduced = value
    if (value && this.state.active && this.state.phase !== 'preparing') { this.cancel(); this.publish({ phase: 'still', running: false, opacity: 1 }) }
  }
  exit() { this.cancel(); this.pair = undefined; this.publish(off()) }
  private cancel() { cancelAnimationFrame(this.frame); this.frame = 0 }
  private schedule() {
    this.cancel()
    if (!this.state.running || !['hold', 'fade'].includes(this.state.phase) || this.reduced) return
    let previous = performance.now()
    const tick = (now: number) => {
      this.elapsed += Math.min(100, now - previous); previous = now
      if (this.state.phase === 'hold' && this.elapsed >= HOLD_MS) { this.elapsed = 0; this.publish({ phase: 'fade' }) }
      if (this.state.phase === 'fade') {
        if (this.elapsed >= FADE_MS) { this.next(); return }
        this.publish({ opacity: 1 - this.elapsed / FADE_MS })
      }
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }
}
