import { useCallback, useEffect, useRef, useState } from 'react'
import { TimelineScrubber } from '@motionstudies/web/components/TimelineScrubber'
import '@motionstudies/web/timeline-scrubber.css'
import { RoadScene } from './map/RoadScene.ts'
import { COUNTRIES } from './countries.ts'
import { countsAt } from './search/engine.ts'
import type { Point, Reply, SearchAlgorithm, SearchResult, StudyManifest } from './search/contracts.ts'
import { SoundControl, type SoundHandle } from './music/SoundControl.tsx'
import { AmbientSequence, type AmbientState } from './ambient/sequence.ts'
import { useAmbientChrome } from './ambient/useChrome.ts'
import type { JourneyPair } from './ambient/selector.ts'
import { ROAD_CACHE_NAME, type LoadMeasurements } from './search/chunks.ts'
import { readStudyLink, studyUrl, StudyUrlBinding, type StudyLink } from './records/link.ts'
import { exportRecord, downloadBlob } from './records/export.ts'
import './study.css'

const number = new Intl.NumberFormat('en-CH')
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const samePoint = (a: Point, b: Point) => a.name === b.name && a.lon === b.lon && a.lat === b.lat
const resultAlgorithm = (result: SearchResult): SearchAlgorithm => result.algorithm === 'bidirectional-dijkstra/1' ? 'bidirectional' : result.algorithm.split('/')[0] as SearchAlgorithm
const algorithmName = (algorithm: SearchAlgorithm) => ({ dijkstra: 'Dijkstra', bidirectional: 'Bidirectional Dijkstra', astar: 'A*' }[algorithm])

