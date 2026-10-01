# Testing PFAD

Run `npm run check` and the relevant browser checks before publishing. `npm test`
runs Vitest in Node; `npm run test:watch` watches that suite. Browser tests use
the built site: `npm run build`, then `npm run test:browser`.

## What belongs where

| Responsibility | Runner | Reason |
| --- | --- | --- |
| Dijkstra, bidirectional Dijkstra and A* correctness, snapping, directed roads, ties, trace events and checkpoint seeking | Vitest | Deterministic graph logic; independent reference algorithms verify optimal costs. |
| Real Swiss forward/reverse route costs and exact national event counts | Vitest | The production worker entry point loads the published chunk bytes through a local transport; no browser or GPU is needed to verify its answers. |
| Distance bands, curated pools, seeded selection, algorithm rotation, retries, replay duration, hold/fade/pause and reduced-motion sequence rules | Vitest | Controlled clocks and small results cover full sequences without waiting through journeys. |
| Chrome idle deadline, reset and cleanup | Vitest | Fake timers cover the exact four-second boundary and cancelled timers. |
| URL validation, throttling, recording format and exact binary values | Vitest | Pure serialization and scheduling, including IDs above Float32 precision. |
| Chunk integrity, decoding limits, ordering, retries and cache budgets | Vitest | Faults and boundary cases can be reproduced cheaply. |
| Static OG/X metadata, JSON-LD, image dimensions/hashes and icons | Vitest | These are file contracts; browser engines add no value to every assertion. |
| Soundtrack scheduling, bounded voices, stale decode cancellation, pause/mute/hidden-page rules and rack identity | Vitest | AudioContext doubles expose scheduling precisely. |
| Production Web Worker loading/transfer and national WebGL rendering, shader modes, outlines and seeking | Playwright, both engines | Integration and real pixels depend on browser APIs. The actual Swiss graph remains in these checks. |
| Keyboard/native controls, focus protection, touch wake, dialogs and camera gestures | Playwright, both engines | DOM defaults, accessibility and pointer behaviour need a browser. |
| Real IndexedDB persistence, retry, refresh and damaged-entry repair | Playwright, both engines | Browser storage must survive page reloads. |
| Address-bar/reload/hash navigation, share UI and file download | Playwright, both engines | History, focus and download integration are browser responsibilities; exhaustive formats stay in Vitest. |
| Opt-in AudioContext playback, decode support, volume and lifecycle | Playwright, both engines | Unit doubles cannot establish actual audio availability. |
| AAC decoding and OfflineAudioContext crossfades | Playwright, both engines | This verifies the delivered files through each engine's codec and mixer. It runs in a blank same-origin document, without loading the national graph. |
| Built HTML and share-image delivery with JavaScript disabled | Playwright, both engines | A small crawler smoke covers delivery; file-level metadata checks stay in Vitest. |

Browser animation checks observe a real partial frame and its paused state, then
use the reduced-motion path to verify the final frame. Exact flourish timing,
replay and clearing rules are tested in Vitest. Idle UI checks use Playwright's
clock to advance the deadline, retaining real input, CSS transitions and focus
behaviour. No production search or road data is substituted.

## Bounded parallelism

Vitest runs up to two isolated workers. Tests inside each file remain serial;
global clock, fetch and AudioContext doubles are restored between cases.

Playwright permits independent cases to run in parallel and defaults to two
workers locally. Override it with `--workers=1` for diagnostics. Every test has
its own browser context and storage; traces, screenshots and JSON timing reports
are retained in ignored `test-results/`.

CI builds once, then gives desktop Chromium and touch WebKit separate runners.
Each runner has one browser worker so two national scenes do not compete for
the same software-rendering CPU/RAM budget. Both engines run concurrently.
The Pages deployment waits for the entire reusable check workflow to succeed;
Cloudflare still publishes the identical successful Pages artifact. Browser
reports are uploaded even on failure.

For a reproducible local comparison, use the same build and these commands:

```sh
PLAYWRIGHT_JSON_OUTPUT_FILE=.cache/browser-serial.json npm run test:browser -- --workers=1 --reporter=line,json
PLAYWRIGHT_JSON_OUTPUT_FILE=.cache/browser-parallel.json npm run test:browser -- --workers=2 --reporter=line,json
```

Compare `stats.duration`, failures and per-case durations in the JSON reports.
Report successful runs separately from timeouts; a failed 150-second click must
not be counted as a baseline speed improvement. Desktop/mobile viewport checks
do not establish performance on physical phones.

## Local measurement · 1 October 2026

Measured on the same Apple M4 Max / macOS host. Both revised runs use the same
build, all 42 browser checks pass without retries, and the real Swiss graph is
retained. The earlier passing suite's time is rounded by Playwright's reporter.

| Suite | Browser workers | Wall time |
| --- | --- | --- |
| Earlier suite: 46 browser checks | 1 | 4m48s (rounded) |
| Revised suite: 42 browser checks | 1 | 2m36.4s |
| Revised suite: 42 browser checks | 2 | 1m29.1s |
| Vitest: 65 checks in 18 files, including six real national searches | 2 | 2.27s |

The responsibility changes reduce serial browser wall time by approximately
46%. Two workers then reduce the revised suite's wall time by another 43%.
CI software-rendering performance is measured separately; this table is not a
CI projection. [Timing evidence](evidence/testing-2026-10-01/timings.json) preserves
the successful run counts and timings. The final audio integration check also
retains keyboard focus during slow clicks, matching the concurrent country
validation fix.
