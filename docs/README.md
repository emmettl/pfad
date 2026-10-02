# PFAD documentation

Current state · 1 October 2026

PFAD is live on [Motion Studies](https://motionstudies.app/pfad/) and
[GitHub Pages](https://emmettl.github.io/pfad/), using the same checked application
artifact. Switzerland is the default; the catalogue also offers United Kingdom,
Iceland, New Zealand, Luxembourg, Netherlands, whole-island Ireland and Scandinavia
(Norway, Sweden and Denmark), Poland, Italy, Spain, metropolitan France with
Corsica, and Germany. [COUNTRIES.md](COUNTRIES.md) records coverage,
downloads and immutable releases. Austria joins the catalogue with a complete
national graph; its [release evidence](evidence/austria-release-2026-10-02/README.md) records validation.

Manual journeys offer Dijkstra, bidirectional Dijkstra, A* and bidirectional A*.
The recorded computation drives roads, counters and colours; route completion
has a separate travelling reveal. Map-point selection adds a faint country fill,
including when outlines are hidden. Playback supports keyboard controls, seeking,
five duration presets and reduced motion.

Ambient mode selects pairs from each study's curated pool, rotates the four
journey algorithms and inserts a three-source Dijkstra territory after every
four journeys. It reduces controls, varies replay duration by real road distance
and supports pause, next, exit and deliberate reduced-motion stills. Three opt-in
Driftbox pieces provide a provisional continuous score.

Concise query URLs follow endpoints, algorithm, settings and camera. Links autoplay
from the beginning; reduced motion opens a completed still. Static share previews
and exact binary trace exports retain the distinction between presentation and
computation. Verified graph caching is bounded; outline releases are separate
from both the graph and application bundle.

The connectivity profile remains provisional: driving-rule enforcement and
physical-phone budgets are open. Visual pacing and the soundtrack need author
review. [ROADMAP.md](ROADMAP.md) distinguishes delivered work, remaining gates
and the uncommitted wishlist. Dated evidence records the implementation tested at
that time; its older counts and algorithm sets are not current feature limits.

## Guides

| Document | Contents |
| --- | --- |
| [Concept](CONCEPT.md) | Artistic premise and the requirement for genuine computation |
| [Using PFAD](USAGE.md) | Selection, playback, keyboard, outlines, ambient and sound |
| [Roadmap and wishlist](ROADMAP.md) | R1–R5 status, review priorities and future possibilities |
| [Ambient](AMBIENT.md) | Current sequence, curated pools, selectors, pacing and evidence |
| [Music](MUSIC.md) | Provisional repertoire, playback lifecycle, composition and reproduction |
| [Sharing and records](RECORDS.md) | Native URLs, autoplay, share metadata and binary export format |
| [Development](DEVELOPMENT.md) | Setup, commands and documentation upkeep |
| [Testing](TESTING.md) | Logic/browser responsibilities, bounded concurrency and measurements |
| [Architecture](ARCHITECTURE.md) | Algorithms, event contracts, rendering and resource ownership |
| [Routing profile](PROFILE.md) | Current distance, direction and access assumptions and limitations |
| [Data](DATA.md) | Swiss source, encoding, snapping, geographic references and cache policy |
| [Countries](COUNTRIES.md) | Catalogue, country compilation, validation, publication and refreshes |
| [Hosting](HOSTING.md) | Dual app hosting, artifact provenance and independent R2 data delivery |

- [Germany phone drawing follow-up](evidence/mobile-drawing-2026-10-01/README.md): lossless compressed CPU drawing, phased uploads and physical-phone retest limitation.

- [Whole-US desktop feasibility](evidence/us-desktop-2026-10-02/README.md): complete national graph, Chromium/WebKit coast-to-coast tests, and measured rendering limits.

- [Exact replay drawing optimization](evidence/replay-drawing-2026-10-02/README.md): temporal batching, viewport culling, reduced GPU geometry and UK/Germany/US validation.

- [Phone outline visibility](evidence/outline-visibility-2026-10-02/README.md): readable screen-space border/lake strokes and before/after pixel checks.

- [Germany bidirectional A* memory follow-up](evidence/balanced-memory-2026-10-02/README.md): exact Munich–Berlin traces, compact balanced potentials and one-shot worker cleanup.
