import { useCallback, useEffect, useRef, useState } from 'react'
import { TimelineScrubber } from '@motionstudies/web/components/TimelineScrubber'
import '@motionstudies/web/timeline-scrubber.css'
import { RoadScene } from './map/RoadScene.ts'
import { PLACES } from './places.ts'
import { countsAt } from './search/engine.ts'
import type { Point, Reply, SearchAlgorithm, SearchResult, StudyManifest } from './search/contracts.ts'
import { SoundControl } from './music/SoundControl.tsx'
import './study.css'

const number = new Intl.NumberFormat('en-CH')
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function App() {
  const host = useRef<HTMLDivElement>(null), scene = useRef<RoadScene | null>(null), worker = useRef<Worker | null>(null)
  const currentRequest = useRef(0), progressRef = useRef(0), initialQuery = useRef({ start: PLACES[0], goal: PLACES[1] })
  const [attempt, setAttempt] = useState(0)
  const [start, setStart] = useState<Point>(PLACES[0]), [goal, setGoal] = useState<Point>(PLACES[1])
  const [manifest, setManifest] = useState<StudyManifest | null>(null), [manifestUrl, setManifestUrl] = useState('')
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState({ loaded: 0, total: 0, stage: 'Opening the road record' })
  const [result, setResult] = useState<SearchResult | null>(null)
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('dijkstra')
  const algorithmRef = useRef<SearchAlgorithm>('dijkstra')
  const [progress, setProgress] = useState(0), [playing, setPlaying] = useState(false), [duration, setDuration] = useState(30)
  const [revealing, setRevealing] = useState(false)
  const revealingRef = useRef(false)
  const [outlines, setOutlines] = useState(true)
  const outlinePreference = useRef(true)
  const [error, setError] = useState(''), [mapError, setMapError] = useState('')
  const [pick, setPick] = useState<'start' | 'goal' | null>(null)

  const seek = useCallback((value: number, animate = false) => {
    const p = Math.min(1, Math.max(0, value)); progressRef.current = p; setProgress(p)
    return scene.current?.setProgress(p, animate) ?? false
  }, [])
  const search = useCallback((a: Point, b: Point) => {
    if (!worker.current) return
    setError(''); setBusy(true); setPlaying(false); setPick(null)
    worker.current.postMessage({ type: 'search', requestId: ++currentRequest.current, start: a, goal: b, algorithm: algorithmRef.current })
  }, [])

  useEffect(() => {
    if (!host.current) return
    setReady(false); setError(''); setMapError(''); setResult(null); setPlaying(false); seek(0)
    let map: RoadScene | null = null
    try {
      map = new RoadScene(host.current); scene.current = map
      map.setGeographyVisible(outlinePreference.current)
      map.onRouteRevealChange = active => { revealingRef.current = active; setRevealing(active) }
      map.onRouteRevealComplete = () => setPlaying(false)
    }
    catch { setMapError('Map rendering is unavailable in this browser. The search record remains accessible.') }
    const engine = new Worker(new URL('./search/search.worker.ts', import.meta.url), { type: 'module' }); worker.current = engine
    const controller = new AbortController()
    engine.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data
      if (reply.type === 'progress') setLoading(reply)
      if (reply.type === 'manifest') { setManifest(reply.manifest); setManifestUrl(reply.manifestUrl); map?.setManifest(reply.manifest) }
      if (reply.type === 'geometry') map?.addGeometry(reply.bytes, reply.count)
      if (reply.type === 'ready') { setReady(true); search(initialQuery.current.start, initialQuery.current.goal) }
      if (reply.type === 'result' && reply.requestId === currentRequest.current) {
        const reducedMotion = prefersReducedMotion()
        setResult(reply.result); map?.setResult(reply.result); setBusy(false); seek(reducedMotion ? 1 : 0); setPlaying(!reducedMotion)
      }
      if (reply.type === 'error' && (reply.requestId === undefined || reply.requestId === currentRequest.current)) { setError(reply.message); setBusy(false) }
    }
    engine.onerror = () => { setError('The road search could not be started. Please try again.'); setBusy(false) }
    fetch(new URL('./data/pfad-manifest.json', document.baseURI), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('The edition record could not be loaded')
      const edition = await response.json()
      if (!edition.graph?.manifest) throw new Error('The road record is not available')
      engine.postMessage({ type: 'load', manifestUrl: new URL(edition.graph.manifest, response.url).href })
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not open the road record') })
    return () => { controller.abort(); engine.terminate(); map?.dispose(); scene.current = null; worker.current = null }
  }, [attempt, search, seek])

  useEffect(() => {
    if (scene.current) {
      scene.current.picking = pick !== null
      scene.current.onPick = (lon, lat) => {
        const point = { name: pick === 'start' ? 'Point A' : 'Point B', lon, lat }
        if (pick === 'start') setStart(point); else setGoal(point)
        setPick(null)
      }
    }
  }, [pick])
  useEffect(() => {
    scene.current?.setRevealPlaying(playing)
    if (!playing || !result || progressRef.current >= 1) return
    let frame = 0, previous = performance.now()
    const advance = (now: number) => {
      const next = Math.min(1, progressRef.current + Math.min(now - previous, 100) / (duration * 1000))
      previous = now
      const routeAnimating = seek(next, true)
      if (next < 1) frame = requestAnimationFrame(advance); else if (!routeAnimating) setPlaying(false)
    }
    frame = requestAnimationFrame(advance); return () => cancelAnimationFrame(frame)
  }, [playing, duration, result, seek, revealing])

  const counts = result ? countsAt(result, progress) : [0, 0, 0]
  const completed = progress >= 1 && result !== null
  const queryControl = (point: Point, update: (point: Point) => void, end: 'start' | 'goal') => (
    <div className={`endpoint-control ${pick === end ? 'picking' : ''}`}>
      <span className="point-letter">{end === 'start' ? 'A' : 'B'}</span>
      <select aria-label={end === 'start' ? 'Start place' : 'Destination place'} value={point.name} onChange={event => update(PLACES.find(place => place.name === event.target.value)!)}>
        {!PLACES.some(place => place.name === point.name) && <option value={point.name}>{point.name}</option>}
        {PLACES.map(place => <option key={place.name}>{place.name}</option>)}
      </select>
      <button className="pick-button" disabled={!ready || busy || !!mapError} onClick={() => setPick(pick === end ? null : end)} aria-label={`Choose ${end === 'start' ? 'start' : 'destination'} on map`} aria-pressed={pick === end} title="Choose on map">⌖</button>
    </div>
  )
  return <div className="study" data-state={error ? 'error' : result ? 'ready' : 'loading'} data-progress={progress} data-algorithm={result?.algorithm ?? algorithm}>
    <header className="study-header">
      <div className="identity"><a href="https://motionstudies.app/" className="series">Motion Studies</a><h1>PFAD</h1><p>The roads not taken</p></div>
      <div className="header-tools"><details className="about"><summary>About this study</summary><div className="about-panel">
        <h2>A study of time, space, and the paths not taken.</h2>
        <p>A real shortest-distance search across Switzerland’s recorded road network. Every illuminated road was examined by the algorithm.</p>
        <p>The playback clock follows algorithm event order. It stretches the computation; it does not reproduce the timing of individual processor operations.</p>
        <p>Bidirectional Dijkstra searches from both ends: mint from A, amber from B. A small light marks their first real connection. The algorithm continues until it has confirmed the shortest distance.</p>
        <p>Once the recorded search ends, a travelling light reveals the chosen route from origin to destination.</p>
        <p>This first study applies road lengths and one-way directions. Turn, barrier and time-dependent access rules are still being developed. Its route describes this connectivity model.</p>
        <p>OpenStreetMap snapshot · 29 September 2026.<br />Road curves are simplified for drawing; search costs retain original lengths.</p>
        <p>The optional outlines provide quiet geographic context: Switzerland’s border from swissBOUNDARIES3D (2026-01), and lake shorelines from the FOEN Vector25 reference network (2007). They stay visible independently of the search.</p>
        <p>Original ambient sketches composed using Driftbox: Plateau, Contours and Afterglow. This is a provisional score, flowing independently of the search. Sound starts off and pauses when you leave the page.</p>
        <p><a href={manifestUrl || './data/pfad-manifest.json'}>Dataset and source record</a>{manifest && <> · <a href={new URL(manifest.evidence.path, manifestUrl).href}>Source evidence</a></>}</p>
        <a href="https://github.com/emmettl/pfad">PFAD repository ↗</a>
      </div></details><div className="map-tools"><SoundControl /><button className="outline-control" aria-label="Show border and lake outlines" aria-pressed={outlines} disabled={!!mapError} onClick={() => { const visible = !outlines; setOutlines(visible); outlinePreference.current = visible; scene.current?.setGeographyVisible(visible) }}><span aria-hidden="true">◇</span> Outlines</button></div></div>
    </header>
    <div className="route-panel" aria-label="Search endpoints">
      {queryControl(start, setStart, 'start')}
      <button className="swap-button" aria-label="Swap start and destination" disabled={busy} onClick={() => { setStart(goal); setGoal(start) }}>⇄</button>
      {queryControl(goal, setGoal, 'goal')}
      <button className="search-button" disabled={!ready || busy} onClick={() => search(start, goal)}>{busy ? 'Computing…' : 'Search'}</button>
    </div>
    <main className={`map ${pick ? 'pick-mode' : ''}`} ref={host} aria-label="Recorded pathfinding across Switzerland" />
    {pick && <div className="map-hint">Choose point {pick === 'start' ? 'A' : 'B'} on the map <button onClick={() => setPick(null)}>Cancel</button></div>}
    {!ready && !error && <div className="loading-panel" role="status"><span className="loading-title">Opening Switzerland</span><p>{loading.stage}</p>{loading.total > 0 && <><progress value={loading.loaded} max={loading.total} aria-label="Road data download" /><span className="mono">{(loading.loaded / 1000000).toFixed(1)} / {(loading.total / 1000000).toFixed(1)} MB</span></>}</div>}
    {error && <div className="error-panel" role="alert"><p>{error}</p><button onClick={() => { initialQuery.current = { start, goal }; setAttempt(value => value + 1) }}>Try again</button></div>}
    {mapError && <div className="error-panel" role="status"><p>{mapError}</p></div>}
    <button className="reset-view" aria-label="Show whole network" title="Show whole network" onClick={() => scene.current?.resetView()}>↗↙</button>
    <div className="playback-panel">
      <div className="search-readout">
        <div className="route-caption">{result ? <>{result.start.name}<span>→</span>{result.goal.name}{completed && result.routeMetres !== null && <em>{(result.routeMetres / 1000).toFixed(1)} km</em>}</> : <span>A real search. A slower clock.</span>}</div>
        <div className="compute-readout"><select aria-label="Search algorithm" value={algorithm} disabled={!ready || busy} onChange={event => { const mode = event.target.value as SearchAlgorithm; algorithmRef.current = mode; setAlgorithm(mode); search(start, goal) }}><option value="dijkstra">Dijkstra</option><option value="bidirectional">Bidirectional Dijkstra</option></select>{result && <><strong data-testid="compute-time">{result.searchMs.toFixed(0)} ms</strong><span>computation</span></>}{result?.backwardTimes && <span className="front-key"><i className="front-a" />A<i className="front-b" />B</span>}</div>
      </div>
      <div className="replay-controls">
        <button disabled={!result || busy} onClick={() => { if (progress >= 1 && !revealingRef.current) seek(0); setPlaying(value => !value) }}>{playing ? 'Pause' : 'Play'}</button>
        <button disabled={!result || busy} onClick={() => { seek(0); setPlaying(true) }} aria-label="Replay search from the beginning">↺</button>
        <TimelineScrubber windowStart={0} windowEnd={duration} time={progress * duration} onSeek={time => { setPlaying(false); seek(time / duration) }} onScrubStart={() => setPlaying(false)} ariaLabel="Search replay" ariaValueText={`${(progress * duration).toFixed(1)} seconds of ${duration}; ${Math.floor(progress * (result?.trace.length ?? 0))} recorded events`} step={.01} disabled={!result || busy} />
        <span className="replay-time">{(progress * duration).toFixed(1)}<small> / {duration}s</small></span>
        <select aria-label="Replay duration" value={duration} onChange={event => setDuration(Number(event.target.value))}>{[5, 15, 30, 60, 120].map(value => <option key={value} value={value}>{value}s</option>)}</select>
      </div>
      <div className="event-readout"><span><strong data-testid="settled-count">{number.format(counts[0])}</strong> node settlements</span><span><strong data-testid="examined-count">{number.format(counts[1])}</strong> connections examined</span><span className="replay-status">{busy ? 'Recording search' : revealing ? playing ? 'Revealing the route' : 'Route reveal paused' : completed ? result.routeMetres === null ? 'No route in this graph' : 'Route found' : playing ? 'Replaying recorded events' : result ? 'Replay paused' : 'Preparing the network'}</span></div>
    </div>
    <footer><div className="map-credits"><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a><a href="https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices">Outlines: © swisstopo, FOEN</a></div><span>Switzerland · 29 Sep 2026 · Connectivity study</span></footer>
  </div>
}
