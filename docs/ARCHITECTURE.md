# Architecture

PFAD owns its compiler, routing graph, search engine, event trace and WebGL
composition. Public Motion Studies packages provide fonts, tokens and the
accessible timeline scrubber. Imports and releases are checked at the boundary.

Playback shortcuts share the button's toggle and the scrubber's seek path.
Space toggles once per press; Left/Right seeks one replay second, Shift seeks
five, and Home/End selects a boundary. Seeking pauses and clamps to the replay
window, using the current replay duration. Keyboard focus can enter the map and
timeline. Native pickers, sound sliders, editable fields and About retain their
own keys; shortcuts are inactive while loading, computing, picking, confirming
a large dataset or in an error state. Modifier combinations used by the browser
are not intercepted.

## Data and search

The offline study compiler packages a source-verified OSM graph and separately
simplified drawing geometry into versioned, hashed chunks. The worker loads
all chunks, verifies SHA-256, checks layouts and builds directed CSR adjacency.
It does not search a partial graph. See [the data format](DATA.md).

On large datasets with coarse-pointer input, the app defers road GPU uploads
until the search finishes, then terminates the routing worker before replay.
Starting another search disposes the road GPU buffers, creates a new worker and
reopens all verified topology chunks for the same immutable release. Existing
drawing geometry stays in the scene and is uploaded again for the result; it is
not downloaded or duplicated. A bounded 256 MiB compressed cache now accommodates
Germany and France, subject to storage availability. Rebuilding adjacency costs
additional preparation time on subsequent phone searches. See the
[Germany memory investigation](evidence/mobile-memory-2026-10-01/README.md).

Queries snap both endpoints symmetrically using `nearby-shared-component/1`;
requested coordinates and the snapping version accompany each worker result.
A cached weak-component index helps avoid nearby isolated fragments without
inventing roads or preselecting a destination for directed reachability. The
selected algorithm still decides whether a route exists. See [snapping](DATA.md).

Costs are integer road
lengths in centimetres. The heap orders by distance, then ascending dense node
ID; neighbours follow compiler edge order. `dijkstra/1` records a settled-node
event, each outgoing arc examination, and each successful cost improvement.
The event record carries dataset identity, compiler/profile version and source
checksum/timestamp, together with algorithm and tie-breaking version.

`bidirectional-dijkstra/1` is an alternate shortest-distance search on the same
graph and snapped endpoints. Its forward front follows outgoing arcs; its
destination front follows the transpose of those same directed arcs. The reverse
CSR is built lazily in the worker, in ascending source-node/original-arc order,
and retained for subsequent queries on desktops and smaller graphs. Its source
nodes are derived from original road endpoints rather than duplicated. No
additional geographic download is needed.
The smaller queue distance advances next; equal distances alternate fronts,
starting forward. Each heap breaks ties by ascending node ID. Strict improvements
retain the first equal-cost predecessor and connection.

The algorithm keeps the best known complete cost and continues until the sum
of both unsettled queue minima cannot improve it. First contact alone is not
a stopping rule. This follows the criterion in [Goldberg's shortest-path survey,
section 2](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/goldberg-sofsem07.pdf).
The reconstructed route follows original permitted directions even though the
destination search reads the reverse graph. Independent relaxation tests cover
directed, disconnected, zero-cost and first-contact-suboptimal cases.

`astar/1` uses the same single-front recording loop as Dijkstra, ordering its
heap by cost so far plus a remaining-distance bound, then ascending node ID.
The heuristic is `feasible-planar-distance/1`. It starts with integer-centimetre
planar distances to the destination, using the graph's maximum absolute latitude
for the longitude scale. Independent coordinate and cost rounding means this
initial estimate is not assumed admissible.

