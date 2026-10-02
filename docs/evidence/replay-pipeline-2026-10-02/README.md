# Exact replay preparation and texture storage

Two changes extend the spatial drawing implementation:

- Upload event textures only for examined roads when the padded compact allocation
  is less than half the original. Drawing attributes use exact compact row indices;
  the shader, integer event values, source colours, proximity and route geometry
  remain unchanged. Broad searches reuse their original textures.
- Skip unpacking a drawing chunk only when its verified road range contains neither
  front's examination events nor a chosen route edge. The geometry layout is checked
  against the emitted vertex count. Missing or unfamiliar metadata falls back to
  decoding. This does not change graph loading or remove roads from calculation.

National texture scans yield between bounded blocks. The road-to-texture lookup is
released after geometry preparation. The original full search arrays remain intact
for recording exports and context recovery. No coordinates or events are approximated.

## Measurements

Desktop macOS, 1440 × 900, single local runs; decimal MB. These are GPU texture
payloads, not measured process memory or physical-phone memory claims.

| Search | Original event textures | Compact event textures | Reduction |
| --- | ---: | ---: | ---: |
| Germany, Munich → Berlin, bidirectional A* | 191.6 MB | 39.4 MB | 79.4% |
| US, San Francisco → Sacramento, A* | 604.0 MB | 4.2 MB | 99.3% |
| US, San Francisco → New York, A* | 604.0 MB | 604.0 MB | dense guard |

For the local US search, preparation fell from **5072 ms to 3900 ms (23%)**.
503 of 672 drawing chunks needed unpacking. The longest observed preparation timer
interval was 20 ms, against 16 ms for the baseline. This timer includes scheduling
noise and is a responsiveness indicator, not a CPU-task duration measurement.

Germany WebKit preparation was 726 ms baseline and 779 ms optimized. The texture
saving therefore has a small preparation cost on this broad guided search. Replay
remained approximately 60 fps at the tested views in both browsers. Original full
arrays are retained on the CPU; compact copies add 39.4 MB / 4.2 MB there. Temporary
road lookups allocate 47.9 MB / 268.4 MB respectively, then become unreachable.
Garbage collection and driver allocation timing are not inferred from these sizes.

## Exactness

All 60 paired final frames are pixel-identical: 20 Germany Chromium, 20 Germany
WebKit and 20 US Chromium. Views include country overview, 4× / 12× zoom, both
endpoint neighbourhoods and replay positions 0.2 / 0.5 / 0.8 / 1.0. See
[pixel-comparison.json](pixel-comparison.json).

The complete integer event traces have identical SHA-256 values:

| Search | Recorded events | Trace SHA-256 |
| --- | ---: | --- |
| Germany guided | 9,147,727 | `499db21b077d114a25610c85d764bc37a515dde186d7cf446565376e66f07b8c` |
| US local A* | 1,606,249 | `2f71711b6c8bcdafcde6770bbc540cf5d19a0b8f820552f33d54730770170c7a` |
| US coast-to-coast A* | 162,342,445 | `b84f210727929384632f4c1ff1ffaabe6ab633dfa07e82cbdb36ce17030b5f66` |

Route distances, replay vertex counts and spatial leaf counts also match. The
regression tests cover backward-only events, improvement times, source/proximity
bytes, empty searches, row padding, scan boundaries, route-only chunks and unknown
geometry layouts. Full Chromium and mobile WebKit browser checks cover controls,
repeated searches, algorithms, exports, arbitrary replay and GPU recovery.

## Other avenues evaluated

**Dedicated preparation worker.** An isolated worker used a transferred first-event
lookup and returned exact spatial buffers. All 20 Germany frames matched. Preparation
was 1437 ms versus 1359 ms; the longest measured timer interval fell from 30 to 22 ms.
It requires a temporary 48 MB lookup for Germany, about 268 MB for US-sized graphs.
This modest desktop tradeoff does not justify another production worker yet. The
prototype terminates independently of the routing worker; keeping a phone's routing
worker alive would retain the much larger graph and defeat its existing release path.

**Larger / adaptive batches.** A 32K leaf experiment halved Germany's draw calls and
saved about 90 ms preparation in one run. At 12× zoom it submitted 2.68 million
vertices/frame versus 0.94 million with 16K leaves. Both reached 60 fps on this host.
The existing 16K compromise stays. A hierarchy could choose finer leaves when zoomed,
but merging temporally ordered buffers needs additional index storage or uploads;
this experiment does not establish a benefit for that added implementation.

**Visible GPU residency.** Germany guided drawing occupies 78.8 MB of geometry;
only 23.8 MB intersects the tested 12× view. Eviction has theoretical room to save
55 MB there, but current CPU drawing attributes are deliberately released after
upload. Synchronous re-upload needs retaining those expanded buffers, adding 78.8 MB
of CPU payload, or a new compressed spatial cache. Async decompression must complete
before a camera view changes to avoid missing roads. No eviction is shipped: the
memory and pan/seek latency tradeoff needs a separate cache design and device proof.

**Calculation heap and adjacency.** A four-way heap preserved the complete broad
Germany trace (`90d65e026387126d788ed679a6b64380a7b9f607b6c0bc175f1c3e2812f850fd`),
but its 1689 ms search sat inside the binary baseline's 1603–1768 ms variation.
There is no conclusive improvement to ship. The cold guided-worker CPU profile
instead attributes approximately 740 ms of self samples to heuristic preparation,
352 ms to endpoint-index construction, 252 ms to reverse-CSR construction, and
132 ms to heap popping. These samples include snapping and heuristic preparation;
`searchMs` alone excludes some of those phases. Cached coordinate bounds, exact
spatial endpoint queries and heuristic preparation deserve focused experiments next.
No calculation ordering, heuristic rounding or event contract was changed here.

## Reproduction and limits

[proof.mjs](proof.mjs) serves immutable locally acquired country chunks and runs the
production worker and renderer from `.cache/replay-pipeline/<variant>`. Baseline
snapshots originated at `2d99a28`; final snapshots include the rendering changes
above and the separately owned GPU-recovery fix. Reports retain manifest identity,
browser version, exact trace, payload bytes, timings and drawing submissions.
`germany-guided-search.cpuprofile` is the unmodified Chromium routing profile.

US uses the unpublished experiment identified by
`.cache/replay-optimization/manifest-path.txt`. Both US variants lift only the test
manifest limits and use an 8192-wide original event atlas. None of those test guards,
US graph files or country publication changes are included in production. The normal
published country limits remain unchanged. Source OSM and generated graphs remain
in ignored caches. There are no data refreshes or CI workflow changes in this work.
