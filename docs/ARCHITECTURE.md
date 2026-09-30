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

The first profile is road connectivity, not complete driving legality. Turn,
barrier and conditional restrictions are not applied; their source records
remain available. No timetable or vehicle contracts are repurposed for routing.

## Replay and drawing

Packed Uint32 events use the low two bits for kind (0 settled, 1 examined,
2 improved); upper bits identify the node or directed adjacency arc. Checkpoints
at every 4,096 events permit exact counters during arbitrary seeking.

Computation time is measured around allocation and Dijkstra’s recording loop;
endpoint preparation is measured separately. Route reconstruction and GPU texture
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
Turn-rule validation is the next routing gate. A* and alternative visual styles
can then be compared against the same declared graph and trace contracts.

[The first-study replay measurement](evidence/first-study-2026-09-30/replay-report.json)
records about 60 fps with Chromium Metal and WebKit on an M4 Max. Chromium’s
software renderer is much slower. `readyMs` is receipt of the worker result over
local serving, not a mobile-network opening time or completed first GPU frame.
Run `node scripts/data/replay-proof.mjs` on macOS after building to repeat it.

Pages publishes the checked artifact. Cloudflare independently stages those
same bytes using pinned hosting tools. No build or request refreshes OSM.
