export type MusicState = 'off' | 'loading' | 'on' | 'paused' | 'error'
export interface MusicTrack { id: string; title: string; url: string; seconds: number; bytes: number; sha256: string }
export interface MusicStatus { state: MusicState; title: string }
interface Voice { index: number; source: AudioBufferSourceNode; gain: GainNode; start: number; end: number }

const SAMPLE_RATE = 32000
const MAX_DECODED_BYTES = 64 * 1024 * 1024
const FADE = 1

/** One owner for a continuous score, independent of the map and its replay clock. */
export class Soundtrack {
  private context?: AudioContext
  private master?: GainNode
  private voices: Voice[] = []
  private loading?: { controller: AbortController; promise: Promise<AudioBuffer> }
  private ticker?: ReturnType<typeof setInterval>
  private suspension?: ReturnType<typeof setTimeout>
  private intent = 0
  private disposed = false
  private preparing = false
  private volume = .5
  private status: MusicStatus = { state: 'off', title: '' }
  private tracks: MusicTrack[]
  private changed: (status: MusicStatus) => void

  constructor(tracks: MusicTrack[], changed: (status: MusicStatus) => void) {
    this.tracks = tracks; this.changed = changed
  }
  get state() { return this.status.state }
  private publish(state: MusicState, title = this.status.title) {
    this.status = { state, title }; if (!this.disposed) this.changed(this.status)
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value))
    if (!this.context || !this.master || this.state !== 'on') return
    const now = this.context.currentTime, gain = this.master.gain
    gain.cancelAndHoldAtTime(now)
    if (this.volume === 0) gain.setValueAtTime(0, now)
    else gain.linearRampToValueAtTime(this.volume, now + .12)
  }

  async start() {
    if (this.disposed || this.state === 'loading' || this.state === 'on') return
    const intent = ++this.intent
    clearTimeout(this.suspension); this.publish('loading')
    try {
      if (!this.context) {
        this.context = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'playback' })
        this.master = this.context.createGain(); this.master.gain.value = 0
        this.master.connect(this.context.destination)
        this.context.onstatechange = () => {
          if (this.state === 'on' && this.context?.state !== 'running') this.stop(true)
        }
      }
      const context = this.context
      // Resume synchronously in the click handler, before any download or decode.
      const resumed = context.resume()
      const initial = async () => {
        if (this.voices.length) return undefined
        // Serialize decodes even when a previous start was cancelled.
        if (this.loading) await this.loading.promise.catch(() => {})
        if (this.disposed || intent !== this.intent) return undefined
        return this.load(0)
      }
      const [, buffer] = await Promise.all([resumed, initial()])
      if (this.disposed || intent !== this.intent) return
      if (context.state !== 'running') throw new Error('Audio unavailable')
      if (buffer) this.schedule(0, buffer, context.currentTime + .03, true)
      const now = context.currentTime, gain = this.master!.gain
      gain.cancelAndHoldAtTime(now); gain.linearRampToValueAtTime(this.volume, now + FADE)
      this.publish('on'); this.tick()
      this.ticker = setInterval(() => this.tick(), 250)
    } catch {
      if (!this.disposed && intent === this.intent) { this.stop(true); this.publish('error') }
    }
  }

  private async load(index: number) {
    if (this.loading) return this.loading.promise
    const track = this.tracks[index], controller = new AbortController()
    const promise = (async () => {
      const response = await fetch(track.url, { signal: controller.signal })
      if (!response.ok) throw new Error('Music could not be downloaded')
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength !== track.bytes || bytes.byteLength > 2 * 1024 * 1024) throw new Error('Unexpected music file')
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      if (hash !== track.sha256) throw new Error('Music integrity mismatch')
      const buffer = await this.context!.decodeAudioData(bytes)
      if (controller.signal.aborted || this.disposed) throw new DOMException('Cancelled', 'AbortError')
      if (buffer.numberOfChannels !== 2 || Math.abs(buffer.duration - track.seconds) > .15) throw new Error('Unexpected music duration')
      const retained = this.voices.reduce((sum, voice) => sum + (voice.source.buffer?.length ?? 0) * 8, 0)
      if (buffer.length * 8 + retained > MAX_DECODED_BYTES) throw new Error('Music memory budget exceeded')
      return buffer
    })()
    const loading = { controller, promise }; this.loading = loading
    try { return await promise }
    finally { if (this.loading === loading) this.loading = undefined }
  }

  private schedule(index: number, buffer: AudioBuffer, start: number, first = false) {
    const context = this.context!, source = context.createBufferSource(), gain = context.createGain()
    const overlap = Math.min(8, buffer.duration / 4), end = start + buffer.duration
    source.buffer = buffer; source.connect(gain); gain.connect(this.master!)
    gain.gain.setValueAtTime(first ? 1 : 0, start)
    if (!first) gain.gain.linearRampToValueAtTime(1, start + overlap)
    gain.gain.setValueAtTime(1, end - overlap); gain.gain.linearRampToValueAtTime(0, end)
    const voice = { index, source, gain, start, end }; this.voices.push(voice)
    source.onended = () => {
      source.onended = null; source.disconnect(); gain.disconnect()
      this.voices = this.voices.filter(item => item !== voice)
      if (this.state === 'on') this.tick()
    }
    source.start(start); source.stop(end)
  }

  private tick() {
    if (this.state !== 'on' || this.disposed || !this.context) return
    const now = this.context.currentTime
    const audible = this.voices.filter(voice => voice.start <= now).at(-1)
    if (audible && this.status.title !== this.tracks[audible.index].title) this.publish('on', this.tracks[audible.index].title)
    if (this.voices.length >= 2 || this.preparing) return
    const last = this.voices.at(-1)
    if (!last) { this.stop(true); this.publish('error'); return }
    const intent = this.intent, index = (last.index + 1) % this.tracks.length
    this.preparing = true
    void this.load(index).then(buffer => {
      if (intent !== this.intent || this.disposed || this.state !== 'on') return
      this.schedule(index, buffer, Math.max(last.end - Math.min(8, buffer.duration / 4), this.context!.currentTime + .03))
    }).catch(() => {
      if (intent === this.intent && !this.disposed) { this.stop(true); this.publish('error') }
    }).finally(() => {
      this.preparing = false
      // A new start may have arrived while an obsolete decode was finishing.
      if (this.state === 'on' && intent !== this.intent) this.tick()
    })
  }

  pauseSequence() {
    if (this.state !== 'on' && this.state !== 'loading') return
    this.stop(); this.publish('paused')
  }
  resumeSequence() { if (this.state === 'paused') void this.start() }

  stop(immediate = false) {
    ++this.intent; clearInterval(this.ticker); clearTimeout(this.suspension)
    this.loading?.controller.abort(); this.publish('off')
    const context = this.context, gain = this.master?.gain
    if (!context || !gain || context.state === 'closed') return
    const now = context.currentTime
    gain.cancelAndHoldAtTime(now)
    if (immediate) { gain.setValueAtTime(0, now); void context.suspend().catch(() => {}) }
    else {
      gain.linearRampToValueAtTime(0, now + FADE)
      const intent = this.intent
      this.suspension = setTimeout(() => { if (intent === this.intent) void context.suspend().catch(() => {}) }, (FADE + .05) * 1000)
    }
  }

  dispose() {
    this.disposed = true; this.stop(true)
    for (const voice of this.voices) { voice.source.onended = null; voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect() }
    this.voices = []; this.master?.disconnect()
    if (this.context) { this.context.onstatechange = null; void this.context.close().catch(() => {}) }
  }
}
