import { mkdir, writeFile } from 'node:fs/promises'

// Original PFAD sketches. Times become sixteenths in a 60 bpm rack document.
const seconds = 120
const titles = ['Plateau', 'Contours', 'Afterglow']
const ids = ['plateau', 'contours', 'afterglow']
const notes = [40, 47, 50, 52, 54, 55, 57, 59, 62]
const chords = [[40, 47, 54, 55, 62], [40, 50, 54, 57, 62], [40, 47, 52, 55, 59], [40, 47, 54, 57, 62]]
const smooth = x => Math.sin(Math.PI / 2 * Math.max(0, Math.min(1, x))) ** 2

function voice(patch, id, midi, { cutoff = 1400, pan = 0, shape = 2, decay = .88, wet = .42 } = {}) {
  const pitch = Math.min(2, (midi - 36) / 12)
  patch.modules.push(
    { id: `${id}-pitch`, type: 'offset', params: { offset: pitch } },
    { id: `${id}-osc`, type: 'vco', params: { tune: midi - 36 - pitch * 12, shape } },
    { id: `${id}-filter`, type: 'svf', params: { cutoff, resonance: .08 } },
    { id: `${id}-amp`, type: 'vca', params: { gain: 0 } },
    { id: `${id}-space`, type: 'reverb', params: { size: .9, decay, damp: .65, mix: wet, algorithm: 1, lowCut: 100, highCut: 6500 } },
    { id: `${id}-out`, type: 'out', params: { level: .7, pan } },
  )
  for (const [from, out, to, input] of [
    ['pitch', 'out', 'osc', 'pitch'], ['osc', 'out', 'filter', 'in'],
    ['filter', 'lp', 'amp', 'in'], ['amp', 'out', 'space', 'in'], ['space', 'out', 'out', 'in'],
  ]) patch.cables.push({ from: [`${id}-${from}`, out], to: [`${id}-${to}`, input] })
}

function lane(patch, target, fn, interval = .25) {
  const points = []
  for (let t = 0; t <= seconds; t += interval) points.push({ at: t * 4, value: Number(fn(t).toFixed(7)) })
  patch.automation.push({ target, curve: 'linear', points })
}

await mkdir('music/patches', { recursive: true })
for (let kind = 0; kind < 3; kind++) {
  const patch = { tempo: 60, modules: [], cables: [], automation: [] }
  const bedNotes = kind === 1 ? [40, 47, 54] : notes
  bedNotes.forEach((note, i) => {
    const id = `bed-${note}`
    voice(patch, id, note, { cutoff: kind === 2 ? 600 : 1550, pan: (i % 3 - 1) * .32, wet: kind === 2 ? .6 : .42 })
    lane(patch, [id + '-amp', 'gain'], t => {
      let level = 0
      chords.forEach((chord, c) => {
        if (!chord.includes(note)) return
        const start = c * 25
        const shape = smooth((t - start) / 12) * (1 - smooth((t - start - 20) / 14))
        level += shape * (kind === 1 ? .021 : kind === 2 ? .026 : .039)
      })
      return level * (.85 + .15 * Math.sin(t * .09 + i))
    })
    lane(patch, [id + '-filter', 'cutoff'], t => (kind === 2 ? 440 : 1150) + (kind === 2 ? 260 : 650) * smooth(.5 + .5 * Math.sin(t * .041 + i)))
  })
  if (kind === 1) {
    ;[64, 66, 71, 74].forEach((note, i) => {
      const id = `upper-${note}`
      voice(patch, id, note, { cutoff: 4400, pan: (i % 2 ? 1 : -1) * .4, decay: .92, wet: .6 })
      const starts = [8 + i * 7, 48 + ((i + 2) % 4) * 7, 83 + i * 5]
      lane(patch, [id + '-amp', 'gain'], t => starts.reduce((sum, at) => {
        const age = t - at
        return sum + (age < 0 || age > 13 ? 0 : .058 * smooth(age / .16) * Math.exp(-age / 3.5) * (1 - smooth((age - 10) / 3)))
      }, 0), .05)
    })
  }
  await writeFile(`music/patches/${ids[kind]}.json`, JSON.stringify(patch) + '\n')
  console.log(`Composed ${titles[kind]}: ${patch.modules.length} modules, ${patch.automation.length} recorded lanes`)
}
