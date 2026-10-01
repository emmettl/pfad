# Three-source territory review · 1 October 2026

[National audit](review.json) records six seeded Swiss source triples with pinned
source, graph, compiler and profile identity. For each study, all 1,224,041 reached
nodes have a nearest-source assignment checked against three separate complete
single-source distance runs. Every recorded arc and first road colour is checked
against its settled source. Each source owns nodes; no final-route or meeting
animation is present. Exact traces have SHA-256 checksums.

`npm run check` passes 90 tests. Unit validation covers directed, disconnected and zero-cost fixtures, exact
checkpoints, reproducible ties, shared-component snapping, every country's
triple selector, the ambient insertion/hold cycle, three-source links and exports.
Browser checks cover desktop Chromium and mobile WebKit: three colours/markers,
completed and intermediate replay, seek reversal, reduced motion, quiet ambient
controls, source-preserving shared reload and return to two-point journey controls.

Reproduce:

```sh
npm run check
npm run test:browser -- e2e/territories.spec.ts e2e/ambient.spec.ts
node scripts/data/audit-territories.mjs .cache/territory-audit.json
```

A complete reachable field may inspect more roads than a single journey.
This host evidence does not establish physical-phone memory or driving legality.
