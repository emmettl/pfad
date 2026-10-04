# ALT manual trial

ALT combines A*, landmarks and the triangle inequality. Four fixed reference
nodes supply exact directed road-distance lower bounds. They are not waypoints:
the route does not have to visit them. The trial is available only for Swiss
manual distance searches on the connectivity graph, outside ambient mode.

## Recording and correctness

Selection starts at the highest total-degree node (lowest node ID breaks ties).
Each subsequent landmark maximises its minimum squared geographic-coordinate
separation from previous landmarks among nodes mutually reachable with the seed.
Lowest node ID breaks ties. The selection version is
`max-degree-seed-geographic-farthest-strong-component/1`.

Eight Dijkstra sweeps store distances from and to the four landmarks. For each
query node u and target t, finite table entries provide the bounds
`d(L,t) - d(L,u)` and `d(u,L) - d(t,L)`. Their maximum with the existing geographic
bound is checked and, where necessary, lowered until every directed arc satisfies
`h(u) <= cost(u,v) + h(v)`. This protects correctness around disconnected nodes
and dead ends. Query order is `g + h`, ascending node ID on ties; original arc
order and first equal-cost predecessors remain deterministic.

Only query events appear in the replay. Index creation and per-query bound
preparation are timed separately. Exports retain graph/source provenance,
`alt/1`, `directed-landmarks/1`, landmark node IDs and coordinates, selection,
exact table format, cache state, buffer costs and query events. Tables are
reproducible from the same graph rather than included in every export.

## Buffer cost and validation

Four landmarks require eight uint32 arrays: **32 bytes per graph node**.
The Swiss graph's tables retain 40,274,784 bytes (38.4 MiB). The measured peak
of explicitly allocated index-build buffers is 51,651,219 bytes (49.3 MiB),
including selection scratch space and the active Dijkstra frontier. Per-query
search, heuristic, topology and graphics buffers are additional; these figures
are not browser-process or physical-phone memory measurements.

The index is built in the worker on first use and reused within that loaded
snapshot. It adds no graph-download attributes. Costs are exact centimetres;
`0xffffffff` denotes unreached nodes. Exceeding the finite table capacity raises
an error rather than silently dropping roads. Time costs need separate tables
and are deliberately outside this trial.

Tests compare ALT with Dijkstra across directed, disconnected, zero-cost and
asymmetric fixtures, check every bound's arc consistency, and verify repeatable
landmarks and events. Desktop Chromium and emulated iPhone WebKit checks cover
route distance, replay seeking, exports, cache reuse and country restrictions.
Physical iPhone memory and sustained playback remain unverified.

The visual trial uses aqua exploration, a recorded expansion focus and four
small lavender landmark diamonds. It retains the normal route reveal and adds
no controls beyond the algorithm option. Preparation and buffer figures are
available in About this study.

Reference: [Goldberg and Harrelson, Computing the Shortest Path: A* Search Meets
Graph Theory](https://www.microsoft.com/en-us/research/publication/computing-the-shortest-path-a-search-meets-graph-theory/).
