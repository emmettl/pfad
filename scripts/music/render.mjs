import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { RackRenderer, MODULES, valueAt } from '@driftbox/rack'

const sampleRate = 32000, duration = 120
const cache = '.cache/music', destination = 'src/audio'
await mkdir(cache, { recursive: true }); await mkdir(destination, { recursive: true })
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const manifest = {
  version: 1, score: 'pfad-driftbox-sketches-v1', provisional: true,
  credit: 'Original provisional music for PFAD · Composed using Driftbox',
  render: { sampleRate, duration, frames: 128, targetRms: .04, automation: 'public valueAt at each render block; linear lanes; no external samples', encoding: 'AAC-LC 96 kbit/s; afconvert on macOS or ffmpeg elsewhere; encoded output may vary by encoder' },
  packages: Object.fromEntries(['@driftbox/rack', '@driftbox/engine'].map(name => [name, { version: lock.packages[`node_modules/${name}`].version, integrity: lock.packages[`node_modules/${name}`].integrity }])),
  tracks: [],
}

for (const [id, title] of [['plateau', 'Plateau'], ['contours', 'Contours'], ['afterglow', 'Afterglow']]) {
  const document = await readFile(`music/patches/${id}.json`)
  const patch = JSON.parse(document)
  const renderer = new RackRenderer(MODULES, { sampleRate, frames: 128 })
  renderer.patch = patch
  if (renderer.notes.length) throw new Error(JSON.stringify(renderer.notes))
  renderer.setTransport(patch.tempo, true)
  const started = performance.now()
  const audio = renderer.render(duration, () => {
    for (const lane of patch.automation) renderer.setParam(...lane.target, valueAt(lane, renderer.beat * 4))
  })
  // A final mastering ramp leaves the last eight seconds available for quiet tails.
  let peak = 0, energy = 0, maxStep = 0, stereoDifference = 0
  for (let c = 0; c < 2; c++) {
    const channel = audio.channels[c]
    for (let i = 0; i < channel.length; i++) {
      const t = i / sampleRate
      channel[i] *= Math.min(1, t / 2, (duration - t) / 4)
      if (!Number.isFinite(channel[i])) throw new Error('Non-finite audio')
      peak = Math.max(peak, Math.abs(channel[i])); energy += channel[i] ** 2
      if (i) maxStep = Math.max(maxStep, Math.abs(channel[i] - channel[i - 1]))
      if (c === 1) stereoDifference += (channel[i] - audio.channels[0][i]) ** 2
    }
  }
  const normalisation = Math.min(.04 / Math.sqrt(energy / (audio.length * 2)), .5 / peak)
  for (const channel of audio.channels) for (let i = 0; i < channel.length; i++) channel[i] *= normalisation
  peak *= normalisation; energy *= normalisation ** 2; maxStep *= normalisation; stereoDifference *= normalisation ** 2
  if (peak > .6 || peak < .02) throw new Error(`Unexpected level: ${peak}`)
  const header = Buffer.alloc(44)
  const bytes = audio.length * 4
  header.write('RIFF'); header.writeUInt32LE(36 + bytes, 4); header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22)
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 4, 28)
  header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(bytes, 40)
  const pcm = Buffer.alloc(bytes)
  for (let i = 0; i < audio.length; i++) for (let c = 0; c < 2; c++) pcm.writeInt16LE(Math.round(audio.channels[c][i] * 32767), i * 4 + c * 2)
  const master = Buffer.concat([header, pcm])
  const wav = `${cache}/${id}.wav`, encoded = `${destination}/${id}.m4a`
  await writeFile(wav, master)
  if (process.platform === 'darwin') execFileSync('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac ', '-b', '96000', '-q', '127', wav, encoded])
  else execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '96k', encoded])
  const delivery = await readFile(encoded)
  manifest.tracks.push({ id, title, seconds: duration, bytes: delivery.length, sha256: sha256(delivery), patchSha256: sha256(document), masterSha256: sha256(master), peak, rms: Math.sqrt(energy / (audio.length * 2)), maxStep, stereoRms: Math.sqrt(stereoDifference / audio.length), moduleVersions: Object.fromEntries([...new Set(patch.modules.map(module => module.type))].map(type => [type, MODULES[type].version])) })
  console.log(`${title}: ${delivery.length} bytes; peak ${peak.toFixed(3)}, RMS ${Math.sqrt(energy / (audio.length * 2)).toFixed(3)}; render ${(performance.now() - started).toFixed(0)} ms`)
}
manifest.totalBytes = manifest.tracks.reduce((sum, track) => sum + track.bytes, 0)
await writeFile('music/manifest.json', JSON.stringify(manifest, null, 2) + '\n')
