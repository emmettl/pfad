import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import assert from 'node:assert/strict'
import { readStudyGraph } from './read-study.mjs'
import { dijkstra, snapEndpoints } from '../../src/search/engine.ts'
import { bidirectional, compileReverse } from '../../src/search/bidirectional.ts'
import { astar } from '../../src/search/astar.ts'
import { JourneySelector, SELECTOR_VERSION, POOL_VERSION, replaySeconds } from '../../src/ambient/selector.ts'
import { UK_POOL } from '../../src/ambient/pools.ts'

const uk = process.argv.includes('--uk')
const { graph, manifest } = await readStudyGraph(uk ? '.cache/countries/uk-20260929-0555cf638ba1/manifest.json' : undefined), reverse = compileReverse(graph)
const seed = 20261001, selector = uk ? new JourneySelector(seed, UK_POOL.places) : new JourneySelector(seed), attempts = [], journeys = []
for (let journey = 0; journey < 60; journey++) {
  selector.beginJourney(); let accepted = false
  for (let attempt = 0; attempt < 5; attempt++) {
    const pair = selector.choose(); if (!pair) break
    const snapped = snapEndpoints(graph, pair.start, pair.goal)
    const run = journey % 3 === 0 ? dijkstra(graph, snapped.start, snapped.goal)
      : journey % 3 === 1 ? bidirectional(graph, reverse, snapped.start, snapped.goal) : astar(graph, reverse, snapped.start, snapped.goal)
    const selection = selector.record(pair, run.routeMetres === null ? null : run.routeMetres / 1000)
    for (let i = 0; i < run.routeEdges.length; i++) {
      const edge = run.routeEdges[i], reversed = run.routeReversed[i]
      assert.ok(reversed ? graph.direction[edge] !== 1 : graph.direction[edge] !== 2)
      assert.equal(run.routeNodes[i], reversed ? graph.to[edge] : graph.from[edge])
      assert.equal(run.routeNodes[i + 1], reversed ? graph.from[edge] : graph.to[edge])
    }
    if (run.routeMetres !== null) assert.equal([...run.routeLengths].reduce((sum, cm) => sum + cm, 0) / 100, run.routeMetres)
    const record = { journey, attempt, selection: selector.selections, ...selection, algorithm: run.algorithm, searchMs: run.searchMs, events: run.trace.length,
      replaySeconds: selection.accepted ? replaySeconds(selection.roadKm) : null }
    attempts.push(record)
    if (selection.accepted) { journeys.push(record); accepted = true; break }
  }
  assert.ok(accepted, `No accepted journey within five attempts at journey ${journey}`)
}
const summary = { accepted: journeys.length, attempts: attempts.length, rejected: attempts.length - journeys.length,
  bands: Object.fromEntries(['regional', 'interregional', 'national'].map(band => [band, journeys.filter(j => j.band === band).length])),
  places: [...new Set(journeys.flatMap(j => [j.start, j.goal]))].sort(),
  durationRange: [Math.min(...journeys.map(j => j.replaySeconds)), Math.max(...journeys.map(j => j.replaySeconds))] }
const report = { measuredAt: new Date().toISOString(), dataset: manifest.identity, compiler: manifest.compiler, profile: manifest.profile,
  sourceSha256: manifest.source.sha256, seed, selector: SELECTOR_VERSION, pool: uk ? UK_POOL.version : POOL_VERSION,
  note: 'Sixty real country journeys using all three production algorithms in rotation. Graph chunks verified before loading; chosen route adjacency, directions and exact cost sums checked. Actual distance determines acceptance and replay duration. This is a routing/selector audit, not physical-device, rendering, music or memory evidence.', summary, attempts }
const output = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? '.cache/ambient-audit.json'
await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(summary)); console.log(output)
