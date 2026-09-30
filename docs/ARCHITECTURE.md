# Architecture

The edition owns its application, compiler, graph schema, worker, event trace
and renderer. Shared Motion Studies packages supply established presentation
and interaction capabilities through public exports as those are needed.

1. Offline compilation selects a declared driving profile from a dated OSM
   extract. Preserve junctions, directionality, costs, controls and restrictions.
2. A versioned manifest identifies the graph, geometry chunks, source checksum,
   compiler/profile versions, byte lengths and content hashes.
3. Load the complete compact routing graph for the first implementation.
   Geometry can load in geographic chunks. A missing chunk is a loading state,
   never evidence that the represented roads do not exist.
4. A Web Worker runs a genuine deterministic search and records examined edges,
   settled nodes and improved costs. The renderer consumes this trace on a
   separately controlled replay clock. It must not invent algorithm events.
5. Record graph identity and algorithm/tie-breaking version with every trace.
   Old recordings must not silently resolve against a newly refreshed graph.

The scaffold does not implement these layers yet. The sizing scripts are an
experiment, not the production compiler. They preserve restriction records but
do not enforce them. The browser benchmark measures computation and typed-array
sizes on a desktop, not total browser peak memory or phone rendering.

Next gates: validate the routing profile and restriction handling; test memory
on a phone; render and replay one real national trace; measure opening payload
and first usable frame before adopting further graph or geometry partitioning.

Cloudflare Static Assets has a per-file limit enforced by the shared publisher.
Keep compiled delivery chunks below that limit even when their compressed size
is smaller. Stable manifests revalidate; a dataset’s content identity is immutable.
