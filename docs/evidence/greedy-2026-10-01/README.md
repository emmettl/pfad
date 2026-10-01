# Greedy best-first review · 1 October 2026

[Swiss audit](review.json) pins source, graph, compiler and profile identity for
ten directed studies. Every settlement follows geographic proximity priority;
every examination is an actual outgoing arc. First-discovery, exact focus event
and coordinate, route adjacency, allowed-direction, cost-sum and deterministic
trace checks pass. Checksums retain trace and focus identities.

Greedy deliberately does not agree with Dijkstra on route cost. Zürich → Genève
is 335.3 km rather than the 262.7 km shortest-distance route; Genève → Zürich is
374.3 km. Across these ten examples greedy excess distance is approximately
6.5–59.2%. The UI labels the missing shortest-route guarantee, and exports record
`first-found`. Dijkstra's comparison run is separate audit evidence, not greedy
replay activity or part of its displayed computation time.

`npm run check` passes 97 tests. Fixtures cover a deliberately longer greedy
answer, an independent sorted-frontier reference, directed/disconnected graphs,
zero costs, first-discovery trees, exact events, reversible checkpoints,
longitude wrapping, focus coordinates and signed-coordinate exports. Browser
coverage includes desktop Chromium and mobile WebKit: coral/peach renderer,
recorded focus, paused replay, seek reversal, route reveal, reduced motion,
shared-link reload, ambient rotation and resetting the renderer on other modes.

Reproduce:

```sh
npm run check
npm run test:browser -- e2e/greedy.spec.ts e2e/astar.spec.ts e2e/bidirectional.spec.ts e2e/ambient.spec.ts e2e/territories.spec.ts
node scripts/data/audit-greedy.mjs .cache/greedy-review.json
```

Host timing and browser emulation do not establish physical-phone budgets or
driving legality. Greedy's distinct appearance depends on the actual journey;
no added lightning geometry, artificial search events or travelling connectors
are used.
