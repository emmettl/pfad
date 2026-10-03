import { traceLength } from '../search/trace.ts'
import { prepareSpatialReplayDrawing, replayVertexCount } from './replayDrawing.ts'
import { prepareReplayTextures, prepareReplayTexturesAsync, replayTextureBytes, type ReplayTextures } from './replayTextures.ts'
import { drawingRoadRange, drawingChunkNeeded, type DrawingRoadRange } from './drawingLayout.ts'
import { unpackDrawing } from './drawing-codec.ts'
import { longitudeOffset, normaliseLongitude } from '../search/projection.ts'
import * as THREE from 'three'
import type { Chunk, Point, SearchResult, StudyManifest } from '../search/contracts.ts'
import { replayFrame, RouteDrawing, RouteReveal } from './routeReveal.ts'
import { createRouteGeometry, createRouteMaterial } from './routeMaterial.ts'
import type { Geography } from './geography-loader.ts'
import { createGeography, createGeographyFill, disposeGeography } from './geography.ts'
import { MeetingFlash, createMeetingMaterial } from './meetingFlash.ts'

const vertexShader = `
  in uint roadId;
  uniform highp usampler2D uTimes;
  uniform highp usampler2D uBackwardTimes;
  uniform float uBidirectional;
  uniform sampler2D uSources;
  uniform float uTerritories;
  flat out float vSource;
  uniform sampler2D uGoalProximity;
  uniform float uAstar;
  uniform vec2 uTextureSize;
  flat out uvec2 vTimes;
  flat out uvec2 vBackwardTimes;
  out float vGoalProximity;
  void main() {
    vec2 uv = (vec2(roadId % uint(uTextureSize.x), roadId / uint(uTextureSize.x)) + .5) / uTextureSize;
    vTimes = texture(uTimes, uv).rg;
    vSource = uTerritories > .5 ? floor(texture(uSources, uv).r * 255. + .5) : 0.;
    vBackwardTimes = uBidirectional > .5 ? texture(uBackwardTimes, uv).rg : uvec2(0u);
    vGoalProximity = uAstar > .5 ? texture(uGoalProximity, uv).r : 0.;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0., 1.);
  }
`
const fragmentShader = `
  uniform highp uint uEvent;
  uniform float uTotal;
  uniform float uTerritories;
  uniform float uTerritoryComplete;
  uniform float uGreedy;
  uniform float uCompact;
  uniform float uDepth;
  uniform float uTree;
  uniform float uTimeAstar;
  uniform float uBreadth;
  flat in float vSource;
  uniform float uAstar;
  flat in uvec2 vTimes;
  flat in uvec2 vBackwardTimes;
  in float vGoalProximity;
  out vec4 outColor;
  vec4 front(uvec2 times, vec3 quiet, vec3 bright) {
    if (times.x == 0u || uEvent < times.x) return vec4(0.);
    uint recent = uGreedy > .5 && times.y != 0u && uEvent >= times.y ? max(times.x, times.y) : times.x;
    float age = float(uEvent - recent) / max(uTotal, 1.);
    float pulse = exp(-age / mix(mix(.006, mix(.0035, .014, uCompact), uGreedy), .022, uTimeAstar));
    uint improvement = times.y;
    float tree = improvement != 0u && uEvent >= improvement ? 1. : 0.;
    float memory = mix(mix(.12, .045, uAstar) + tree * mix(.07, .10, uAstar), mix(.10 + tree * .04, .32 + tree * .16, uCompact), uGreedy);
    if (uTree > .5) { if (tree < .5) return vec4(quiet, .025); return vec4(bright, .65 + pulse * .35); }
    memory = mix(memory, .38 + tree * .20, uTimeAstar);
    return vec4(mix(quiet, bright, pulse), mix(memory, .25 + tree * .12, uDepth) + pulse * mix(.72, .92, uGreedy));
  }
  void main() {
    vec3 quiet = mix(vec3(.21, .48, .42), mix(vec3(.16, .35, .65), vec3(.30, .55, .60), vGoalProximity), uAstar);
    vec3 bright = mix(vec3(.52, .95, .78), mix(vec3(.42, .72, 1.), vec3(.78, .97, 1.), vGoalProximity), uAstar);
    if (uGreedy > .5) {
      quiet = mix(vec3(.60, .24, .19), vec3(.90, .38, .27), uCompact);
      bright = mix(vec3(1., .40, .32), vec3(1., .87, .72), vGoalProximity);
    }
    if (uTimeAstar > .5) { quiet = mix(vec3(.32, .57, .85), vec3(.55, .80, .92), vGoalProximity); bright = vec3(.85, .97, 1.); }
    if (uTree > .5) { quiet = vec3(.40, .25, .20); bright = vec3(1., .64, .40); }
    if (uBreadth > .5) { quiet = vec3(.65, .43, .12); bright = vec3(1., .87, .43); }
    if (uBreadth > 1.5) { quiet = vec3(.48, .36, .68); bright = vec3(.85, .76, 1.); }
    if (uDepth > .5) { quiet = vec3(.55, .35, .75); bright = vec3(.90, .75, 1.); }
    if (uTerritories > .5) {
      if (vSource > 1.5) { quiet = vec3(.38, .35, .60); bright = vec3(.73, .70, 1.); }
      else if (vSource > .5) { quiet = vec3(.55, .38, .19); bright = vec3(1., .76, .43); }
      quiet = mix(quiet, bright * .7, uTerritoryComplete);
    }
    vec4 a = front(vTimes, quiet, bright);
    if (uTerritories > .5 && a.a > 0.) a.a += .10 * uTerritoryComplete;
    vec4 b = front(vBackwardTimes, vec3(.55, .38, .19), vec3(1., .76, .43));
    float total = a.a + b.a;
    if (total <= 0.) discard;
    outColor = vec4((a.rgb * a.a + b.rgb * b.a) / total, min(total, 1.));
  }
`