export function App() {
  const [shared, setShared] = useState(() => {
    const parsed = readStudyLink(location.hash)
    if (parsed.study && COUNTRIES.find(c => c.id === parsed.study!.country)?.identity !== parsed.study.dataset) return { error: 'The exact road release in this link is not available in this edition. Its graph has not been substituted.' }
    return parsed
  })
  const selectedCountry = shared.study ? COUNTRIES.find(c => c.id === shared.study!.country)! : COUNTRIES[0]
  const [country, setCountry] = useState(selectedCountry.large ? COUNTRIES[0] : selectedCountry)
  const [pendingCountry, setPendingCountry] = useState<string | null>(selectedCountry.large ? selectedCountry.id : null)
  const sharedFrame = useRef(shared.study)
  const urlBinding = useRef<StudyUrlBinding | null>(null)
  const [view, setView] = useState<StudyLink['view']>(shared.study?.view)
  const [recordStatus, setRecordStatus] = useState(''), [exporting, setExporting] = useState(false)
  const [copiedLink, setCopiedLink] = useState('')
  const places = country.places
  const pending = COUNTRIES.find(c => c.id === pendingCountry)
  const host = useRef<HTMLDivElement>(null), scene = useRef<RoadScene | null>(null), worker = useRef<Worker | null>(null)
  const currentRequest = useRef(0), progressRef = useRef(0), initialQuery = useRef({ start: shared.study?.start ?? COUNTRIES[0].places[0], goal: shared.study?.goal ?? COUNTRIES[0].places[1] })
  const sound = useRef<SoundHandle | null>(null)
  const cacheOwner = useRef<Promise<Cache | undefined> | null>(null)
  const manualDuration = useRef(30)
  const [ambientState, setAmbientState] = useState<AmbientState>({ active: false, running: false, phase: 'off', opacity: 1, message: '' })
  const ambient = useRef<AmbientSequence | null>(null), ambientSearch = useRef<(pair: JourneyPair, algorithm: SearchAlgorithm) => void>(() => {})
  ambient.current ??= new AmbientSequence(setAmbientState, (pair, mode) => ambientSearch.current(pair, mode))
  const [measurements, setMeasurements] = useState<LoadMeasurements | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [start, setStart] = useState<Point>(shared.study?.start ?? COUNTRIES[0].places[0]), [goal, setGoal] = useState<Point>(shared.study?.goal ?? COUNTRIES[0].places[1])
  const [manifest, setManifest] = useState<StudyManifest | null>(null), [manifestUrl, setManifestUrl] = useState('')
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState({ loaded: 0, total: 0, stage: 'Opening the road record' })
  const [result, setResult] = useState<SearchResult | null>(null)
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>(shared.study?.algorithm ?? 'dijkstra')
  const algorithmRef = useRef<SearchAlgorithm>(shared.study?.algorithm ?? 'dijkstra')
  const [progress, setProgress] = useState(0), [playing, setPlaying] = useState(false), [duration, setDuration] = useState(shared.study?.duration ?? 30)
  const [revealing, setRevealing] = useState(false)
  const revealingRef = useRef(false)
  const [outlines, setOutlines] = useState(shared.study?.outlines ?? true)
  const outlinePreference = useRef(shared.study?.outlines ?? true)
  const [error, setError] = useState(shared.error ?? ''), [mapError, setMapError] = useState('')
  const [pick, setPick] = useState<'start' | 'goal' | null>(null)
  const chrome = useAmbientChrome(ambientState.active && ambientState.running && ambientState.phase !== 'still' && !error && !mapError)

  const seek = useCallback((value: number, animate = false) => {
    const p = Math.min(1, Math.max(0, value)); progressRef.current = p; setProgress(p)
    return scene.current?.setProgress(p, animate) ?? false
  }, [])
  const togglePlayback = useCallback(() => {
    if (ambient.current!.state.active) {
      if (ambient.current!.state.phase === 'stopped') return
      if (ambient.current!.state.running) { ambient.current!.pause(); setPlaying(false); sound.current?.pauseSequence() }
      else { if (ambient.current!.state.phase === 'replay' && progressRef.current >= 1 && !revealingRef.current) ambient.current!.complete(); ambient.current!.resume(); setPlaying(ambient.current!.state.phase === 'replay'); sound.current?.resumeSequence() }
      return
    }
    if (!result || busy) return
    if (progressRef.current >= 1 && !revealingRef.current) seek(0)
    setPlaying(value => !value)
  }, [result, busy, seek])
  const search = useCallback((a: Point, b: Point, mode = algorithmRef.current) => {
    if (!worker.current) return
    setError(''); setBusy(true); setPlaying(false); setPick(null)
    if (country.large) { setResult(null); scene.current?.clearResult() }
    worker.current.postMessage({ type: 'search', requestId: ++currentRequest.current, start: a, goal: b, algorithm: mode })
  }, [country.large])

  useEffect(() => {
    const binding = new StudyUrlBinding(() => location.href, url => history.replaceState(history.state, '', url))
    urlBinding.current = binding
    const navigate = (event: HashChangeEvent) => {
      if ([event.oldURL, event.newURL].some(url => new URLSearchParams(new URL(url).hash.slice(1)).has('study'))) {
        binding.dispose()
        // A pending replay write can run between fragment navigation and this
        // event. Restore the requested URL before reloading its paused study.
        if (location.href !== event.newURL) history.replaceState(history.state, '', event.newURL)
        location.reload()
      }
    }
    const flush = () => binding.flush()
    window.addEventListener('hashchange', navigate)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => { binding.dispose(); urlBinding.current = null; window.removeEventListener('hashchange', navigate); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush) }
  }, [])

  ambientSearch.current = (pair, mode) => { algorithmRef.current = mode; setAlgorithm(mode); setStart(pair.start); setGoal(pair.goal); search(pair.start, pair.goal, mode) }
  const exitAmbient = () => {
    if (!ambient.current!.state.active) return
    ambient.current!.exit(); ++currentRequest.current; setBusy(false); setPlaying(false); setDuration(manualDuration.current); sound.current?.resumeSequence()
    if (result) { const mode = resultAlgorithm(result); algorithmRef.current = mode; setAlgorithm(mode); setStart(result.snapping?.requestedStart ?? result.start); setGoal(result.snapping?.requestedGoal ?? result.goal) }
    host.current?.focus()
  }

  useEffect(() => {
    const hide = () => { if (document.hidden && ambient.current!.state.active) { ambient.current!.pause(); setPlaying(false) } }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => {
      ambient.current!.setReduced(motion.matches)
      if (motion.matches && ambient.current!.state.active) { setPlaying(false); seek(1); sound.current?.pauseSequence() }
    }
    document.addEventListener('visibilitychange', hide); motion.addEventListener('change', changed)
    return () => { document.removeEventListener('visibilitychange', hide); motion.removeEventListener('change', changed); ambient.current!.exit() }
  }, [seek])
  useEffect(() => { if (ambientState.active && !ambientState.running) sound.current?.pauseSequence() }, [ambientState.active, ambientState.running])

  useEffect(() => {
    if (!host.current || shared.error || (shared.study?.country !== country.id && selectedCountry.large)) return
    setReady(false); setBusy(false); setMeasurements(null); setManifest(null); setManifestUrl(''); setPick(null); setError(''); setMapError(''); setResult(null); setPlaying(false); setRevealing(false); revealingRef.current = false; setLoading({ loaded: 0, total: 0, stage: 'Opening the road record' }); seek(0); ++currentRequest.current
    let map: RoadScene | null = null
    try {
      map = new RoadScene(host.current); scene.current = map
      map.onViewChange = setView
      map.setGeographyVisible(outlinePreference.current)
      map.onRouteRevealChange = active => { revealingRef.current = active; setRevealing(active) }
      map.onRouteRevealComplete = () => { setPlaying(false); ambient.current!.complete() }
    }
    catch { setMapError('Map rendering is unavailable in this browser. The search record remains accessible.') }
    const engine = new Worker(new URL('./search/search.worker.ts', import.meta.url), { type: 'module' }); worker.current = engine
    engine.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data
      if (reply.type === 'progress') setLoading(reply)
      if (reply.type === 'manifest') { setManifest(reply.manifest); setManifestUrl(reply.manifestUrl); map?.setManifest(reply.manifest, country.outlines) }
      if (reply.type === 'geometry') map?.addGeometry(reply.bytes, reply.count)
      if (reply.type === 'ready') { setReady(true); setMeasurements(reply.measurements); search(initialQuery.current.start, initialQuery.current.goal) }
      if (reply.type === 'result' && reply.requestId === currentRequest.current) {
        const sequence = ambient.current!
        if (sequence.state.active && !sequence.receive(reply.result)) { if (sequence.state.phase === 'stopped') setBusy(false); return }
        const reducedMotion = prefersReducedMotion()
        if (sequence.state.active) setDuration(sequence.duration)
        const frame = sharedFrame.current; sharedFrame.current = undefined
        setResult(reply.result); map?.setResult(reply.result); setBusy(false); seek(frame?.progress ?? (reducedMotion ? 1 : 0)); if (frame?.view) map?.setView(frame.view); setPlaying(!frame && !reducedMotion && (!sequence.state.active || sequence.state.running))
      }
      if (reply.type === 'error' && (reply.requestId === undefined || reply.requestId === currentRequest.current)) { setError(reply.message); setBusy(false); if (ambient.current!.state.active) ambient.current!.fail(reply.message) }
    }
    engine.onerror = () => { setError('The road search could not be started. Please try again.'); setBusy(false); if (ambient.current!.state.active) ambient.current!.fail('The road search could not be started.') }
    // Keep a window connection: WebKit private contexts otherwise drop their
    // worker-only cache when retry terminates the sole cache owner.
    cacheOwner.current ??= (async () => { try { return await globalThis.caches?.open(ROAD_CACHE_NAME) } catch { return undefined } })()
    void cacheOwner.current.then(() => { if (worker.current === engine) engine.postMessage({ type: 'load', manifestUrl: new URL(country.manifest, document.baseURI).href, expectedIdentity: country.identity }) })
    return () => { engine.terminate(); map?.dispose(); scene.current = null; worker.current = null }
  }, [attempt, country, shared, search, seek])

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
      if (next < 1) frame = requestAnimationFrame(advance); else if (!routeAnimating) { setPlaying(false); ambient.current!.complete() }
    }
    frame = requestAnimationFrame(advance); return () => cancelAnimationFrame(frame)
  }, [playing, duration, result, seek, revealing])

  const chooseCountry = (id: string) => {
    const next = COUNTRIES.find(c => c.id === id)!
    if (next.id === country.id) { if (shared.study && shared.study.country !== next.id) clearShared(); else setPendingCountry(null); return }
    if (next.large && pendingCountry !== id) { setPendingCountry(id); return }
    exitAmbient()
    if (shared.study && shared.study.country !== next.id) { sharedFrame.current = undefined; setShared({}); history.replaceState(null, '', location.pathname + location.search) }
    const a = shared.study?.country === next.id ? shared.study.start : next.places[0], b = shared.study?.country === next.id ? shared.study.goal : next.places[1]
    initialQuery.current = { start: a, goal: b }
    setStart(a); setGoal(b); setPendingCountry(null); setCountry(next)
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || document.hidden) return
      const target = event.target instanceof Element ? event.target : null
      const timeline = !!target?.closest('.ms-timeline-scrubber')
      if (target?.closest('select, textarea, [contenteditable]:not([contenteditable="false"]), details, dialog, [role="dialog"], [role="combobox"], [role="listbox"], [role="menu"], [role="tree"], [role="radiogroup"]')) return
      if (target?.closest('input, [role="slider"], [role="spinbutton"]') && !timeline) return
      if (!result || busy || error || pick !== null || pendingCountry !== null) return
      const space = event.code === 'Space' || event.key === ' '
      if (space) {
        if (target?.closest('button, a, [role="button"]')) return
        event.preventDefault()
        if (!event.repeat) togglePlayback()
      } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); setPlaying(false)
        if (ambient.current!.state.active) { ambient.current!.inspect(); sound.current?.pauseSequence() }
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1
          : progressRef.current + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 5 : 1) / duration
        seek(next)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [result, busy, error, pick, pendingCountry, duration, seek, togglePlayback])

  const currentStudy = (): StudyLink | null => result?.dataset ? ({ schema: 'pfad-study-link/1', country: country.id, dataset: result.dataset.identity, profile: result.dataset.profile,
    start: result.snapping?.requestedStart ?? result.start, goal: result.snapping?.requestedGoal ?? result.goal, algorithm: resultAlgorithm(result), duration, progress: progressRef.current, outlines, view: scene.current?.getView() }) : null
  const currentParameters = (): StudyLink | null => {
    const study = currentStudy()
    if (shared.error || error || pendingCountry || ambientState.phase === 'preparing') return null
    const sameSearch = study?.dataset === country.identity && samePoint(start, study.start) && samePoint(goal, study.goal) && algorithm === study.algorithm
    const frame = sharedFrame.current
    const restoring = frame?.country === country.id && samePoint(start, frame.start) && samePoint(goal, frame.goal) && algorithm === frame.algorithm
    return { schema: 'pfad-study-link/1', country: country.id, dataset: country.identity, profile: manifest?.profile ?? 'road-connectivity-distance-v1',
      start, goal, algorithm, duration, progress: restoring ? frame.progress : !busy && sameSearch ? progressRef.current : 0, outlines,
      view: restoring ? frame.view : manifest?.identity === country.identity ? view : undefined }
  }
  useEffect(() => { urlBinding.current?.update(currentParameters()) })
  const clearShared = () => {
    history.replaceState(null, '', location.pathname + location.search); sharedFrame.current = undefined; setShared({}); setPendingCountry(null); setError('')
    initialQuery.current = { start: COUNTRIES[0].places[0], goal: COUNTRIES[0].places[1] }; setStart(initialQuery.current.start); setGoal(initialQuery.current.goal); setCountry(COUNTRIES[0])
  }
  const counts = result ? countsAt(result, progress) : [0, 0, 0]
  const completed = progress >= 1 && result !== null
  const queryControl = (point: Point, update: (point: Point) => void, end: 'start' | 'goal') => (
    <div className={`endpoint-control ${pick === end ? 'picking' : ''}`}>
      <span className="point-letter">{end === 'start' ? 'A' : 'B'}</span>
      <select aria-label={end === 'start' ? 'Start place' : 'Destination place'} value={point.name} disabled={ambientState.active} onChange={event => update(places.find(place => place.name === event.target.value)!)}>
        {!places.some(place => place.name === point.name) && <option value={point.name}>{point.name}</option>}
        {places.map(place => <option key={place.name}>{place.name}</option>)}
      </select>
      <button className="pick-button" disabled={!ready || busy || !!mapError} onClick={() => setPick(pick === end ? null : end)} aria-label={`Choose ${end === 'start' ? 'start' : 'destination'} on map`} aria-pressed={pick === end} title="Choose on map">⌖</button>
    </div>
  )
  return <div className="study" data-state={error ? 'error' : result ? 'ready' : 'loading'} data-progress={progress} data-algorithm={result?.algorithm ?? algorithm} data-ambient-phase={ambientState.phase} data-ambient-running={ambientState.running} data-ambient-chrome={ambientState.active ? chrome.visible ? 'visible' : 'quiet' : 'off'}
    onPointerMoveCapture={chrome.wake} onPointerDownCapture={chrome.wake} onWheelCapture={chrome.wake} onFocusCapture={chrome.wake} onBlurCapture={chrome.wake}
    onKeyDownCapture={event => {
      chrome.wake()
      if (ambientState.active && event.key === 'Escape' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) {
        event.preventDefault(); exitAmbient()
      }
    }}>
    <header className="study-header">
      <div className="identity"><a href="https://motionstudies.app/" className="series">Motion Studies</a><h1>PFAD</h1><p>The roads not taken</p></div>
      <div className="header-tools"><select className="country-control" aria-label="Country" disabled={!!shared.error} value={pendingCountry ?? country.id} onChange={event => chooseCountry(event.target.value)}>{COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><details className="about"><summary>{ambientState.active ? 'About' : 'About this study'}</summary><div className="about-panel">
        <h2>A study of time, space, and the paths not taken.</h2>
        <p>A real shortest-distance search across {country.name}’s recorded road network. Every illuminated road was examined by the algorithm.</p>
        <p>The playback clock follows algorithm event order. It stretches the computation; it does not reproduce the timing of individual processor operations.</p>
        <p>Bidirectional Dijkstra searches from both ends: mint from A, amber from B. A small light marks their first real connection. The algorithm continues until it has confirmed the shortest distance.</p>
        <p>A* directs the search using a checked lower bound on the remaining distance. Cool blue roads shade towards ice-white as that estimate falls; recent examinations glow while earlier branches recede. Only roads actually examined are revealed.</p>
        <p>The A* distance bound is prepared separately from the timed search, with corrections for the graph’s rounded coordinates and road lengths. All three algorithms solve the same shortest-distance question.</p>
        <p>Once the recorded search ends, a travelling light reveals the chosen route from origin to destination.</p>
        <p id="playback-shortcuts">Keyboard: Space plays or pauses the search replay; in ambient it pauses the whole sequence and Escape leaves ambient. Left/Right moves one second; hold Shift to move five seconds. Home/End jumps to the beginning or end. These shortcuts work on the map and timeline; place pickers and sound controls keep their own keys.</p>
        <p>Ambient chooses journeys from twelve curated Swiss places and cycles Dijkstra, bidirectional Dijkstra and A*, beginning with the selected algorithm. Road distance sets both the selection band and replay duration (25–65 seconds), followed by a six-second hold and two seconds to darkness. Pause sequence pauses the score too; Next keeps it continuous. Reduced motion shows stills with deliberate Next. The sequence pauses when the page is hidden.</p>
        <p>This first study applies road lengths and one-way directions. Turn, barrier and time-dependent access rules are still being developed. Ferries are excluded, so islands and Northern Ireland can form separate components. Its route describes this connectivity model.</p>
        <p>Endpoints snap to nearby main or residential road nodes, within two kilometres. Where possible, both ends use the same road component with the smallest combined displacement. The search still checks one-way reachability; disconnected journeys can return no route.</p>
        {result && <p>Current endpoint displacement: A {result.start.snapMetres.toFixed(0)} m · B {result.goal.snapMetres.toFixed(0)} m from the requested coordinates.</p>}
        <p>OpenStreetMap snapshot · {country.snapshot}.<br />Road curves are simplified for drawing; search costs retain original lengths.</p>
        {country.outlines && <p>The optional outlines provide quiet geographic context: {country.outlineDescription} They stay visible independently of the search.</p>}
        <p>Original ambient sketches composed using Driftbox: Plateau, Contours and Afterglow. This is a provisional score, flowing independently of the search. Sound starts off and pauses when you leave the page.</p>
        <p><a href={manifestUrl || './data/pfad-manifest.json'}>Dataset and source record</a>{manifest && <> · <a href={new URL(manifest.evidence.path, manifestUrl).href}>Source evidence</a></>} · <a href="./profiles/road-connectivity-distance-v1.json">Declared routing profile</a></p>
        {measurements && <p>Opening record: {(measurements.networkBytes / 1000000).toFixed(1)} MB downloaded, {(measurements.cachedBytes / 1000000).toFixed(1)} MB from verified cache · {measurements.totalMs.toFixed(0)} ms to complete graph. {measurements.cacheAvailable ? 'Up to two releases are cached within 128 MiB.' : 'Persistent storage unavailable; verified network loading remains available.'}</p>}
        <p>The address bar follows the current settings, replay frame and map view. Share its URL to open that study paused; sound stays off.</p>
        <div className="record-actions">
          <button disabled={!result || busy} onClick={async () => {
            const study = currentParameters(); if (!study) return
            urlBinding.current?.update(study); const url = urlBinding.current?.flush() ?? studyUrl(location.href, study); setCopiedLink(url)
            try { await navigator.clipboard.writeText(url); setRecordStatus('Study link copied. Opens paused at this frame.') }
            catch { setRecordStatus('Select the link below to copy it.') }
          }}>Copy study link</button>
          <button disabled={!result || busy || !manifest || exporting} onClick={async () => {
            const study = currentStudy(); if (!study || !result || !manifest) return
            setExporting(true); setRecordStatus('Preparing the recorded search…')
            try { downloadBlob(await exportRecord(result, manifest, study, ambient.current!.records), `pfad-${country.id}-${result.algorithm.split('/')[0]}.pfad.gz`); setRecordStatus('Search record exported with source identity and exact events.') }
            catch { setRecordStatus('The search record could not be exported. Try again.') }
            finally { setExporting(false) }
          }}>{exporting ? 'Exporting…' : 'Export search record'}</button>
          {copiedLink && <input aria-label="Study link" readOnly value={copiedLink} onFocus={event => event.target.select()} />}
          <span role="status">{recordStatus}</span>
        </div>
        <a href="https://github.com/emmettl/pfad">PFAD repository ↗</a>
      </div></details><div className="map-tools"><SoundControl ref={sound} sequencePaused={ambientState.active && !ambientState.running} /><button className="outline-control" aria-label="Show border and lake outlines" aria-pressed={outlines} disabled={!ready || !!mapError || !country.outlines} onClick={() => { const visible = !outlines; setOutlines(visible); outlinePreference.current = visible; scene.current?.setGeographyVisible(visible) }}><span aria-hidden="true">◇</span> Outlines</button></div></div>
    </header>
    <div className="route-panel" aria-label="Search endpoints">
      {queryControl(start, setStart, 'start')}
      <button className="swap-button" aria-label="Swap start and destination" disabled={busy} onClick={() => { setStart(goal); setGoal(start) }}>⇄</button>
      {queryControl(goal, setGoal, 'goal')}
      <button className="search-button" disabled={!ready || busy} onClick={() => search(start, goal)}>{busy ? 'Computing…' : 'Search'}</button>
    </div>
    <main className={`map ${pick ? 'pick-mode' : ''}`} ref={host} style={{ opacity: ambientState.opacity }} tabIndex={0} aria-label={`Recorded pathfinding across ${country.name}`} aria-describedby="playback-shortcuts" aria-keyshortcuts="Space ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Home End Escape" />
    {pending && <div className="country-confirm" role="dialog" aria-label="Open a large road dataset"><p>{pending.name} · {pending.downloadMB} MB download</p><p>{pending.deviceNote}</p><button onClick={() => chooseCountry(pending.id)}>Open {pending.name}</button><button onClick={() => shared.study ? clearShared() : setPendingCountry(null)}>Cancel</button></div>}
    {pick && <div className="map-hint">Choose point {pick === 'start' ? 'A' : 'B'} on the map <button onClick={() => setPick(null)}>Cancel</button></div>}
    {!ready && !error && <div className="loading-panel" role="status"><span className="loading-title">Opening {country.name}</span><p>{loading.stage}</p>{loading.total > 0 && <><progress value={loading.loaded} max={loading.total} aria-label="Road data download" /><span className="mono">{(loading.loaded / 1000000).toFixed(1)} / {(loading.total / 1000000).toFixed(1)} MB</span></>}</div>}
    {error && <div className="error-panel" role="alert"><p>{error}</p><button onClick={() => { if (shared.error) { clearShared(); return } exitAmbient(); initialQuery.current = { start, goal }; setAttempt(value => value + 1) }}>{shared.error ? 'Open default study' : 'Try again'}</button></div>}
    {mapError && <div className="error-panel" role="status"><p>{mapError}</p></div>}
    <button className="reset-view" aria-label="Show whole network" title="Show whole network" onClick={() => scene.current?.resetView()}>↗↙</button>
    <div className="playback-panel">
      <div className="search-readout">
        <div className="route-caption">{result ? <>{result.start.name}<span>→</span>{result.goal.name}{completed && result.routeMetres !== null && <em>{(result.routeMetres / 1000).toFixed(1)} km</em>}</> : <span>A real search. A slower clock.</span>}{ambientState.active && <span className="ambient-algorithm">{algorithmName(algorithm)}</span>}</div>
        <div className="compute-readout"><button className="ambient-start" disabled={!ready || busy || pendingCountry !== null || !!mapError} title="A looping series of distance-selected journeys" onClick={() => { manualDuration.current = duration; setPick(null); scene.current?.resetView(); ambient.current!.start(crypto.getRandomValues(new Uint32Array(1))[0], prefersReducedMotion(), algorithm, country.ambient); host.current?.focus() }}>Ambient</button><select aria-label="Search algorithm" value={algorithm} disabled={!ready || busy} onChange={event => { const mode = event.target.value as SearchAlgorithm; algorithmRef.current = mode; setAlgorithm(mode); search(start, goal) }}><option value="dijkstra">Dijkstra</option><option value="bidirectional">Bidirectional Dijkstra</option><option value="astar">A*</option></select>{result && <><strong data-testid="compute-time">{result.searchMs.toFixed(0)} ms</strong><span>computation</span></>}{result?.backwardTimes && <span className="front-key"><i className="front-a" />A<i className="front-b" />B</span>}{result?.goalProximity && <span className="front-key"><i className="goal-gradient" />Towards B</span>}</div>
      </div>
      {ambientState.active && <div className="ambient-controls" aria-label="Ambient sequence">
        <button aria-label={ambientState.running ? 'Pause sequence' : 'Resume sequence'} onClick={togglePlayback} disabled={ambientState.phase === 'stopped'}>{ambientState.running ? 'Pause' : 'Resume'}</button>
        <button aria-label="Next journey" disabled={busy} onClick={() => ambient.current!.next()}>Next</button>
        <button aria-label="Exit ambient" title="Exit ambient (Escape)" onClick={exitAmbient}>Exit</button>
        <span role="status">{ambientState.message || (!ambientState.running && ambientState.phase !== 'still' ? 'Sequence paused' : ({ preparing: 'Finding a journey', replay: 'The search', hold: 'The road taken', fade: 'Between journeys', still: 'Choose Next for another still' }[ambientState.phase as string] ?? 'Sequence paused'))}</span>
      </div>}
      <div className="replay-controls">
        <button disabled={!result || busy} onClick={togglePlayback} title="Play / pause (Space)" aria-keyshortcuts="Space">{playing ? 'Pause' : 'Play'}</button>
        <button disabled={!result || busy} onClick={() => { seek(0); setPlaying(true) }} aria-label="Replay search from the beginning">↺</button>
        <TimelineScrubber windowStart={0} windowEnd={duration} time={progress * duration} onSeek={time => { setPlaying(false); seek(time / duration) }} onScrubStart={() => setPlaying(false)} ariaLabel="Search replay" describedBy="playback-shortcuts" ariaValueText={`${(progress * duration).toFixed(1)} seconds of ${duration}; ${Math.floor(progress * (result?.trace.length ?? 0))} recorded events`} step={.01} disabled={!result || busy} />
        <span className="replay-time">{(progress * duration).toFixed(1)}<small> / {Number(duration.toFixed(1))}s</small></span>
        <select aria-label="Replay duration" value={duration} onChange={event => setDuration(Number(event.target.value))}>{![5, 15, 30, 60, 120].includes(duration) && <option value={duration}>{duration.toFixed(1)}s</option>}{[5, 15, 30, 60, 120].map(value => <option key={value} value={value}>{value}s</option>)}</select>
      </div>
      <div className="event-readout"><span><strong data-testid="settled-count">{number.format(counts[0])}</strong> node settlements</span><span><strong data-testid="examined-count">{number.format(counts[1])}</strong> connections examined</span><span className="replay-status">{busy ? 'Recording search' : revealing ? playing ? 'Revealing the route' : 'Route reveal paused' : completed ? result.routeMetres === null ? 'No route in this graph' : 'Route found' : playing ? 'Replaying recorded events' : result ? 'Replay paused' : 'Preparing the network'}</span></div>
    </div>
    <footer><div className="map-credits"><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a>{country.outlines && <a href={country.outlineCreditUrl}>Outlines: {country.outlineCredit}</a>}</div><span>{country.name} · {country.snapshot} · Connectivity study</span></footer>
  </div>
}
