# Exact replay drawing optimization

Shared drawing changes improve the UK, Germany and the experimental full US graph without modifying topology, route costs, coordinates, event traces or dataset identities.

The renderer removes roads with no recorded first examination in either search direction. Within each original chunk, exact segments are arranged into 64 temporal buckets. A conservative draw range includes the current bucket; the integer-event shader still applies each road's original visibility time. Backward seeks reduce the range again. A manually calculated two-dimensional bounding sphere enables conservative viewport culling without Three's three-component position assumption. There is no geometric approximation or level-of-detail reduction.

Large countries now retain losslessly compressed source drawing on desktop as well as phones. Only chosen-route coordinates remain in the route builder. Expanded replay attributes are released after GPU upload; filtered geometry is disposed before subsequent preparation. Context loss disposes old resources before Three replaces its managers, then rebuilds drawing and geography while preserving the replay position. The existing large-phone policy still terminates the routing worker before replay uploads and reloads only cached topology for another search.

## Measured results

On the same M4 Max with 36 GiB RAM, 1440×900 at DPR 1, full US playback improved from approximately 14 fps to 30–44 fps. All ten trace hashes and route distances matched the [baseline](../us-desktop-2026-10-02/README.md). Subsequent bidirectional San Francisco–New York runs reached 33.8 fps in Chromium Metal and 31.6 fps in desktop WebKit; A* reached 43.3 and 43.8 fps. See [comparison](comparison.json) and [raw optimized measurements](us-desktop-report.json).

Preparation adds about 3–5 seconds on the US graph, versus approximately 0.1–0.5 seconds in the baseline. The first Chromium run overlapped an initial Germany proof; later Chromium runs and all WebKit runs ran without another browser proof. The comparison retained expanded original drawing to match the baseline; the normal app's compressed retention is qualified separately. Browser process-tree RSS is not a precise memory requirement, especially for WebKit helpers.

| Journey and search | Original vertices | Replay vertices | Reduction in GPU geometry |
| --- | ---: | ---: | ---: |
| Germany Berlin–Munich, bidirectional | 32,951,556 | 17,489,072 | 47% |
| Germany Berlin–Munich, A* | 32,951,556 | 5,691,284 | 83% |
| UK London–Edinburgh, bidirectional | 23,678,988 | 18,724,648 | 21% |
| UK London–Edinburgh, A* | 23,678,988 | 11,184,490 | 53% |

These are retained replay vertex counts, not physical-device RAM measurements. During playback, temporal draw ranges reduce submission further; viewport culling can reduce it again. Searches covering most roads benefit less from filtering.

The normal US preview retains 697,100,668 bytes of compressed source drawing instead of 2,713,507,848 expanded bytes, while preserving all 226,125,654 source vertices. Bidirectional San Francisco–New York uploads 200,941,440 replay vertices. Expanded drawing attributes retain zero CPU bytes after upload. A zoom test reduced actual submitted vertices from 200,941,440 to 186,008,082; the existing chunks have broad bounds, so finer spatial packaging could improve culling considerably. See [application evidence](ui-proof.json) and [image](ui-proof.png). Complete graph and replay event storage remain large; paged event textures, finer spatial packaging and loading only visible GPU chunks are not implemented by this change. The US remains an unpublished local experiment.

## Validation and reproduction

`npm run check` passed with 106 tests. The full Chromium/mobile-WebKit browser suite passed 64 tests; two new context-restoration tests passed after the final cleanup change. UK and Germany each passed bidirectional, A*, repeated bidirectional, forward/backward seeking and forced context restoration with no console, page or WebGL errors, zero retained expanded drawing attributes, identical repeated traces and matching shortest-route costs. See [Germany evidence](germany-final.json), [UK evidence](uk-final.json), [check log](app-check.log), [browser log](browser.log), and [restoration log](context-browser.log). Touch WebKit runs on this desktop do not reproduce physical iPhone memory termination; a phone retest remains necessary.

The implementation and file hashes are recorded in [patch](implementation.patch) and [context](context.json). Pure tests cover both-front visibility, arbitrary seeks, exact segment preservation, empty searches, and integer road IDs beyond Float32 precision. US guard/texture-width adaptations remain isolated from the production app.

From a built app checkout:

```sh
node scripts/data/mobile-memory-proof.mjs '' .cache/germany-replay.json
PFAD_PROOF_COUNTRY=uk node scripts/data/mobile-memory-proof.mjs '' .cache/uk-replay.json
```

The local optimized US preview is served from `.cache/replay-optimization/release-tree` by `node ../serve-preview.mjs`, at port 4218. It requires the retained graph on External Stick; StudioData is no longer required. No country data was refreshed for this optimization.
