# Bidirectional A* review · 1 October 2026

[National comparisons](review.json) pin the Swiss source, graph, compiler and
profile. All four algorithms agree on ten directed journey costs. Every chosen
route edge passes adjacency, allowed-direction and exact cost-sum checks;
144 curated endpoint pairs retain directed reachability and reversal-stable snaps.

Bidirectional A* examines 40–81% fewer arcs than bidirectional Dijkstra on these
journeys. Heuristic preparation is separate: 83–118 ms in this host run, followed
by 8–150 ms for the query. These are observations, not device guarantees.

Validation: `npm run check` (81 tests), six algorithm browser checks and eight
ambient browser checks across desktop Chromium and mobile WebKit. Coverage
includes real two-front replay, first-connection light, pause/seek, reduced
motion, shared-link loading and four-algorithm ambient rotation. Physical-phone
memory and driving-legality validation remain open.

[Four-algorithm ambient audit](ambient-audit.json) accepts 60 Swiss journeys in
64 attempts across all twelve places: 8 regional, 27 interregional and 25
national. All route adjacency, direction and exact cost-sum checks pass.

Reproduce national comparisons:

```sh
node scripts/data/audit-endpoints.mjs .cache/bidirectional-astar-review.json
```
