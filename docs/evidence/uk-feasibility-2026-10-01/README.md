# UK browser feasibility — 1 October 2026

Archived initial experiment. The subsequent [country release](../uk-release-2026-10-01/README.md) fixes the timestamp and drawing precision limits identified here and publishes UK independently. The figures below describe the initial experiment; the current harness uses the corrected renderer.

A complete UK graph is tractable in desktop browsers with PFAD's current
connectivity profile. The measured opening download is 92.4 MB; a long Dijkstra
search takes about one second on the M4 Max, and the full national drawing
replays at approximately 60 fps. This is an experiment, not a selected edition.
The source and generated graph remain under ignored `.cache/`; the published
Swiss dataset is unchanged.

## Comparable data sizes

Both sources have the OSM timestamp 2026-09-29T20:22:51Z. Both use the same
road classes, access filter, original lengths and topology rules, and five-metre
drawing simplification. Ferries are excluded. Turn, barrier and conditional
restrictions remain evidence and are not enforced. The UK extract covers Great
Britain and Northern Ireland, with disconnected islands retained.

| Measure | Switzerland | UK | UK / CH |
| --- | ---: | ---: | ---: |
| Source PBF bytes | 547,273,092 | 2,263,470,677 | 4.14× |
| Routing nodes | 1,258,587 | 7,366,915 | 5.85× |
| Physical road edges | 1,390,206 | 8,209,041 | 5.90× |
| Directed arcs | 2,648,785 | 15,613,192 | 5.89× |
| Drawing line vertices | 4,119,930 | 23,678,988 | 5.75× |
| Opening road bytes | 15,866,559 | 92,374,715 | 5.82× |
| Optional provenance evidence bytes | 8,090,540 | 42,873,492 | 5.30× |

MB here means decimal megabytes. Source PBF size underestimates the road graph
ratio: the UK graph is nearly six times Switzerland's. The binary package has
155 verified chunks. The sizing compiler took 745 seconds; downloading and
binary packaging are additional steps.

Source identity and publisher MD5 are in [source.json](source.json).
[sizing-report.json](sizing-report.json) records intermediate JSON exports and
the unsimplified, 5 m and 15 m geometry variants.
[package-report.json](package-report.json) records the actual binary delivery
size; intermediate compressed JSON sizes are not browser opening sizes.

## Browser measurements

The harness uses the production worker, graph compiler, deterministic search
engines and RoadScene renderer. A Vite transform permits this specific larger
graph in the experiment; published manifest limits stay unchanged. Another
test-only transform audits Dijkstra's integer-to-float timestamp conversion
after the measured search loop. Swiss reference outlines are hidden. Music is
not loaded. The harness verifies route-length sums, repeated Dijkstra trace
hashes, and agreement between Dijkstra and bidirectional route costs.

The route is Land's End to John o' Groats, 1,297,497.29 metres under the declared
connectivity model. The source snaps approximately 491 m and destination 34 m.
This is shortest road distance in the recorded graph, not validated driving
navigation. Dijkstra settles 6,758,341 nodes, examines 14,426,387 arcs, and
records 28,188,014 events. Repeated runs and both browsers produce the same
integer trace hash.

| Desktop-host browser | Graph load | Dijkstra, two runs | Endpoint preparation | Bidirectional search | Playback median / p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium Metal | 1.16 s | 1.02 / 0.99 s | 0.31–0.36 s | 1.44 s | 16.7 / 16.8 ms |
| WebKit, phone-sized viewport | 3.27 s | 0.94 / 0.99 s | 0.21–0.33 s | 1.27 s | 17 / 18–19 ms |

These are M4 Max measurements over local Vite serving. Graph load ends when the
worker is ready; it does not include a completed first GPU frame or the search.
Frame samples follow two warm-up frames and advance replay from 20% to 80%
over 180 frames. Bidirectional search is slower for this long pair and records
27.5 million events, only modestly fewer than Dijkstra. There are no reported
page errors or WebGL errors. Browser texture limits here are 16,384 pixels.
See [replay-report.json](replay-report.json) for individual runs and identities.

