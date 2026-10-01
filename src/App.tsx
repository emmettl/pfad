import { useCallback, useEffect, useRef, useState } from 'react'
import { TimelineScrubber } from '@motionstudies/web/components/TimelineScrubber'
import '@motionstudies/web/timeline-scrubber.css'
import { RoadScene } from './map/RoadScene.ts'
import { COUNTRIES } from './countries.ts'
import { countsAt } from './search/engine.ts'
import type { Point, Reply, SearchAlgorithm, SearchResult, StudyManifest } from './search/contracts.ts'
import { SoundControl } from './music/SoundControl.tsx'
import './study.css'

const number = new Intl.NumberFormat('en-CH')
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function App() {
  const [country, setCountry] = useState(COUNTRIES[0])
  const [pendingCountry, setPendingCountry] = useState<string | null>(null)
  const places = country.places
  const pending = COUNTRIES.find(c => c.id === pendingCountry)
  const host = useRef<HTMLDivElement>(null), scene = useRef<RoadScene | null>(null), worker = useRef<Worker | null>(null)
  const currentRequest = useRef(0), progressRef = useRef(0), initialQuery = useRef({ start: COUNTRIES[0].places[0], goal: COUNTRIES[0].places[1] })
  const [attempt, setAttempt] = useState(0)
  const [start, setStart] = useState<Point>(COUNTRIES[0].places[0]), [goal, setGoal] = useState<Point>(COUNTRIES[0].places[1])
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
    setReady(false); setBusy(false); setManifest(null); setManifestUrl(''); setPick(null); setError(''); setMapError(''); setResult(null); setPlaying(false); setRevealing(false); revealingRef.current = false; setLoading({ loaded: 0, total: 0, stage: 'Opening the road record' }); seek(0); ++currentRequest.current
    let map: RoadScene | null = null
    try {
      map = new RoadScene(host.current); scene.current = map
      map.setGeographyVisible(outlinePreference.current)
      map.onRouteRevealChange = active => { revealingRef.current = active; setRevealing(active) }
      map.onRouteRevealComplete = () => setPlaying(false)
    }
    catch { setMapError('Map rendering is unavailable in this browser. The search record remains accessible.') }
    const engine = new Worker(new URL('./search/search.worker.ts', import.meta.url), { type: 'module' }); worker.current = engine
    engine.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data
      if (reply.type === 'progress') setLoading(reply)
      if (reply.type === 'manifest') { setManifest(reply.manifest); setManifestUrl(reply.manifestUrl); map?.setManifest(reply.manifest, country.outlines) }
      if (reply.type === 'geometry') map?.addGeometry(reply.bytes, reply.count)
      if (reply.type === 'ready') { setReady(true); search(initialQuery.current.start, initialQuery.current.goal) }
      if (reply.type === 'result' && reply.requestId === currentRequest.current) {
        const reducedMotion = prefersReducedMotion()
        setResult(reply.result); map?.setResult(reply.result); setBusy(false); seek(reducedMotion ? 1 : 0); setPlaying(!reducedMotion)
      }
      if (reply.type === 'error' && (reply.requestId === undefined || reply.requestId === currentRequest.current)) { setError(reply.message); setBusy(false) }
    }
    engine.onerror = () => { setError('The road search could not be started. Please try again.'); setBusy(false) }
    engine.postMessage({ type: 'load', manifestUrl: new URL(country.manifest, document.baseURI).href, expectedIdentity: country.identity })
    return () => { engine.terminate(); map?.dispose(); scene.current = null; worker.current = null }
  }, [attempt, country, search, seek])

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

  const chooseCountry = (id: string) => {
    const next = COUNTRIES.find(c => c.id === id)!
    if (next.id === country.id) { setPendingCountry(null); return }
    if (next.large && pendingCountry !== id) { setPendingCountry(id); return }
    initialQuery.current = { start: next.places[0], goal: next.places[1] }
    setStart(next.places[0]); setGoal(next.places[1]); setPendingCountry(null); setCountry(next)
  }
  const counts = result ? countsAt(result, progress) : [0, 0, 0]
  const completed = progress >= 1 && result !== null
  const queryControl = (point: Point, update: (point: Point) => void, end: 'start' | 'goal') => (
    <div className={`endpoint-control ${pick === end ? 'picking' : ''}`}>
      <span className="point-letter">{end === 'start' ? 'A' : 'B'}</span>
      <select aria-label={end === 'start' ? 'Start place' : 'Destination place'} value={point.name} onChange={event => update(places.find(place => place.name === event.target.value)!)}>
        {!places.some(place => place.name === point.name) && <option value={point.name}>{point.name}</option>}
        {places.map(place => <option key={place.name}>{place.name}</option>)}
      </select>
      <button className="pick-button" disabled={!ready || busy || !!mapError} onClick={() => setPick(pick === end ? null : end)} aria-label={`Choose ${end === 'start' ? 'start' : 'destination'} on map`} aria-pressed={pick === end} title="Choose on map">⌖</button>
    </div>
  )
  return <div className="study" data-state={error ? 'error' : result ? 'ready' : 'loading'} data-progress={progress} data-algorithm={result?.algorithm ?? algorithm}>
    <header className="study-header">
      <div className="identity"><a href="https://motionstudies.app/" className="series">Motion Studies</a><h1>PFAD</h1><p>The roads not taken</p></div>
      <div className="header-tools"><select className="country-control" aria-label="Country" value={pendingCountry ?? country.id} onChange={event => chooseCountry(event.target.value)}>{COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><details className="about"><summary>About this study</summary><div className="about-panel">
        <h2>A study of time, space, and the paths not taken.</h2>
        <p>A real shortest-distance search across {country.name}’s recorded road network. Every illuminated road was examined by the algorithm.</p>
        <p>The playback clock follows algorithm event order. It stretches the computation; it does not reproduce the timing of individual processor operations.</p>
        <p>Bidirectional Dijkstra searches from both ends: mint from A, amber from B. A small light marks their first real connection. The algorithm continues until it has confirmed the shortest distance.</p>
        <p>A* directs the search using a checked lower bound on the remaining distance. Cool blue roads shade towards ice-white as that estimate falls; recent examinations glow while earlier branches recede. Only roads actually examined are revealed.</p>
        <p>The A* distance bound is prepared separately from the timed search, with corrections for the graph’s rounded coordinates and road lengths. All three algorithms solve the same shortest-distance question.</p>
        <p>Once the recorded search ends, a travelling light reveals the chosen route from origin to destination.</p>
        <p>This first study applies road lengths and one-way directions. Turn, barrier and time-dependent access rules are still being developed. Ferries are excluded, so islands and Northern Ireland can form separate components. Its route describes this connectivity model.</p>
        <p>Endpoints snap to nearby main or residential road nodes, within two kilometres. Where possible, both ends use the same road component with the smallest combined displacement. The search still checks one-way reachability; disconnected journeys can return no route.</p>
        <p>OpenStreetMap snapshot · {country.snapshot}.<br />Road curves are simplified for drawing; search costs retain original lengths.</p>
        {country.outlines && <p>The optional outlines provide quiet geographic context: Switzerland’s border from swissBOUNDARIES3D (2026-01), and lake shorelines from the FOEN Vector25 reference network (2007). They stay visible independently of the search.</p>}
        <p>Original ambient sketches composed using Driftbox: Plateau, Contours and Afterglow. This is a provisional score, flowing independently of the search. Sound starts off and pauses when you leave the page.</p>
        <p><a href={manifestUrl || './data/pfad-manifest.json'}>Dataset and source record</a>{manifest && <> · <a href={new URL(manifest.evidence.path, manifestUrl).href}>Source evidence</a></>}</p>
        <a href="https://github.com/emmettl/pfad">PFAD repository ↗</a>
      </div></details><div className="map-tools"><SoundControl /><button className="outline-control" aria-label="Show border and lake outlines" aria-pressed={outlines} disabled={!!mapError || !country.outlines} onClick={() => { const visible = !outlines; setOutlines(visible); outlinePreference.current = visible; scene.current?.setGeographyVisible(visible) }}><span aria-hidden="true">◇</span> Outlines</button></div></div>
    </header>
    <div className="route-panel" aria-label="Search endpoints">
      {queryControl(start, setStart, 'start')}
      <button className="swap-button" aria-label="Swap start and destination" disabled={busy} onClick={() => { setStart(goal); setGoal(start) }}>⇄</button>
      {queryControl(goal, setGoal, 'goal')}
      <button className="search-button" disabled={!ready || busy} onClick={() => search(start, goal)}>{busy ? 'Computing…' : 'Search'}</button>
    </div>
    <main className={`map ${pick ? 'pick-mode' : ''}`} ref={host} aria-label={`Recorded pathfinding across ${country.name}`} />
    {pending && <div className="country-confirm" role="dialog" aria-label="Open a large road dataset"><p>{pending.name} · {pending.downloadMB} MB download</p><p>{pending.deviceNote}</p><button onClick={() => chooseCountry(pending.id)}>Open {pending.name}</button><button onClick={() => setPendingCountry(null)}>Cancel</button></div>}
    {pick && <div className="map-hint">Choose point {pick === 'start' ? 'A' : 'B'} on the map <button onClick={() => setPick(null)}>Cancel</button></div>}
    {!ready && !error && <div className="loading-panel" role="status"><span className="loading-title">Opening {country.name}</span><p>{loading.stage}</p>{loading.total > 0 && <><progress value={loading.loaded} max={loading.total} aria-label="Road data download" /><span className="mono">{(loading.loaded / 1000000).toFixed(1)} / {(loading.total / 1000000).toFixed(1)} MB</span></>}</div>}
    {error && <div className="error-panel" role="alert"><p>{error}</p><button onClick={() => { initialQuery.current = { start, goal }; setAttempt(value => value + 1) }}>Try again</button></div>}
    {mapError && <div className="error-panel" role="status"><p>{mapError}</p></div>}
    <button className="reset-view" aria-label="Show whole network" title="Show whole network" onClick={() => scene.current?.resetView()}>↗↙</button>
    <div className="playback-panel">
      <div className="search-readout">
        <div className="route-caption">{result ? <>{result.start.name}<span>→</span>{result.goal.name}{completed && result.routeMetres !== null && <em>{(result.routeMetres / 1000).toFixed(1)} km</em>}</> : <span>A real search. A slower clock.</span>}</div>
        <div className="compute-readout"><select aria-label="Search algorithm" value={algorithm} disabled={!ready || busy} onChange={event => { const mode = event.target.value as SearchAlgorithm; algorithmRef.current = mode; setAlgorithm(mode); search(start, goal) }}><option value="dijkstra">Dijkstra</option><option value="bidirectional">Bidirectional Dijkstra</option><option value="astar">A*</option></select>{result && <><strong data-testid="compute-time">{result.searchMs.toFixed(0)} ms</strong><span>computation</span></>}{result?.backwardTimes && <span className="front-key"><i className="front-a" />A<i className="front-b" />B</span>}{result?.goalProximity && <span className="front-key"><i className="goal-gradient" />Towards B</span>}</div>
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
    <footer><div className="map-credits"><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a>{country.outlines && <a href="https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices">Outlines: © swisstopo, FOEN</a>}</div><span>{country.name} · {country.snapshot} · Connectivity study</span></footer>
  </div>
}
