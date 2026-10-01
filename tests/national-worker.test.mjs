import { test, expect, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { COUNTRIES } from '../src/countries.ts'

test('the production worker opens the pinned Swiss graph and routes both directions in all three algorithms', async () => {
  // Run the actual worker entry point with local, immutable bytes. Only its
  // transport is replaced; decoding, snapping, searches and recordings are real.
  const root = resolve('public'), country = COUNTRIES[0]
  let receive, reply, vertices = 0
  vi.stubGlobal('self', {
    addEventListener(type, handler) { expect(type).toBe('message'); receive = handler },
    postMessage(message) { if (message.type === 'geometry') vertices += message.count; else reply = message },
  })
  vi.stubGlobal('fetch', async url => {
    const path = resolve(root, '.' + new URL(url).pathname)
    if (!path.startsWith(root + sep)) throw new Error('Test request escaped public data')
    return new Response(await readFile(path))
  })
  await import('../src/search/search.worker.ts')
  const send = async data => { await receive({ data }); expect(reply.type, reply.message).not.toBe('error'); return reply }
  const loaded = await send({ type: 'load', manifestUrl: new URL(country.manifest, 'https://pfad.test/').href, expectedIdentity: country.identity })
  expect(loaded.type).toBe('ready')
  const manifest = JSON.parse(await readFile(resolve(root, country.manifest), 'utf8'))
  expect(vertices).toBe(manifest.counts.vertices)
  const start = country.places.find(p => p.name === 'Zürich'), goal = country.places.find(p => p.name === 'Genève')
  let dijkstraNodes, startNode, goalNode
  for (const [algorithm, settlements, events] of [
    ['dijkstra', 805590, 3352313],
    ['bidirectional', 1044442, 4347569],
    ['astar', 473066, 1978942],
  ]) {
    const { result: forward } = await send({ type: 'search', requestId: 1, start, goal, algorithm })
    expect(forward.routeMetres).toBe(262733.98)
    expect(forward.dataset.identity).toBe(country.identity)
    expect(forward.routeLengths.reduce((sum, value) => sum + value, 0) / 100).toBe(forward.routeMetres)
    if (algorithm === 'dijkstra') {
      expect(forward.trace.length).toBe(4993816)
      dijkstraNodes = forward.exploredNodes; startNode = forward.start.node; goalNode = forward.goal.node
    }
    if (algorithm === 'astar') expect(forward.exploredNodes).toBeLessThan(dijkstraNodes)
    const { result: reverse } = await send({ type: 'search', requestId: 2, start: goal, goal: start, algorithm })
    // The graph is directed: the reverse journey has a slightly different cost.
    expect(reverse.routeMetres).toBe(262724.45)
    expect(reverse.start.node).toBe(goalNode); expect(reverse.goal.node).toBe(startNode)
    expect(reverse.exploredNodes).toBe(settlements); expect(reverse.trace.length).toBe(events)
  }
})