The [Chromium screenshot](chromium-metal.png) and
[WebKit screenshot](webkit-mobile-viewport.png) show the actual two-front trace
at 80% playback. Unexamined roads and disconnected components are not visible.

## Limits exposed by the experiment

**Exact visual event timing needs a change before a UK release.** The integer
trace remains exact, but float32 event textures cannot represent every integer
above 16,777,216. This route rounds 1,540,724 first-examination timestamps on
conversion to floats. Some roads can therefore reveal one event early or late.
Integer textures or another exact encoding are required for the visual contract;
the performance result does not waive this correctness requirement.

**Memory is the main mobile question.** The worker graph arrays occupy 357.7 MB.
Road attribute arrays occupy 189.4 MB, with another 127.6 MB for retained drawing
coordinates and offsets. The Dijkstra trace adds 112.8 MB and its event texture
65.7 MB: these specified retained CPU buffers alone total about 853 MB. This
excludes transient allocations, working search labels, route ribbons, GPU copies,
browser overhead and music. Reverse adjacency adds 154.4 MB and bidirectional
playback adds a second event texture. These are buffer accounting figures, not
measured browser peak memory. Viewport/zoom drawing delivery and smaller search
allocations deserve investigation while retaining the complete routing graph.

**Drawing precision and publication budgets also need review.** The explicit UK
projection fits the national extent, but the existing signed-16-bit drawing
format gives about 22.9 m coordinate quantisation, versus 6.1 m for Switzerland.
The five-metre simplification tolerance does not imply five-metre rendered
precision. Regional drawing origins could preserve close-zoom detail. The
current two-million-node / 2.5-million-edge guards and 30 MiB full-artifact budget
do not admit this UK edition; this experiment changes neither.

**Physical phone performance remains unmeasured.** A paired iPhone 17 Pro was
available and Safari accepted a local benchmark launch, but no report returned
within five minutes during the Swiss control attempt. WebKit's desktop viewport
is not evidence of phone memory, thermal behaviour or frame pacing.

## Reproduction

Use Python 3.11 or later and the pinned requirements. Download the exact source
URL in `source.json` to `.cache/osm/united-kingdom-260929.osm.pbf`; verify its
published MD5 and recorded SHA-256. Copy `source.json` and `projection.json` from
this evidence directory into `.cache/uk-sizing/` before running:

```sh
python3 -m venv .cache/uk-python
.cache/uk-python/bin/pip install -r scripts/data/requirements.txt
.cache/uk-python/bin/python scripts/data/size-proof.py \
  --source .cache/osm/united-kingdom-260929.osm.pbf \
  --output .cache/uk-sizing --provenance .cache/uk-sizing/source.json
.cache/uk-python/bin/python scripts/data/build-study.py \
  --source .cache/osm/united-kingdom-260929.osm.pbf \
  --sizing .cache/uk-sizing --output .cache/uk-study --experiment \
  --dataset-prefix uk-20260929 --projection .cache/uk-sizing/projection.json
node scripts/data/national-proof.mjs \
  .cache/uk-study/uk-20260929-479355fe91f9/manifest.json .cache/uk-browser
```

For a physical phone, append `--phone` to the harness command, keep the phone
unlocked on the same LAN, and open the printed benchmark URL in Safari. It runs
automatically and posts its results to the Mac. The LAN page uses HTTP, so
WebCrypto is unavailable: a test adapter uploads the exact received chunk bytes
to the local host for SHA-256, then checks the returned digest in the worker.
Opening time includes those additional uploads and must not be compared with
the localhost load timings above. Trace hashing also uploads after search timing.
The local server closes after a report or a thirty-minute timeout.

Validation: `npm run check` passed; all 18 existing browser tests passed; UK
Chromium and WebKit benchmark runs passed their trace and route checks. The
timestamp audit reports a known visual correctness limit, not a passing gate
for publishing a UK edition. OSM-derived graphs remain ODbL data; MIT covers code.
