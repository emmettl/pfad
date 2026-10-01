import * as THREE from 'three'
import type { Point, SearchResult, StudyManifest } from '../search/contracts.ts'
import { RouteDrawing, RouteReveal } from './routeReveal.ts'
import { createRouteGeometry, createRouteMaterial } from './routeMaterial.ts'
import { createGeography, disposeGeography } from './geography.ts'
import { MeetingFlash, createMeetingMaterial } from './meetingFlash.ts'

const vertexShader = `
  in float roadId;
  uniform highp usampler2D uTimes;
  uniform highp usampler2D uBackwardTimes;
  uniform float uBidirectional;
  uniform sampler2D uGoalProximity;
  uniform float uAstar;
  uniform vec2 uTextureSize;
  flat out uvec2 vTimes;
  flat out uvec2 vBackwardTimes;
  out float vGoalProximity;
  void main() {
    vec2 uv = (vec2(mod(roadId, uTextureSize.x), floor(roadId / uTextureSize.x)) + .5) / uTextureSize;
    vTimes = texture(uTimes, uv).rg;
    vBackwardTimes = uBidirectional > .5 ? texture(uBackwardTimes, uv).rg : uvec2(0u);
    vGoalProximity = uAstar > .5 ? texture(uGoalProximity, uv).r : 0.;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0., 1.);
  }
`
const fragmentShader = `
  uniform highp uint uEvent;
  uniform float uTotal;
  uniform float uAstar;
  flat in uvec2 vTimes;
  flat in uvec2 vBackwardTimes;
  in float vGoalProximity;
  out vec4 outColor;
  vec4 front(uvec2 times, vec3 quiet, vec3 bright) {
    if (times.x == 0u || uEvent < times.x) return vec4(0.);
    float age = float(uEvent - times.x) / max(uTotal, 1.);
    float pulse = exp(-age / .006);
    uint improvement = times.y;
    float tree = improvement != 0u && uEvent >= improvement ? 1. : 0.;
    return vec4(mix(quiet, bright, pulse), mix(.12, .045, uAstar) + tree * mix(.07, .10, uAstar) + pulse * .72);
  }
  void main() {
    vec3 quiet = mix(vec3(.21, .48, .42), mix(vec3(.16, .35, .65), vec3(.30, .55, .60), vGoalProximity), uAstar);
    vec3 bright = mix(vec3(.52, .95, .78), mix(vec3(.42, .72, 1.), vec3(.78, .97, 1.), vGoalProximity), uAstar);
    vec4 a = front(vTimes, quiet, bright);
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
  proximityTexture: THREE.DataTexture
  manifest?: StudyManifest
  events = 1
  width = 1
  height = 1
  halfHeight = .8
  observer: ResizeObserver
  markers: HTMLDivElement
  points: Point[] = []
  picking = false
  onPick?: (lon: number, lat: number) => void
  onViewChange?: (view: { x: number; y: number; zoom: number }) => void
  pointers = new Map<number, { x: number; y: number }>()
  lastPinch = 0
  moved = 0
  frame = 0
  previousFrame = 0
  dirty = true
  renderInterval = 0
  lastRendered = -Infinity
  geography?: THREE.Group
  geographyVisible = true
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
    this.proximityTexture = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.proximityTexture.needsUpdate = true
    this.flashMaterial.uniforms.uPixelRatio.value = this.renderer.getPixelRatio()
    this.material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, glslVersion: THREE.GLSL3,
      uniforms: { uTimes: { value: this.texture }, uBackwardTimes: { value: this.backwardTexture }, uBidirectional: { value: 0 }, uGoalProximity: { value: this.proximityTexture }, uAstar: { value: 0 }, uTextureSize: { value: new THREE.Vector2(1, 1) }, uEvent: { value: 0 }, uTotal: { value: 1 } },
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    })
    host.appendChild(this.renderer.domElement)
    this.markers = document.createElement('div'); this.markers.className = 'map-markers'; host.appendChild(this.markers)
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host)
    const canvas = this.renderer.domElement
    canvas.addEventListener('wheel', this.wheel, { passive: false })
    canvas.addEventListener('pointerdown', this.pointerDown)
    canvas.addEventListener('pointermove', this.pointerMove)
    canvas.addEventListener('pointerup', this.pointerUp)
    canvas.addEventListener('pointercancel', this.pointerCancel)
    this.resize()
    this.previousFrame = performance.now()
    const draw = (now: number) => {
      if (this.flash.active && this.revealPlaying && !document.hidden) { this.flash.advance(Math.min(now - this.previousFrame, 100)); this.updateFlash() }
      if (this.reveal.active && this.revealPlaying && !document.hidden) {
        const finished = this.reveal.advance(Math.min(now - this.previousFrame, 100))
        this.updateRoute()
        if (finished) { this.onRouteRevealChange?.(false); this.onRouteRevealComplete?.() }
      }
      this.previousFrame = now
      if (this.dirty && now - this.lastRendered >= this.renderInterval - .5) {
        this.lastRendered = now
        this.renderer.render(this.scene, this.camera); this.placeMarkers()
        canvas.dataset.maxFps = this.renderInterval ? '30' : '60'
        canvas.dataset.event = String(this.material.uniforms.uEvent.value)
        canvas.dataset.routePhase = !this.reveal.visible ? 'hidden' : this.reveal.active ? 'revealing' : 'complete'
        canvas.dataset.routeProgress = String(this.routeMaterial.uniforms.uProgress.value)
        canvas.dataset.routeEnergy = String(this.routeMaterial.uniforms.uEnergy.value)
        canvas.dataset.outlines = this.geography?.visible ? 'visible' : 'hidden'
        canvas.dataset.meetingEvent = String(this.meetingEvent ?? 0)
        canvas.dataset.totalEvents = String(this.events)
        canvas.dataset.flashPhase = this.flash.active ? 'flashing' : 'hidden'
        canvas.dataset.flashProgress = String(this.flash.progress)
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
  setManifest(manifest: StudyManifest, outlines = manifest.id.startsWith('ch-')) {
    this.manifest = manifest
    const phoneNetwork = manifest.counts.nodes > 2000000 && window.matchMedia('(pointer: coarse)').matches
    this.renderInterval = phoneNetwork ? 1000 / 30 : 0
    this.renderer.setPixelRatio(phoneNetwork ? 1 : Math.min(window.devicePixelRatio, 1.5))
    this.flashMaterial.uniforms.uPixelRatio.value = this.renderer.getPixelRatio()
    if (this.geography) { this.scene.remove(this.geography); disposeGeography(this.geography) }
    this.geography = undefined
    if (outlines) {
      this.geography = createGeography(point => this.project(point)); this.geography.visible = this.geographyVisible
      this.scene.add(this.geography)
    }
    this.resetView()
  }
  setGeographyVisible(visible: boolean) {
    this.geographyVisible = visible
    if (this.geography) this.geography.visible = visible
    this.dirty = true
  }
  addGeometry(bytes: ArrayBuffer, count: number) {
    const positions = new Float32Array(bytes, 0, count * 2), roads = new Float32Array(bytes, count * 8, count)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 2))
    geometry.setAttribute('roadId', new THREE.BufferAttribute(roads, 1))
    // Drawing coordinates are deliberately two-dimensional and within [-1, 1].
    // Three's automatic sphere calculation assumes a three-component position.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.SQRT2)
    const lines = new THREE.LineSegments(geometry, this.material); lines.frustumCulled = false
    this.drawing.add(positions, roads)
    this.scene.add(lines); this.dirty = true
  }
  clearResult() {
    this.route?.geometry.dispose(); if (this.route) this.scene.remove(this.route); this.route = undefined
    this.flashPoint?.geometry.dispose(); if (this.flashPoint) this.scene.remove(this.flashPoint); this.flashPoint = undefined
    this.flash.clear(); this.meetingEvent = undefined; this.reveal.clear()
    this.texture.dispose(); this.backwardTexture.dispose(); this.proximityTexture.dispose()
    this.texture = new THREE.DataTexture(new Uint32Array(2), 1, 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.backwardTexture = new THREE.DataTexture(new Uint32Array(2), 1, 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.proximityTexture = new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.texture.needsUpdate = this.backwardTexture.needsUpdate = this.proximityTexture.needsUpdate = true
    this.material.uniforms.uTimes.value = this.texture; this.material.uniforms.uBackwardTimes.value = this.backwardTexture
    this.material.uniforms.uGoalProximity.value = this.proximityTexture
    this.material.uniforms.uBidirectional.value = 0; this.material.uniforms.uAstar.value = 0
    this.material.uniforms.uTextureSize.value.set(1, 1); this.material.uniforms.uEvent.value = 0
    this.points = []; this.markers.replaceChildren(); this.dirty = true
    this.onRouteRevealChange?.(false)
  }
  setResult(result: SearchResult) {
    if (this.flashPoint) { this.scene.remove(this.flashPoint); this.flashPoint.geometry.dispose(); this.flashPoint = undefined }
    this.flash.clear(); this.meetingEvent = result.meeting?.event
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
    this.texture.dispose()
    this.texture = new THREE.DataTexture(result.edgeTimes, result.textureWidth, result.textureHeight, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.texture.needsUpdate = true
    this.backwardTexture.dispose()
    this.backwardTexture = new THREE.DataTexture(result.backwardTimes ?? new Uint32Array([0, 0]), result.backwardTimes ? result.textureWidth : 1, result.backwardTimes ? result.textureHeight : 1, THREE.RGIntegerFormat, THREE.UnsignedIntType)
    this.backwardTexture.needsUpdate = true
    this.material.uniforms.uBackwardTimes.value = this.backwardTexture; this.material.uniforms.uBidirectional.value = result.backwardTimes ? 1 : 0
    this.proximityTexture.dispose()
    this.proximityTexture = new THREE.DataTexture(result.goalProximity ?? new Uint8Array([0]), result.goalProximity ? result.textureWidth : 1, result.goalProximity ? result.textureHeight : 1, THREE.RedFormat, THREE.UnsignedByteType)
    this.proximityTexture.needsUpdate = true
    this.material.uniforms.uGoalProximity.value = this.proximityTexture; this.material.uniforms.uAstar.value = result.goalProximity ? 1 : 0
    this.material.uniforms.uTimes.value = this.texture; this.material.uniforms.uTextureSize.value.set(result.textureWidth, result.textureHeight)
    this.events = result.trace.length; this.material.uniforms.uTotal.value = this.events
    this.points = [result.start, result.goal]; this.markers.replaceChildren()
    this.markers.classList.toggle('bidirectional', !!result.backwardTimes)
    this.markers.classList.toggle('astar', !!result.goalProximity)
    for (const [i, point] of this.points.entries()) {
      const element = document.createElement('div'); element.className = `map-marker marker-${i}`
      const dot = document.createElement('span'); dot.className = 'marker-dot'
      const label = document.createElement('span'); label.textContent = point.name
      element.append(dot, label); this.markers.appendChild(element)
    }
    this.setProgress(0)
  }
  setProgress(progress: number, animate = false) {
    const next = Math.floor(progress * this.events)
    this.flash.cross(this.material.uniforms.uEvent.value, next, this.meetingEvent, animate, this.reducedMotion.matches); this.updateFlash()
    this.material.uniforms.uEvent.value = next
    if (progress < 1 || !this.route) this.reveal.clear()
    else if (animate && !this.reducedMotion.matches) this.reveal.start()
    else this.reveal.finish()
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
    if (this.reducedMotion.matches) { this.flash.clear(); this.updateFlash() }
    if (this.reducedMotion.matches && this.reveal.active) {
      this.reveal.finish(); this.updateRoute(); this.onRouteRevealChange?.(false); this.onRouteRevealComplete?.()
    }
  }
  visibilityChange = () => { this.previousFrame = performance.now() }
  project(point: Pick<Point, 'lon' | 'lat'>) {
    if (!this.manifest) return new THREE.Vector3()
    const p = this.manifest.projection
    return new THREE.Vector3((point.lon - p.centre[0]) * Math.cos(p.referenceLatitude * Math.PI / 180) * 111195.0802 / p.scaleMetres, (point.lat - p.centre[1]) * 111195.0802 / p.scaleMetres, 0)
  }
  placeMarkers() {
    for (let i = 0; i < this.points.length; i++) {
      const point = this.project(this.points[i]).project(this.camera), element = this.markers.children[i] as HTMLElement
      element.style.left = `${(point.x + 1) * this.width / 2}px`; element.style.top = `${(1 - point.y) * this.height / 2}px`
      element.hidden = Math.abs(point.x) > 1 || Math.abs(point.y) > 1
    }
  }
  resize() {
    this.width = Math.max(this.host.clientWidth, 1); this.height = Math.max(this.host.clientHeight, 1)
    this.renderer.setSize(this.width, this.height)
    this.routeMaterial.uniforms.uResolution.value.set(this.width, this.height)
    const half = this.halfHeight, aspect = this.width / this.height
    this.camera.left = -half * aspect; this.camera.right = half * aspect; this.camera.top = half; this.camera.bottom = -half
    this.camera.updateProjectionMatrix(); this.dirty = true
  }
  resetView() {
    if (!this.manifest) return
    const [left, bottom, right, top] = this.manifest.bounds, aspect = this.width / this.height
    this.halfHeight = Math.max((top - bottom) / 2, (right - left) / (2 * aspect)) * 1.12
    this.camera.position.x = (right + left) / 2; this.camera.position.y = (top + bottom) / 2; this.camera.zoom = 1; this.resize()
    this.onViewChange?.(this.getView())
  }
  getView() { return { x: this.camera.position.x, y: this.camera.position.y, zoom: this.camera.zoom } }
  setView(view: { x: number; y: number; zoom: number }) {
    this.camera.position.x = view.x; this.camera.position.y = view.y; this.camera.zoom = view.zoom
    this.camera.updateProjectionMatrix(); this.dirty = true
    this.onViewChange?.(this.getView())
  }
  screenPoint(x: number, y: number) {
    const bounds = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector3((x - bounds.left) / this.width * 2 - 1, 1 - (y - bounds.top) / this.height * 2, 0).unproject(this.camera)
  }
  zoom(factor: number, x: number, y: number) {
    const before = this.screenPoint(x, y)
    this.camera.zoom = Math.min(24, Math.max(.6, this.camera.zoom * factor)); this.camera.updateProjectionMatrix()
    const after = this.screenPoint(x, y)
    this.camera.position.x += before.x - after.x; this.camera.position.y += before.y - after.y; this.dirty = true
    this.onViewChange?.(this.getView())
  }
  wheel = (event: WheelEvent) => { event.preventDefault(); this.zoom(Math.exp(-event.deltaY * .001), event.clientX, event.clientY) }
  pointerDown = (event: PointerEvent) => { this.renderer.domElement.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (this.pointers.size === 1) this.moved = 0; if (this.pointers.size === 2) this.lastPinch = this.pinchDistance() }
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
      this.onPick?.(point.x * p.scaleMetres / (Math.cos(p.referenceLatitude * Math.PI / 180) * 111195.0802) + p.centre[0], point.y * p.scaleMetres / 111195.0802 + p.centre[1])
    }
    this.pointerCancel(event)
  }
  pointerCancel = (event: PointerEvent) => { this.pointers.delete(event.pointerId); this.moved = 0; this.lastPinch = 0 }
  dispose() {
    cancelAnimationFrame(this.frame); this.observer.disconnect()
    this.reducedMotion.removeEventListener('change', this.motionChange)
    document.removeEventListener('visibilitychange', this.visibilityChange)
    this.route?.geometry.dispose(); this.routeMaterial.dispose(); this.drawing.chunks = []
    this.flashPoint?.geometry.dispose(); this.flashMaterial.dispose(); this.backwardTexture.dispose()
    this.proximityTexture.dispose()
    if (this.geography) { this.scene.remove(this.geography); disposeGeography(this.geography) }
    this.scene.traverse(object => { if (object instanceof THREE.LineSegments) object.geometry.dispose() })
    this.texture.dispose(); this.material.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.markers.remove()
  }
}
