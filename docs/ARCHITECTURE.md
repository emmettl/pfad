# Architecture

PFAD owns its compiler, routing graph, search engine, event trace and WebGL
composition. Public Motion Studies packages provide fonts, tokens and the
accessible timeline scrubber. Imports and releases are checked at the boundary.

## Data and search

The offline study compiler packages a source-verified OSM graph and separately
simplified drawing geometry into versioned, hashed chunks. The worker loads
all chunks, verifies SHA-256, checks layouts and builds directed CSR adjacency.
It does not search a partial graph. See [the data format](DATA.md).

Queries snap endpoints before deterministic Dijkstra. Costs are integer road
lengths in centimetres. The heap orders by distance, then ascending dense node
ID; neighbours follow compiler edge order. `dijkstra/1` records a settled-node
event, each outgoing arc examination, and each successful cost improvement.
The event record carries dataset identity, compiler/profile version and source
checksum/timestamp, together with algorithm and tie-breaking version.

`bidirectional-dijkstra/1` is an alternate shortest-distance search on the same
graph and snapped endpoints. Its forward front follows outgoing arcs; its
destination front follows the transpose of those same directed arcs. The reverse
CSR is built lazily in the worker, in ascending source-node/original-arc order,
and retained for subsequent queries. No additional geographic download is needed.
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
10,068,696 working bytes on the national graph and are released after each query.

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

The renderer receives separate road shapes, quantised to signed 16-bit drawing
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
national graph, plus GPU storage. It is disposed when changing results. Pause
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

On the pinned national graph the retained reverse CSR adds 26,224,632 bytes in
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
different zoom levels. Drawing offsets add about 5.6 MB; the curve coordinates
are shared with the existing drawing, and only the current route gets a ribbon.
The preceding route ribbon is disposed when a new result arrives.

Pause freezes the closing reveal; play resumes it. Seeking backwards removes
the overlay, and seeking directly to completion shows the settled route without
an animation. Restart clears both clocks. Reduced motion skips the flourish,
including when the preference changes during it. Hidden pages do not advance
the presentation clock. No vehicle, additional search activity or invented
connections are implied by the travelling light.

The whole national drawing is 4,119,930 line vertices. The renderer caps pixel
ratio at 1.5, skips unchanged frames, and supports pan, wheel zoom and pinch.
Reduced-motion preference starts at the completed trace with autoplay disabled.
The canvas fills the viewport behind transparent header, playback and footer
overlays. Empty overlay space passes map gestures through; buttons, selectors,
links and the timeline keep their own interaction areas. Subtle text shadows
preserve label contrast without reserving or obscuring bands of the map.

An optional static layer draws faint, unfilled national-border and lake-shoreline
rings below all road drawing. The reviewed geographic assets are bundled with
the application, projected with the road manifest's projection and consume two
additional draw calls (11,280 vertices). The Outlines button changes visibility
without changing the event cutoff, route, replay clock or counters. Its preference
survives a dataset retry within the page. Outline geometries and materials are
disposed with the scene. These reference lines have no search-event semantics;
their dates, generalisation and attribution are separate from OSM. See [DATA.md](DATA.md).

## Verification and remaining gates

Unit tests compare Dijkstra with independent relaxation and check direction,
ties, route costs and checkpoint seeking. Publication tests verify every chunk,
coverage, directed-arc count, drawing vertex count and payload budget. Browser
tests exercise the real national dataset in Chromium and mobile WebKit, retry
missing chunks and inspect reduced-motion behaviour.

Mobile WebKit here runs on a desktop host with an emulated viewport. Actual phone
memory, thermal behaviour and frame pacing still require device measurements.
Turn-rule validation remains the next routing gate. Dijkstra, bidirectional
Dijkstra and A* currently compare the same declared connectivity graph; their
agreement does not establish driving legality.

[The first-study replay measurement](evidence/first-study-2026-09-30/replay-report.json)
records about 60 fps with Chromium Metal and WebKit on an M4 Max. Chromium’s
software renderer is much slower. `readyMs` is receipt of the worker result over
local serving, not a mobile-network opening time or completed first GPU frame.
Run `node scripts/data/replay-proof.mjs` on macOS after building to repeat it.

Pages publishes the checked artifact. Cloudflare independently stages those
same bytes using pinned hosting tools. No build or request refreshes OSM.
