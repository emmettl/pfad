# PFAD

**A study of time, space, and the paths not taken.**

[Motion Studies edition](https://motionstudies.app/pfad/) ·
[GitHub Pages](https://emmettl.github.io/pfad/) ·
[Concept](docs/CONCEPT.md) · [Roadmap and wishlist](docs/ROADMAP.md) ·
[Ambient-mode brief](docs/AMBIENT.md) · [Music brief](docs/MUSIC.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Routing profile](docs/PROFILE.md) ·
[Sharing and records](docs/RECORDS.md)

PFAD replays genuine pathfinding over recorded OpenStreetMap road
network. The computation runs normally; its recorded search becomes an event
that can be watched, paused and inspected. The search is the subject.

## Current state

A first working national study: a Web Worker runs deterministic Dijkstra,
bidirectional Dijkstra or A* on
1,258,587 nodes and 1,390,206 physical road edges. A WebGL map reveals real
examinations in event order. Choose towns or points on the map, pan and zoom,
pause, seek backwards, or change the replay duration. The visual direction
is validated: a dark field and luminous roads, drawing on Gleislicht.

Choose the algorithm beside the computation readout. Bidirectional mode grows
two genuine fronts, mint from the origin and amber from the destination. A small
light marks their first recorded connection; the algorithm continues to confirm
the shortest distance. Completion reveals the actual route with a travelling
glow. Very faint border and lake outlines can be toggled beside Sound.

A* explores using a checked lower bound on the remaining distance. Its cooler
blue search shades towards ice-white as that estimate falls, with quieter older
branches. The bound is prepared separately from the timed query; it respects the
actual directed road costs, including their rounding. Every visible road still
comes from a real examination.

Sound is optional: three original two-minute Driftbox sketches flow through
eight-second crossfades on their own clock. Enable Sound to listen and adjust
volume. Visual pause and seeking leave the music continuous; leaving the page
silences it, and returning requires enabling sound again. This is a provisional
repertoire for listening review. Its 3.47 MB of compressed audio is loaded on
demand, with two decoded pieces retained at most. See the [music brief](docs/MUSIC.md)
for composition sources, reproduction and remaining device checks.

Ambient loops distance-selected journeys from the twelve curated Swiss places,
cycling Dijkstra, bidirectional Dijkstra and A* from the selected algorithm,
with distance-based duration, a result hold and a transition to darkness. Pause
sequence pauses the score too; Next and Exit preserve its player. Reduced motion
provides completed stills and deliberate Next. Pacing and musical selection are
ready for author review.

The URL follows settings, the replay frame and map view automatically, opening
the exact pinned study paused when shared. About also offers Copy study link
and a binary export of the genuine trace with provenance. Verified
chunk caching retains at most two releases within 128 MiB and supports warm
opening and retries without downloading intact stored chunks again.
Static share metadata uses an attributed 1200 × 630 card captured from a genuine
Swiss search. Its source record and manual regeneration are documented in
[Sharing and records](docs/RECORDS.md).

This is a **shortest-distance connectivity model**. One-way directions apply;
turn restrictions, barriers and conditional access are preserved as evidence
but are not enforced yet. It is not a validated driving route planner.

## Development

Use Node 24 and npm 11.21.0. Data tools require Python 3.11 or newer. `npm ci`, then `npm run dev`.
`npm run check` runs type, lint, dependency-boundary, contract, build and
payload checks. `npx playwright install chromium webkit` installs browsers;
`npm run test:browser` checks the built site. Public shared packages are pinned
to `0.1.0-alpha.31`; the repository remains private to npm (`private: true`).

## Evidence and data

The selected 29 September 2026 snapshot ships as 27 content-verified chunks:
**15,866,559 bytes** for topology and five-metre drawing geometry. An optional
8,090,540-byte source evidence download is linked in About and is not loaded
for playback. OSM-derived database files are published under ODbL.

[Data policy and reproduction](docs/DATA.md) records the source checksum,
format, refresh policy and limitations. [Sizing evidence](docs/evidence/sizing-2026-09-30/)
preserves the earlier JSON experiment; its figures describe that encoding,
not this binary delivery format. Source PBFs and intermediate graphs stay in
ignored `.cache/`; Switzerland stays bundled, while additional country releases
are delivered independently from R2. See [country releases](docs/COUNTRIES.md).

[Bidirectional review](docs/evidence/bidirectional-2026-10-01/review.json) records
algorithm/source identities and equal-cost national comparisons, together with
desktop Chromium and mobile-viewport WebKit visual/lifecycle checks.
[A* review](docs/evidence/astar-2026-10-01/review.json) adds representative cost
comparisons and an independent check of every directed arc's heuristic bound.

## Hosting

Successful main-branch checks build and deploy GitHub Pages. Cloudflare then
publishes the same Pages artifact at `motionstudies.app/pfad/`, independently.
See [hosting](docs/HOSTING.md). Neither build nor deploy downloads OSM.

## Licence

Code: [MIT](LICENSE). Road data: © OpenStreetMap contributors, under the
[Open Database Licence](https://www.openstreetmap.org/copyright). The code
licence does not relicense OSM-derived databases. Bundled shared-package fonts
retain their upstream licences.
