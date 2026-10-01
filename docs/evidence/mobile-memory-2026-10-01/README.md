# Germany mobile replay memory — 1 October 2026

An iPhone 17 Pro user reported Safari repeatedly losing the Berlin–Munich
bidirectional replay at a 15-second duration. The failure screen is consistent
with memory pressure; no device crash log was available to establish the cause.

The runtime now separates national computation from GPU road uploads on large
coarse-pointer devices. Road buffers are deferred until the result; the worker
is terminated before replay. A new search disposes those GPU buffers and reopens
all topology chunks from the identical release, without reloading drawing
geometry. The compressed cache cap increases from 128 to 256 MiB so Germany and
France fit, with at most two release identities and verified reads. Storage
refusal still permits verified network loading. Subsequent phone searches incur
additional topology decoding and adjacency preparation.

Reverse CSR keeps arc IDs and offsets only, deriving source nodes from physical
road endpoints. Bidirectional predecessors likewise retain physical edge IDs
without separate predecessor-node arrays. Original adjacency order, tie breaks,
route directions, event words and integer timestamps remain unchanged. Browsers
without resizable/transferable trace buffers allocate 1 MiB blocks as events are
recorded, rather than the full national worst-case event bound.

[Buffer accounting](buffer-accounting.json) estimates 2,112,031,009 bytes before
and 1,315,898,564 bytes after for explicitly retained replay arrays and GPU
copies: a reduction of 796,132,445 bytes. Accounted computation overlap drops
from 2,277,016,995 to 1,706,122,319 bytes. These are allocation calculations,
**not measured process peaks or a physical iPhone pass**. They exclude browser,
driver, framebuffer, decoding, heap, heuristic, ribbon and outline overhead;
worker termination requests reclamation without measuring its timing.

The exact German release remains `de-20260929-083582060611`: 10,488,625 nodes,
11,974,914 physical roads, 22,891,751 directed arcs and 32,951,556 drawing vertices.
All topology and drawing vertices are retained.

[Baseline](baseline-phone-proof.json) and [updated replay](phone-proof.json)
use desktop WebKit with a touch viewport, not a physical iPhone. Three complete
15-second replays exercise bidirectional → A* → bidirectional. Berlin–Munich
remains 578,359.82 metres; both bidirectional traces contain 23,476,639 events
and have SHA-256 `9499d05ebe4ecde78a6948c66cdd4727e5666b110d7dc5fe84898f94c4b8b022`.
The A* trace also matches its baseline. All three updated workers terminate
before replay; subsequent workers consume zero drawing chunks and zero network
bytes, rechecking 125,254,351 cached topology bytes. Desktop rebuild times in
this run were approximately 0.8–0.9 seconds; these are not phone timings.

[Ambient integration](ambient-browser-proof.json) covers eight real studies
including three-source territories, all five journey algorithms, an automatic
transition, outline toggles, shared reload and return to Switzerland. It reports
no page errors. The complete graph remains searchable on every worker reopen.

Local validation: `npm run check` passes 99 tests and build/resource checks;
56 browser regressions pass in isolated Chromium/WebKit builds, followed by
four integration checks for the subsequently committed Watch controls. Deployment
and final host checks are recorded separately after publication. Physical
iPhone stability remains unverified until the reporter retests this release.