export class RoadScene {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10)
  material: THREE.ShaderMaterial
  texture: THREE.DataTexture
  backwardTexture: THREE.DataTexture
  sourceTexture: THREE.DataTexture
  proximityTexture: THREE.DataTexture
  manifest?: StudyManifest
  private geometryChunks: Chunk[] = []
  private storedDrawing: { bytes: ArrayBuffer; count: number; compressed: boolean; roadRange?: DrawingRoadRange }[] = []
  private roadBatches: { lines: THREE.LineSegments; ends: Uint32Array; bounds: readonly [number, number, number, number] }[] = []
  private drawingGeneration = 0
  private drawingDisposed = false
  private lastResult?: SearchResult
  private replayTextures?: ReplayTextures
  private restoredProgress = 0
  private replayProgress = 0
  onDrawingError?: (message: string) => void
  events = 1
  width = 1
  height = 1
  halfHeight = .8
  observer: ResizeObserver
  tip: HTMLDivElement
  focusEvents?: Uint32Array
  focusCoordinates?: Int32Array
  focusPoint?: Point
  markers: HTMLDivElement
  points: Point[] = []
  private pickingEnabled = false
  get picking() { return this.pickingEnabled }
  set picking(value: boolean) { this.pickingEnabled = value; this.updateSelectionFill() }
  onPick?: (lon: number, lat: number) => void
  onViewChange?: (view: { x: number; y: number; zoom: number }) => void
  pointers = new Map<number, { x: number; y: number }>()
  lastPinch = 0
  moved = 0
  frame = 0
  private viewTransition?: { from: { x: number; y: number; zoom: number }; to: { x: number; y: number; zoom: number }; elapsed: number }
  previousFrame = 0
  dirty = true
  renderInterval = 0
  lastRendered = -Infinity
  geography?: THREE.Group
  geographyVisible = true
  private geographyContext?: Geography
  private selectionFill?: THREE.Group
  drawing = new RouteDrawing()
  reveal = new RouteReveal()
  flash = new MeetingFlash()
  flashMaterial = createMeetingMaterial()
  flashPoint?: THREE.Points
  meetingEvent?: number
  routeMaterial = createRouteMaterial()
  route?: THREE.Mesh
  revealPlaying = false
  onRouteRevealChange?: (active: boolean) => void
  onRouteRevealComplete?: () => void
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor(readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' })
    this.renderer.setClearColor('#080d10', 1)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.camera.position.z = 2
    this.texture = new THREE.DataTexture(new Uint32Array([0, 0]), 1, 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.texture.needsUpdate = true
    this.backwardTexture = new THREE.DataTexture(new Uint32Array([0, 0]), 1, 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.backwardTexture.needsUpdate = true
    this.sourceTexture = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.sourceTexture.needsUpdate = true
    this.proximityTexture = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.proximityTexture.needsUpdate = true
    this.flashMaterial.uniforms.uPixelRatio.value = this.renderer.getPixelRatio()
    this.material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, glslVersion: THREE.GLSL3,
      uniforms: { uTree: { value: 0 }, uTimeAstar: { value: 0 }, uBreadth: { value: 0 }, uDepth: { value: 0 }, uCompact: { value: 0 }, uGreedy: { value: 0 }, uSources: { value: this.sourceTexture }, uTerritories: { value: 0 }, uTerritoryComplete: { value: 0 }, uTimes: { value: this.texture }, uBackwardTimes: { value: this.backwardTexture }, uBidirectional: { value: 0 }, uGoalProximity: { value: this.proximityTexture }, uAstar: { value: 0 }, uTextureSize: { value: new THREE.Vector2(1, 1) }, uEvent: { value: 0 }, uTotal: { value: 1 } },
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    })
    host.appendChild(this.renderer.domElement)
    this.tip = document.createElement('div'); this.tip.className = 'search-tip'; this.tip.setAttribute('aria-hidden', 'true'); this.tip.hidden = true; host.appendChild(this.tip)
    this.markers = document.createElement('div'); this.markers.className = 'map-markers'; host.appendChild(this.markers)
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host)
    const canvas = this.renderer.domElement
    canvas.addEventListener('webglcontextlost', this.loseDrawing)
    canvas.addEventListener('webglcontextrestored', this.restoreDrawing)
    canvas.addEventListener('wheel', this.wheel, { passive: false })
    canvas.addEventListener('pointerdown', this.pointerDown)
    canvas.addEventListener('pointermove', this.pointerMove)
    canvas.addEventListener('pointerup', this.pointerUp)
    canvas.addEventListener('pointercancel', this.pointerCancel)
    this.resize()
    this.previousFrame = performance.now()
    const draw = (now: number) => {
      if (this.flash.active && this.revealPlaying && !document.hidden) { this.flash.advance(Math.min(now - this.previousFrame, 100)); this.updateFlash() }
      this.advanceView(Math.min(now - this.previousFrame, 100))
      this.previousFrame = now
      if (this.dirty && now - this.lastRendered >= this.renderInterval - .5) {
        this.lastRendered = now
        this.cullRoadBatches(); this.renderer.render(this.scene, this.camera); this.placeMarkers()
        canvas.dataset.maxFps = this.renderInterval ? '30' : '60'
        canvas.dataset.event = String(this.material.uniforms.uEvent.value)
        if (canvas.dataset.roadUploads === 'resident') canvas.dataset.roadFrame = String(this.drawingGeneration)
        canvas.dataset.routePhase = !this.reveal.visible ? 'hidden' : this.reveal.active ? 'revealing' : 'complete'
        canvas.dataset.routeProgress = String(this.routeMaterial.uniforms.uProgress.value)
        canvas.dataset.routeEnergy = String(this.routeMaterial.uniforms.uEnergy.value)
        canvas.dataset.outlines = this.geography?.visible ? 'visible' : 'hidden'
        canvas.dataset.outlineCountry = this.geography?.userData.country ?? ''
        canvas.dataset.outlineSegments = String(this.geography?.userData.segments ?? 0)
        canvas.dataset.selectionFill = this.picking ? this.selectionFill ? 'country' : 'field' : 'hidden'
        canvas.dataset.meetingEvent = String(this.meetingEvent ?? 0)
        canvas.dataset.totalEvents = String(this.events)
        canvas.dataset.flashPhase = this.flash.active ? 'flashing' : 'hidden'
        canvas.dataset.flashProgress = String(this.flash.progress)
        canvas.dataset.focusEvent = this.tip.dataset.event ?? '0'
        canvas.dataset.greedy = this.material.uniforms.uGreedy.value ? 'true' : 'false'
        canvas.dataset.sourceCount = String(this.material.uniforms.uTerritories.value ? 3 : 0)
        canvas.dataset.territoryComplete = this.material.uniforms.uTerritoryComplete.value ? 'true' : 'false'
        canvas.dataset.timeEmphasis = this.material.uniforms.uTimeAstar.value ? 'true' : 'false'
        canvas.dataset.goalDirected = this.material.uniforms.uAstar.value ? 'true' : 'false'
        canvas.dataset.view = JSON.stringify(this.getView())
        this.dirty = false
      }
      this.frame = requestAnimationFrame(draw)
    }
    this.reducedMotion.addEventListener('change', this.motionChange)
    document.addEventListener('visibilitychange', this.visibilityChange)
    draw(this.previousFrame)
  }
  setManifest(manifest: StudyManifest) {
    this.manifest = manifest
    this.geometryChunks = manifest.chunks.filter(chunk => chunk.kind === 'geometry')
    const phoneNetwork = manifest.counts.nodes > 2000000 && window.matchMedia('(pointer: coarse)').matches
    this.renderInterval = phoneNetwork ? 1000 / 30 : 0
    this.renderer.setPixelRatio(phoneNetwork ? 1 : Math.min(window.devicePixelRatio, 1.5))
    this.flashMaterial.uniforms.uPixelRatio.value = this.renderer.getPixelRatio()
    if (this.geography) { this.scene.remove(this.geography); disposeGeography(this.geography) }
    this.geography = undefined
    this.geographyContext = undefined; this.clearSelectionFill(); this.updateSelectionFill()
    this.resetView()
  }
  setGeography(context: Geography) {
    this.geographyContext = context; this.clearSelectionFill()
    if (this.geography) { this.scene.remove(this.geography); disposeGeography(this.geography) }
    this.geography = createGeography(point => this.project(point), context)
    this.geography.visible = this.geographyVisible
    this.scene.add(this.geography)
    this.updateSelectionFill()
  }
  private updateSelectionFill() {
    if (this.picking && !this.selectionFill && this.geographyContext) {
      this.selectionFill = createGeographyFill(point => this.project(point), this.geographyContext)
      this.scene.add(this.selectionFill)
    }
    if (this.selectionFill) this.selectionFill.visible = this.picking
    // Retain a quiet cue if geographic context is unavailable.
    this.renderer.setClearColor(this.picking && !this.selectionFill ? '#0c1513' : '#080d10', 1)
    this.dirty = true
  }
  private clearSelectionFill() {
    if (this.selectionFill) {
      this.scene.remove(this.selectionFill); disposeGeography(this.selectionFill)
      this.selectionFill = undefined
    }
  }
  setGeographyVisible(visible: boolean) {
    this.geographyVisible = visible
    if (this.geography) this.geography.visible = visible
    this.dirty = true
  }
  addGeometry(bytes: ArrayBuffer, count: number, compressed = false) {
    const roadRange = drawingRoadRange(this.geometryChunks[this.storedDrawing.length], count)
    this.storedDrawing.push({ bytes, count, compressed, roadRange })
    this.renderer.domElement.dataset.roadVertices = String(Number(this.renderer.domElement.dataset.roadVertices ?? 0) + count)
    this.renderer.domElement.dataset.drawingBytes = String(this.storedDrawing.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0))
    this.renderer.domElement.dataset.roadUploads = 'deferred'
  }
  async prepareResult(result: SearchResult) {
    const generation = ++this.drawingGeneration
    this.clearRoadBatches()
    this.drawing.chunks = []
    const chosen = new Set(result.routeEdges)
    const textures = await prepareReplayTexturesAsync(result)
    if (this.drawingDisposed || generation !== this.drawingGeneration) return false
    this.replayTextures = textures
    let submitted = 0, decodedChunks = 0, yielded = performance.now()
    for (const chunk of this.storedDrawing) {
      if (performance.now() - yielded >= 12) { await new Promise<void>(resolve => setTimeout(resolve, 0)); yielded = performance.now() }
      if (this.drawingDisposed || generation !== this.drawingGeneration) return false
      if (!drawingChunkNeeded(chunk.roadRange, result.edgeTimes, result.backwardTimes, chosen)) continue
      decodedChunks++
      const bytes = chunk.compressed ? await unpackDrawing(chunk.bytes, chunk.count) : chunk.bytes
      if (this.drawingDisposed || generation !== this.drawingGeneration) return false
      if (bytes.byteLength !== chunk.count * 12) throw new Error('Stored drawing geometry size mismatch')
      const positions = new Float32Array(bytes, 0, chunk.count * 2)
      const roads = this.manifest && this.manifest.counts.edges > 16777216 ? new Uint32Array(bytes, chunk.count * 8, chunk.count) : new Float32Array(bytes, chunk.count * 8, chunk.count)
      // Retain only the chosen route's exact geometry on the CPU.
      for (let begin = 0; begin < roads.length;) {
        let end = begin + 1
        while (end < roads.length && roads[end] === roads[begin]) end++
        if (chosen.has(roads[begin])) this.drawing.add(positions.slice(begin * 2, end * 2), roads.slice(begin, end))
        begin = end
      }
      const batches = prepareSpatialReplayDrawing(positions, roads, result.edgeTimes, result.backwardTimes, traceLength(result))
      const upload = new THREE.Scene()
      for (const selected of batches) {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(selected.bytes, 0, selected.count * 2), 2))
        const integerIds = new Uint32Array(selected.bytes, selected.count * 8, selected.count)
        const ids = new THREE.BufferAttribute(integerIds, 1)
        const selectedRoads = roads instanceof Uint32Array ? new Uint32Array(selected.bytes, selected.count * 8, selected.count) : new Float32Array(selected.bytes, selected.count * 8, selected.count)
        // Integer attributes retain exact texture row indices, including national graph IDs.
        if (textures.lookup || !(roads instanceof Uint32Array)) for (let i = 0; i < selected.count; i++) integerIds[i] = textures.lookup ? textures.lookup[selectedRoads[i]] : selectedRoads[i]
        ids.gpuType = THREE.IntType
        geometry.setAttribute('roadId', ids)
        const [left, bottom, right, top] = selected.bounds
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3((left + right) / 2, (bottom + top) / 2, 0), Math.hypot(right - left, top - bottom) / 2 + 1e-7)
        const lines = new THREE.LineSegments(geometry, this.material)
        lines.frustumCulled = false
        // Upload once, then release expanded CPU buffers. The original drawing
        // remains available for repeated searches and context restoration.
        for (const attribute of Object.values(geometry.attributes)) if (attribute instanceof THREE.BufferAttribute) attribute.onUpload(() => { attribute.array = attribute.array instanceof Uint32Array ? new Uint32Array(0) : new Float32Array(0) })
        geometry.setDrawRange(0, 0)
        upload.add(lines)
        this.roadBatches.push({ lines, ends: selected.ends, bounds: selected.bounds }); submitted += selected.count
      }
      // All attributes in this bounded source chunk upload in one empty render,
      // rather than clearing the framebuffer separately for every spatial leaf.
      if (upload.children.length) this.renderer.render(upload, this.camera)
      while (upload.children.length) this.scene.add(upload.children[0])
      // Keep cancellation and gestures responsive between bounded uploads.
      if (performance.now() - yielded >= 16) { await new Promise<void>(resolve => setTimeout(resolve, 0)); yielded = performance.now() }
      if (this.drawingDisposed || generation !== this.drawingGeneration) return false
    }
    this.renderer.domElement.dataset.decodedChunks = String(decodedChunks)
    textures.lookup = undefined
    this.renderer.domElement.dataset.eventTextureBytes = String(replayTextureBytes(textures))
    this.renderer.domElement.dataset.roadBatches = String(this.roadBatches.length)
    this.renderer.domElement.dataset.replayVertices = String(submitted)
    this.renderer.domElement.dataset.roadUploads = 'resident'
    this.renderer.domElement.dataset.roadCpuBytes = String(this.roadBatches.reduce((sum, batch) => sum + Object.values(batch.lines.geometry.attributes).reduce((bytes, attribute) => bytes + attribute.array.byteLength, 0), 0))
    return true
  }
  private cullRoadBatches() {
    // Orthographic map: exact axis-aligned view bounds avoid the loose circle
    // test for elongated road batches. One pixel of padding retains edge lines.
    const pixel = 2 * this.halfHeight / (this.camera.zoom * this.height)
    const left = this.camera.position.x + this.camera.left / this.camera.zoom - pixel
    const right = this.camera.position.x + this.camera.right / this.camera.zoom + pixel
    const bottom = this.camera.position.y + this.camera.bottom / this.camera.zoom - pixel
    const top = this.camera.position.y + this.camera.top / this.camera.zoom + pixel
    for (const batch of this.roadBatches) {
      const b = batch.bounds
      batch.lines.visible = b[0] <= right && b[2] >= left && b[1] <= top && b[3] >= bottom
    }
  }
  private clearRoadBatches() {
    for (const { lines } of this.roadBatches) { lines.geometry.dispose(); this.scene.remove(lines) }
    this.roadBatches = []
  }
  private loseDrawing = () => {
    const result = this.lastResult
    this.restoredProgress = this.replayProgress
    // Dispose while the context is lost, before Three replaces its resource
    // managers. Old geometry disposal listeners otherwise retain stale buffers.
    this.clearResult(); this.lastResult = result
    if (this.geography) { this.scene.remove(this.geography); disposeGeography(this.geography); this.geography = undefined }
    this.clearSelectionFill()
  }
  private restoreDrawing = () => {
    this.renderer.setClearColor('#080d10', 1); this.dirty = true
    const result = this.lastResult
    if (this.geographyContext) this.setGeography(this.geographyContext)
    if (!result || !this.storedDrawing.length) return
    this.clearResult()
    void this.prepareResult(result).then(restored => { if (restored && !this.drawingDisposed) { this.setResult(result); this.setProgress(this.restoredProgress); this.resize() } }).catch(() => this.onDrawingError?.('Road drawing could not be restored. Please reload the study.'))
  }
  clearResult() {
    ++this.drawingGeneration; this.lastResult = undefined; this.replayTextures = undefined
    this.drawing.chunks = []; this.clearRoadBatches()
    this.renderer.domElement.dataset.roadUploads = 'deferred'
    this.route?.geometry.dispose(); if (this.route) this.scene.remove(this.route); this.route = undefined
    this.flashPoint?.geometry.dispose(); if (this.flashPoint) this.scene.remove(this.flashPoint); this.flashPoint = undefined
    this.flash.clear(); this.meetingEvent = undefined; this.reveal.clear()
    this.texture.dispose(); this.backwardTexture.dispose(); this.proximityTexture.dispose(); this.sourceTexture.dispose()
    this.texture = new THREE.DataTexture(new Uint32Array(2), 1, 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.backwardTexture = new THREE.DataTexture(new Uint32Array(2), 1, 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.sourceTexture = new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.proximityTexture = new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.texture.needsUpdate = this.backwardTexture.needsUpdate = this.proximityTexture.needsUpdate = this.sourceTexture.needsUpdate = true
    this.material.uniforms.uTimes.value = this.texture; this.material.uniforms.uBackwardTimes.value = this.backwardTexture
    this.material.uniforms.uGoalProximity.value = this.proximityTexture
    this.material.uniforms.uSources.value = this.sourceTexture; this.material.uniforms.uTerritories.value = 0; this.material.uniforms.uTerritoryComplete.value = 0
    this.material.uniforms.uBidirectional.value = 0; this.material.uniforms.uAstar.value = 0; this.material.uniforms.uGreedy.value = 0; this.material.uniforms.uDepth.value = 0; this.material.uniforms.uBreadth.value = 0; this.material.uniforms.uTree.value = 0; this.material.uniforms.uTimeAstar.value = 0; this.routeMaterial.uniforms.uEmphasis.value = 1
    this.material.uniforms.uTextureSize.value.set(1, 1); this.material.uniforms.uEvent.value = 0
    this.focusEvents = undefined; this.focusCoordinates = undefined; this.focusPoint = undefined; this.tip.hidden = true; this.tip.dataset.event = '0'
    this.points = []; this.markers.replaceChildren(); this.dirty = true
    this.onRouteRevealChange?.(false)
  }
  setResult(result: SearchResult) {
    this.lastResult = result
    this.renderer.domElement.dataset.roadUploads = 'resident'
    for (const object of this.scene.children) if (object instanceof THREE.LineSegments && object.material === this.material) object.visible = true
    if (this.flashPoint) { this.scene.remove(this.flashPoint); this.flashPoint.geometry.dispose(); this.flashPoint = undefined }
    this.flash.clear(); this.meetingEvent = result.meeting?.event
    this.material.uniforms.uTree.value = result.tree ? 1 : 0
    const timeAstar = result.objective === 'time' && ['astar/1', 'bidirectional-astar/1'].includes(result.algorithm)
    this.material.uniforms.uTimeAstar.value = timeAstar ? 1 : 0
    this.tip.classList.toggle('time-astar-tip', timeAstar)
    this.routeMaterial.uniforms.uEmphasis.value = timeAstar ? 1.7 : 1
    const greedy = result.algorithm === 'greedy-best-first/1', depthFirst = result.algorithm === 'depth-first/1'
    this.material.uniforms.uBreadth.value = result.algorithm === 'bidirectional-breadth-first/1' ? 2 : result.algorithm === 'breadth-first/1' ? 1 : 0
    this.material.uniforms.uDepth.value = depthFirst ? 1 : 0
    this.tip.classList.toggle('depth-first-tip', depthFirst)
    this.focusEvents = result.focusEvents; this.focusCoordinates = result.focusCoordinates
    this.material.uniforms.uGreedy.value = greedy ? 1 : 0
    this.routeMaterial.uniforms.uColour.value.setRGB(...(greedy ? [1, .76, .60] as const : [.76, .98, .81] as const))
    this.routeMaterial.uniforms.uHeadColour.value.setRGB(...(greedy ? [1, .95, .83] as const : [1, 1, .88] as const))
    if (result.meeting) {
      const position = this.project(result.meeting)
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([position.x, position.y, 0], 3))
      this.flashPoint = new THREE.Points(geometry, this.flashMaterial)
      this.flashPoint.visible = false; this.flashPoint.frustumCulled = false; this.flashPoint.renderOrder = 2; this.scene.add(this.flashPoint)
    }
    if (this.route) { this.scene.remove(this.route); this.route.geometry.dispose(); this.route = undefined }
    if (result.routeEdges.length) {
      this.route = new THREE.Mesh(createRouteGeometry(this.drawing.build(result.routeEdges, result.routeReversed, result.routeLengths)), this.routeMaterial)
      this.route.frustumCulled = false; this.route.renderOrder = 1; this.route.visible = false; this.scene.add(this.route)
    }
    if (this.storedDrawing.length) this.drawing.chunks = []
    const textures = this.replayTextures ?? prepareReplayTextures(result, false)
    this.sourceTexture.dispose()
    this.sourceTexture = new THREE.DataTexture(textures.sources ?? new Uint8Array([0]), textures.sources ? textures.width : 1, textures.sources ? textures.height : 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.sourceTexture.needsUpdate = true
    this.material.uniforms.uSources.value = this.sourceTexture; this.material.uniforms.uTerritories.value = result.sources ? 1 : 0
    this.texture.dispose()
    this.texture = new THREE.DataTexture(textures.forward, textures.width, textures.height, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.texture.needsUpdate = true
    this.backwardTexture.dispose()
    this.backwardTexture = new THREE.DataTexture(textures.backward ?? new Uint32Array([0, 0]), textures.backward ? textures.width : 1, textures.backward ? textures.height : 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.backwardTexture.needsUpdate = true
    this.material.uniforms.uBackwardTimes.value = this.backwardTexture; this.material.uniforms.uBidirectional.value = result.backwardTimes ? 1 : 0
    this.proximityTexture.dispose()
    this.proximityTexture = new THREE.DataTexture(textures.proximity ?? new Uint8Array([0]), textures.proximity ? textures.width : 1, textures.proximity ? textures.height : 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.proximityTexture.needsUpdate = true
    this.material.uniforms.uGoalProximity.value = this.proximityTexture; this.material.uniforms.uAstar.value = result.goalProximity ? 1 : 0
    this.material.uniforms.uTimes.value = this.texture; this.material.uniforms.uTextureSize.value.set(textures.width, textures.height)
    this.events = traceLength(result); this.material.uniforms.uTotal.value = this.events
    this.points = result.sources ?? [result.start, result.goal]; this.markers.replaceChildren()
    this.markers.classList.toggle('bidirectional', !!result.backwardTimes)
    this.markers.classList.toggle('astar', !!result.goalProximity)
    this.markers.classList.toggle('territories', !!result.sources)
    this.markers.classList.toggle('greedy', greedy)
    for (const [i, point] of this.points.entries()) {
      const element = document.createElement('div'); element.className = `map-marker marker-${i}`
      const dot = document.createElement('span'); dot.className = 'marker-dot'
      const label = document.createElement('span'); label.textContent = point.name
      element.append(dot, label); this.markers.appendChild(element)
    }
    this.setProgress(0)
  }
  replayDuration = 30
  setProgress(progress: number, animate = false, duration = this.replayDuration) {
    this.replayProgress = progress
    this.replayDuration = duration
    const frame = replayFrame(progress, duration, !!this.route)
    progress = frame.search
    const next = Math.floor(progress * this.events)
    this.material.uniforms.uTerritoryComplete.value = this.material.uniforms.uTerritories.value && progress >= 1 ? 1 : 0
    this.flash.cross(this.material.uniforms.uEvent.value, next, this.meetingEvent, animate, this.reducedMotion.matches); this.updateFlash()
    this.material.uniforms.uEvent.value = next
    let vertices = 0
    for (const batch of this.roadBatches) { const count = replayVertexCount(batch.ends, next, this.events); batch.lines.geometry.setDrawRange(0, count); vertices += count }
    this.renderer.domElement.dataset.submittedVertices = String(vertices)
    this.focusPoint = undefined; this.tip.dataset.event = '0'; this.tip.hidden = true
    if (progress < 1 && this.focusEvents && this.focusCoordinates) {
      let low = 0, high = this.focusEvents.length
      while (low < high) { const middle = (low + high) >>> 1; if (this.focusEvents[middle] <= next) low = middle + 1; else high = middle }
      if (low > 0) {
        const i = low - 1; this.focusPoint = { name: '', lon: this.focusCoordinates[i * 2] / 100000, lat: this.focusCoordinates[i * 2 + 1] / 100000 }
        this.tip.dataset.event = String(this.focusEvents[i])
      }
    }
    if (frame.route === null || !this.route) this.reveal.clear()
    else if (this.reducedMotion.matches) this.reveal.finish()
    else this.reveal.seek(frame.route)
    this.onRouteRevealChange?.(this.reveal.active); this.updateRoute()
    return this.reveal.active
  }
  setRevealPlaying(playing: boolean) { this.revealPlaying = playing }
  updateFlash() {
    this.flashMaterial.uniforms.uAge.value = this.flash.progress
    if (this.flashPoint) this.flashPoint.visible = this.flash.active
    this.dirty = true
  }
  updateRoute() {
    const sample = this.reveal.sample()
    this.routeMaterial.uniforms.uProgress.value = sample.progress; this.routeMaterial.uniforms.uEnergy.value = sample.energy
    if (this.route) this.route.visible = this.reveal.visible
    this.dirty = true
  }
  motionChange = () => {
    if (this.reducedMotion.matches) {
      if (this.viewTransition) this.setView(this.viewTransition.to)
      this.flash.clear(); this.updateFlash()
    }
    if (this.reducedMotion.matches && this.reveal.active) {
      this.reveal.finish(); this.updateRoute(); this.onRouteRevealChange?.(false); this.onRouteRevealComplete?.()
    }
  }
  visibilityChange = () => { this.previousFrame = performance.now() }
  project(point: Pick<Point, 'lon' | 'lat'>) {
    if (!this.manifest) return new THREE.Vector3()
    const p = this.manifest.projection
    return new THREE.Vector3(longitudeOffset(point.lon, p.centre[0], p.longitudeWrapping === 'centre/1') * Math.cos(p.referenceLatitude * Math.PI / 180) * 111195.0802 / p.scaleMetres, (point.lat - p.centre[1]) * 111195.0802 / p.scaleMetres, 0)
  }
  placeMarkers() {
    if (this.focusPoint) {
      const point = this.project(this.focusPoint).project(this.camera)
      this.tip.style.left = `${(point.x + 1) * this.width / 2}px`; this.tip.style.top = `${(1 - point.y) * this.height / 2}px`
      this.tip.hidden = Math.abs(point.x) > 1 || Math.abs(point.y) > 1
    }
    for (let i = 0; i < this.points.length; i++) {
      const point = this.project(this.points[i]).project(this.camera), element = this.markers.children[i] as HTMLElement
      element.style.left = `${(point.x + 1) * this.width / 2}px`; element.style.top = `${(1 - point.y) * this.height / 2}px`
      element.hidden = Math.abs(point.x) > 1 || Math.abs(point.y) > 1
    }
  }
  resize() {
    this.width = Math.max(this.host.clientWidth, 1); this.height = Math.max(this.host.clientHeight, 1)
    this.renderer.setSize(this.width, this.height)
    this.material.uniforms.uCompact.value = this.width <= 600 ? 1 : 0
    this.routeMaterial.uniforms.uResolution.value.set(this.width, this.height)
    const half = this.halfHeight, aspect = this.width / this.height
    this.camera.left = -half * aspect; this.camera.right = half * aspect; this.camera.top = half; this.camera.bottom = -half
    this.camera.updateProjectionMatrix(); this.dirty = true
  }
  resetView() {
    this.cancelReframe()
    if (!this.manifest) return
    const [left, bottom, right, top] = this.manifest.bounds, aspect = this.width / this.height
    this.halfHeight = Math.max((top - bottom) / 2, (right - left) / (2 * aspect)) * 1.12
    this.camera.position.x = (right + left) / 2; this.camera.position.y = (top + bottom) / 2; this.camera.zoom = 1; this.resize()
    this.onViewChange?.(this.getView())
  }
  reframeJourney() {
    if (!this.manifest) return
    let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity
    for (const batch of this.roadBatches) {
      const b = batch.bounds
      left = Math.min(left, b[0]); bottom = Math.min(bottom, b[1])
      right = Math.max(right, b[2]); top = Math.max(top, b[3])
    }
    for (const point of this.points) {
      const p = this.project(point)
      left = Math.min(left, p.x); bottom = Math.min(bottom, p.y)
      right = Math.max(right, p.x); top = Math.max(top, p.y)
    }
    if (!Number.isFinite(left)) return
    const half = Math.max((top - bottom) / 2, (right - left) / (2 * this.width / this.height), this.halfHeight / 24) * 1.3
    const to = { x: (left + right) / 2, y: (bottom + top) / 2, zoom: this.halfHeight / half }
    if (this.reducedMotion.matches) { this.setView(to); return }
    this.viewTransition = { from: this.getView(), to, elapsed: 0 }
  }
  cancelReframe() { this.viewTransition = undefined }
  private advanceView(delta: number) {
    const transition = this.viewTransition
    if (!transition || document.hidden) return
    transition.elapsed += delta
    const t = Math.min(transition.elapsed / 1800, 1), eased = t * t * (3 - 2 * t)
    this.camera.position.x = transition.from.x + (transition.to.x - transition.from.x) * eased
    this.camera.position.y = transition.from.y + (transition.to.y - transition.from.y) * eased
    this.camera.zoom = Math.exp(Math.log(transition.from.zoom) + Math.log(transition.to.zoom / transition.from.zoom) * eased)
    this.camera.updateProjectionMatrix(); this.dirty = true
    if (t === 1) { this.cancelReframe(); this.onViewChange?.(this.getView()) }
  }
  getView() { return { x: this.camera.position.x, y: this.camera.position.y, zoom: this.camera.zoom } }
  setView(view: { x: number; y: number; zoom: number }) {
    this.cancelReframe()
    this.camera.position.x = view.x; this.camera.position.y = view.y; this.camera.zoom = view.zoom
    this.camera.updateProjectionMatrix(); this.dirty = true
    this.onViewChange?.(this.getView())
  }
  screenPoint(x: number, y: number) {
    const bounds = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector3((x - bounds.left) / this.width * 2 - 1, 1 - (y - bounds.top) / this.height * 2, 0).unproject(this.camera)
  }
  zoom(factor: number, x: number, y: number) {
    this.cancelReframe()
    const before = this.screenPoint(x, y)
    this.camera.zoom = Math.min(24, Math.max(.6, this.camera.zoom * factor)); this.camera.updateProjectionMatrix()
    const after = this.screenPoint(x, y)
    this.camera.position.x += before.x - after.x; this.camera.position.y += before.y - after.y; this.dirty = true
    this.onViewChange?.(this.getView())
  }
  wheel = (event: WheelEvent) => { event.preventDefault(); this.zoom(Math.exp(-event.deltaY * .001), event.clientX, event.clientY) }
  pointerDown = (event: PointerEvent) => { this.cancelReframe(); this.renderer.domElement.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (this.pointers.size === 1) this.moved = 0; if (this.pointers.size === 2) this.lastPinch = this.pinchDistance() }
  pinchDistance() { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
  pointerMove = (event: PointerEvent) => {
    const previous = this.pointers.get(event.pointerId); if (!previous) return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this.moved += Math.hypot(event.clientX - previous.x, event.clientY - previous.y)
    if (this.pointers.size === 2) {
      const distance = this.pinchDistance(), [a, b] = [...this.pointers.values()]
      if (this.lastPinch > 0) this.zoom(distance / this.lastPinch, (a.x + b.x) / 2, (a.y + b.y) / 2)
      this.lastPinch = distance
    } else {
      const before = this.screenPoint(previous.x, previous.y), after = this.screenPoint(event.clientX, event.clientY)
      this.camera.position.x += before.x - after.x; this.camera.position.y += before.y - after.y; this.dirty = true
      this.onViewChange?.(this.getView())
    }
  }
  pointerUp = (event: PointerEvent) => {
    if (this.picking && this.moved < 5 && this.pointers.size === 1 && this.manifest) {
      const point = this.screenPoint(event.clientX, event.clientY), p = this.manifest.projection
      this.onPick?.(normaliseLongitude(point.x * p.scaleMetres / (Math.cos(p.referenceLatitude * Math.PI / 180) * 111195.0802) + p.centre[0]), point.y * p.scaleMetres / 111195.0802 + p.centre[1])
    }
    this.pointerCancel(event)
  }
  pointerCancel = (event: PointerEvent) => { this.pointers.delete(event.pointerId); this.moved = 0; this.lastPinch = 0 }
  dispose() {
    this.clearRoadBatches()
    this.drawingDisposed = true; ++this.drawingGeneration; this.lastResult = undefined; this.replayTextures = undefined; this.storedDrawing = []
    this.renderer.domElement.removeEventListener('webglcontextlost', this.loseDrawing)
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.restoreDrawing)
    cancelAnimationFrame(this.frame); this.observer.disconnect()
    this.reducedMotion.removeEventListener('change', this.motionChange)
    document.removeEventListener('visibilitychange', this.visibilityChange)
    this.route?.geometry.dispose(); this.routeMaterial.dispose(); this.drawing.chunks = []
    this.flashPoint?.geometry.dispose(); this.flashMaterial.dispose(); this.backwardTexture.dispose()
    this.proximityTexture.dispose(); this.sourceTexture.dispose()
    if (this.geography) { this.scene.remove(this.geography); disposeGeography(this.geography) }
    this.clearSelectionFill(); this.geographyContext = undefined
    this.scene.traverse(object => { if (object instanceof THREE.LineSegments) object.geometry.dispose() })
    this.texture.dispose(); this.material.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.markers.remove(); this.tip.remove()
  }
}