Preparation lowers any estimate that violates `h(u) <= cost(u,v) + h(v)` on an
original directed arc, propagating reductions through the reverse CSR until all
constraints hold. Estimates remain nonnegative and the destination stays zero.
Telescoping the inequality along any permitted path establishes a lower bound
on its cost. The consistent potential permits permanent settlement and stopping
when the destination is settled. See [Goldberg's survey, sections 2–3](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/goldberg-sofsem07.pdf).
Zero-cost arcs and geographically misleading shortcuts are included in fixtures.
This preparation is separate from the replayed A* query and is measured in the
heuristic record; it is not presented as extra search activity.

The A* result retains the heuristic version, preparation time, number of corrected
nodes, longitude scale and initial/final origin estimate alongside the existing
source identity, search time, work counters, tie-breaking and final cost.
The reverse CSR is shared with bidirectional mode. Heuristic potentials add
10,068,696 working bytes on the Swiss graph and are released after each query.

The first profile is road connectivity, not complete driving legality. Turn,
barrier and conditional restrictions are not applied; their source records
remain available. No timetable or vehicle contracts are repurposed for routing.

## Replay and drawing

Packed Uint32 events use the low two bits for kind (0 settled, 1 examined,
2 improved); upper bits identify the node or directed adjacency arc. Bidirectional
traces reserve bit 31 for the destination front, leaving bits 2–30 for the original
graph ID. Original arc IDs are retained even for reverse examinations. Checkpoints
at every 4,096 events permit exact counters during arbitrary seeking.

Computation time is measured around allocation and the selected recording loop;
endpoint preparation is measured separately. Lazy reverse-CSR and A* heuristic
preparation, route reconstruction and GPU texture
preparation are outside that timer. The playback clock follows **event order**,
not measured per-instruction timing. It stretches a real trace without inventing
algorithm activity or pretending the processor is still searching.

The renderer receives separate road shapes, reconstructed as Float32 drawing
coordinates, and exact integer first-examination/improvement event orders per
physical edge. A shader reveals an edge only after examination. Its pulse is an
authored decay from that recorded event. Reverse seeking changes the event cutoff;
the final route becomes bright only at completion. Later examinations of the
same physical road remain in the trace and counters rather than creating a
second road. The endpoint markers are separate from explored edges.

A* uses a cool blue-to-ice palette and dimmer historical branches. Each road's
tone records the remaining-distance bound at the target of its first examined
arc, normalised against the origin's bound. This is an estimate of remaining
cost, not proof that a road belongs to the final route. Successful improvements
retain their distinct emphasis, and recent examination pulses follow real event
orders. No unexamined corridor or invented attraction to the goal is drawn.
The tone texture uses one byte per padded physical edge: 1,390,592 bytes for the
Swiss graph, plus GPU storage. It is disposed when changing results. Pause
and reverse seeking restore the same recorded colours and counters. All modes
share the separate final-route presentation and reduced-motion behaviour.

In bidirectional mode, each front has its own real first-examination/improvement
texture: mint from the origin and amber from the destination. Where both have
examined a physical road their contributions blend. Counters count node
settlements and arc examinations across both fronts, including a node settled
by each front; the count does not claim distinct nodes.

The record also identifies the first node with finite labels from both fronts,
the exact event that established the connection, and that candidate's cost.
Natural forward playback across this event triggers one small 800-ms light at
the actual node. This is a presentation effect; it does not change the search
or mark the first candidate as optimal. Its soft halo and ring keep a fixed
40-pixel envelope through zoom changes. Pause freezes it, reverse seeking
re-arms it, manual seeking suppresses it, and new results dispose its geometry.
Reduced motion skips it, including live preference changes. Hidden pages freeze
this clock. The closing route reveal remains separate and starts only when the
recorded search ends.

On the pinned Swiss graph the retained reverse CSR adds 26,224,632 bytes in
the worker, and the second padded event texture adds 11,124,736 bytes in the
main thread (plus GPU storage). Bidirectional working labels and the trace
allocation also grow; these figures are not total or peak browser memory.
The normal Dijkstra startup does not build the reverse CSR. Device-budget work
and physical-phone measurements remain open in R2.

Normal playback closes with a 2.6-second origin-to-destination route reveal and
a 0.7-second glow settle. This presentation clock begins after the final recorded
event; counters and the event cutoff remain fixed. The overlay uses the same
actual road curves, ordered and oriented by the reconstructed route. Original
road lengths weight its progress, distributed along each simplified curve.
A screen-space ribbon keeps its fine core and soft travelling halo legible at
different zoom levels. Swiss drawing offsets add about 5.6 MB; the curve coordinates
are shared with the existing drawing, and only the current route gets a ribbon.
The preceding route ribbon is disposed when a new result arrives.

Pause freezes the closing reveal; play resumes it. Seeking backwards removes
the overlay, and seeking directly to completion shows the settled route without
an animation. Restart clears both clocks. Reduced motion skips the flourish,
including when the preference changes during it. Hidden pages do not advance
the presentation clock. No vehicle, additional search activity or invented
connections are implied by the travelling light.

The Swiss drawing is 4,119,930 line vertices. The renderer normally caps pixel
ratio at 1.5, skips unchanged frames, and supports pan, wheel zoom and pinch.
Large graphs on devices with a coarse primary pointer use pixel ratio 1 and a
30 fps rendering cap. These limits retain all road geometry and search events;
they do not establish physical-phone stability.
Reduced-motion preference starts at the completed trace with autoplay disabled.
The canvas fills the viewport behind transparent header, playback and footer
overlays. Empty overlay space passes map gestures through; buttons, selectors,
links and the timeline keep their own interaction areas. Subtle text shadows
preserve label contrast without reserving or obscuring bands of the map.

An optional static layer draws faint national-border and lake-shoreline rings
below the roads. Verified, immutable outline releases are fetched separately for
the selected country and projected with its road manifest. The Swiss lines use
11,280 vertices; geometry varies by study. The Outlines button works as soon as
context is verified, including during road loading, and changes visibility without
changing events, routes, replay or counters. Its preference survives a dataset
retry within the page. Outline failures have a separate retry and do not prevent
road searches. Country switches abort stale requests. See [DATA.md](DATA.md) and
[COUNTRIES.md](COUNTRIES.md#independent-outline-releases).

Point selection lazily triangulates the same verified country exteriors into a
faint mint fill beneath outlines and roads. It shares the map projection and camera,
remains visible when outline lines are hidden, and clears on selection or cancellation.
The group is reused between picker activations and disposed on geographic-context
replacement or scene teardown. Missing context uses a quiet clear-colour tint
instead. This adds no geographic download and has no search-event semantics.
Reference dates and attribution remain separate from the OSM road graph.

## Verification and remaining gates

Unit tests compare Dijkstra with independent relaxation and check direction,
ties, route costs and checkpoint seeking. Publication tests verify every chunk,
coverage, directed-arc count, drawing vertex count and payload budget. Browser
tests exercise the real national dataset in Chromium and mobile WebKit, retry
missing chunks and inspect reduced-motion behaviour.

Mobile WebKit here runs on a desktop host with an emulated viewport. Actual phone
memory, thermal behaviour and frame pacing still require device measurements.
Turn-rule validation remains the next routing gate. All four journey algorithms
compare the same declared connectivity graph; their agreement does not establish
driving legality.

[The first-study replay measurement](evidence/first-study-2026-09-30/replay-report.json)
records about 60 fps with Chromium Metal and WebKit on an M4 Max. Chromium’s
software renderer is much slower. `readyMs` is receipt of the worker result over
local serving, not a mobile-network opening time or completed first GPU frame.
Run `node scripts/data/replay-proof.mjs` on macOS after building to repeat it.

Pages publishes the checked artifact. Cloudflare independently stages those
same bytes using pinned hosting tools. No build or request refreshes OSM.

## Sequencing, storage and records

The ambient controller owns presentation phases and bounded selection metadata.
It rotates four ordinary journey algorithms and inserts a three-source study
after four journeys. Journey acceptance uses actual route distance; territories
use genuine source coverage. It never alters topology, costs or event order.
The full graph is reused; prior route geometry/textures are disposed when each
accepted result arrives.
Music has one separate owner and changes its pause policy only for whole-sequence
actions. [AMBIENT.md](AMBIENT.md) describes selection, timing and remaining review.

The verified loader uses two outstanding chunks, optional bounded persistence
and strict readiness; see [DATA.md](DATA.md). Native links follow requested points,
algorithm, settings and camera without a graph hash or replay offset. Opening
recomputes and autoplays from the beginning; reduced motion shows the completed
trace. Legacy identity-bearing links remain validated and resume their recorded
frame. Binary exports retain exact graph/profile identity, presentation state,
packed events and provenance; see [RECORDS.md](RECORDS.md).

## Bidirectional A*

`bidirectional-astar/1` shares the genuine two-front event recorder and renderer
with bidirectional Dijkstra. Prepare feasible planar bounds `hG` towards the goal
on the original directed graph and `hS` towards the start on the reversed graph.
The balanced potential is `p(u) = (hG(u) - hS(u)) / 2`. Each original arc has
nonnegative reduced cost `c(u,v) + p(v) - p(u)`; half-centimetres are represented
exactly. Queue priorities are normalised to zero at each front's origin:

- Forward: `dF(u) + p(u) - p(start)`.
- Backward: `dB(u) + p(goal) - p(u)`.

Stop when the sum of queue minima reaches
`bestOriginalCost + p(goal) - p(start)`, or a front is exhausted. First contact
remains an upper bound, never the stopping criterion. Route costs and
predecessors retain original centimetres. Equal queue priorities alternate
fronts starting forward; node IDs and arc order retain the existing deterministic
rules. No shortcut or invented examination is recorded.

Both heuristic preparations precede the search clock. Exported records include
`balancedHeuristic` with version `balanced-feasible-planar-distance/1`, total
preparation time and the two original heuristic records. Preparation temporarily
adds two Float64 node arrays and the existing correction workspace; physical
phone memory validation remains open. The replay retains mint/amber fronts and
the existing first-connection light.

## Three-source territory study

`multisource-dijkstra/1` seeds three distinct road nodes with distance zero and
runs a single Dijkstra queue to exhaustion. Each settled node has the minimum
outward directed road distance from any source. Queue ties use ascending node
ID; equal-cost discoveries retain the first source under the recorded source
order and compiler arc order. Unreachable nodes and roads remain unlit.

`nearby-shared-three-source-component/1` chooses eligible roads within two
kilometres, preferring a common weak component with minimum summed displacement.
When no shared nearby component exists, each source retains its nearest eligible
road; the actual directed search decides coverage. Snapped IDs must be distinct.

The trace uses two high bits for source index 0–2 and two low bits for settle,
examine and improvement kinds. Decode source with `word >>> 30` and graph ID with
`(word & 0x3fffffff) >>> 2`. IDs must remain below 2^28. Existing checkpoint counts
still use only the low kind bits. A single RG integer timestamp texture and a
one-byte source texture colour each road by its first real examination from a
settled node. This is an examination colour, not an interpolated boundary within
a road or an all-pairs route. No meeting flash, final path or route reveal is
constructed. Completed territories brighten for the hold.

Only the ambient sequence selects triples; manual endpoint pickers stay at two.
A shared territory can be inspected and switched back with Journey. Exiting
ambient preserves the territory frame. All requested/snapped sources, versions,
source node counts, maximum nearest-source distance and exact source-tagged trace
are exportable. Per-query workspace is one distance array, one settled array,
one node-source array and one queue; the source texture adds one byte per padded
road. Full reachable coverage may examine more roads than a destination search;
physical-phone budgets remain unvalidated.

## Greedy best-first

`greedy-best-first/1` orders the frontier solely by great-circle proximity to the
destination, then ascending node ID. `great-circle-proximity/1` uses the recorded
node coordinates and the same 6,371,008.8 m spherical radius as the distance
selector, including longitude wrapping; estimates are rounded to centimetres.
Unlike the A* bound, this estimate is not corrected against graph edge costs.
It is only a priority, and makes no shortest-route guarantee. Preparation is
measured separately from the search.

The shared single-front recorder retains a first-discovery predecessor tree:
only undiscovered nodes are enqueued, neighbours follow compiler arc order,
and search stops when the goal is expanded. It never rewrites an expanded
node's parent. Consequently the returned route cost equals the sum of its
actual predecessor edges, even when a cheaper approach was examined later.
All nonterminal expansions and outgoing-arc examinations are real. No-route,
zero-cost and coincident endpoints remain valid cases. Exports identify the
route guarantee as `first-found` and keep the proximity heuristic version.

Coral history remains dimly visible. First examination/discovery timestamps
produce short bright pulses, shading towards pale peach as proximity improves.
`expanded-node-focus/1` records one exact event index and integer coordinate pair
per expansion in `focusEvents` and `focusCoordinates`. Replay finds the most
recent expansion at or before its event cursor, places a small stationary glow
there, and hides it when the search ends. It does not interpolate between nodes,
add connectors, pulse on a fabricated clock or invent examinations. The focus
stream is reversible and is retained in exact exports. Route reveal uses peach
and remains a separate presentation of the completed first-found route.

Worst-case recorder workspace gains twelve packed bytes per expanded node for
focus events and coordinates, plus the temporary number arrays before packing.
Greedy may explore extensively on awkward graphs; national examples do not
establish physical-phone budgets or routing legality.

### Depth-first trial

`depth-first/1` visits each node once, descending immediately in compiler arc
order using an explicit stack. Trace kind 3 records a return to the parent
when a branch is exhausted; it does not increment settlement, examination or
discovery counts. `depth-first-traversal-focus/1` records both visits and returns
in the exported focus streams. The first-found route follows the discovery
tree and is not guaranteed shortest. Lavender roads and focus distinguish this
manual trial; the automatic ambient repertoire remains unchanged pending review.

### Breadth-first manual study

`breadth-first/1` uses a FIFO queue and compiler arc order, visiting each node
once. The first-discovery tree minimizes compiled directed connections, not
metres. Exports preserve `routeGuarantee: fewest-connections` and actual route
lengths. Gold road examinations form a layer-by-layer wave; no single moving
focus or invented wave geometry is drawn. This mode stays outside ambient.
