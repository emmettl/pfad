# Exact spatial replay batches

The renderer partitions examined whole road segments into spatial batches of at
most 16,384 segments. Each batch retains the existing 64 temporal buckets and
integer-event shader. Endpoint-inclusive rectangular bounds, padded by one
screen pixel, cull batches outside the orthographic viewport. No coordinates,
road IDs, topology, search events, colours, pulses, meeting lights or route
effects are approximated or changed.

Temporal bucket indices are computed once per source segment. All batches from
one bounded source chunk upload in one empty render, and expanded CPU attributes
are released after upload. Repeated searches and graphics-context restoration
still rebuild from the original lossless drawing.

## Paired measurements

The complete Germany and experimental US graphs were served locally on the host
recorded in [host.json](host.json), at 1440×900 and DPR 1. WebKit results below
compare Munich–Berlin and San Francisco–New York with bidirectional Dijkstra.
Each view replays the 20–80% event window for four seconds. Vertex figures are
averages of actual WebGL line submissions; slightly different frame schedules
explain small overview differences. Timings are observations, not device budgets.

| Graph and zoom | Original vertices/frame | Spatial vertices/frame | Reduction | Original → spatial fps |
| --- | ---: | ---: | ---: | ---: |
| Germany, overview | 8.80 million | 8.81 million | essentially unchanged | 60 → 60 |
| Germany, 4× | 8.80 million | 3.70 million | 58% | 60 → 60 |
| Germany, 12× | 8.79 million | 0.94 million | 89% | 60 → 60 |
| US, overview | 91.99 million | 92.69 million | essentially unchanged | 30 → 30 |
| US, 4× | 94.32 million | 21.94 million | 77% | 60 → 60 |
| US, 12× | 87.26 million | 9.35 million | 89% | 60 → 60 |

Chromium also preserved overview performance around 28–31 fps on the US and
60 fps on Germany. The zoomed views reached the display's 60 fps ceiling, so
the submitted-geometry reduction is the conclusive improvement; no general
overview speedup is claimed. [Paired summary](renderer-summary.json),
[Germany baseline](germany-webkit-baseline.json),
[Germany spatial](germany-webkit-spatial.json),
[US baseline](us-webkit-baseline.json), [US spatial](us-webkit-spatial.json).

Preparation increases from 0.753 to 0.917 seconds on Germany and from 4.866 to
7.821 seconds on the full US graph in WebKit. Chromium's US preparation changes
from about 6.7 to 9.8 seconds. Caching temporal buckets reduced the initial
spatial prototype's preparation by about 1.7 seconds; grouped uploads saved
another small amount. All-country GPU vertex allocation is unchanged, as is
the zero retained expanded CPU attribute storage. Physical-phone memory
stability is not established by these desktop runs.

## Exactness and visual checks

Paired Germany Dijkstra traces contain 23,512,843 events; paired US traces contain
211,895,254 events. SHA-256 traces, route costs and retained replay vertex counts
match exactly. Germany's Chromium bidirectional A* pilot also preserves all
9,147,727 events. Dataset identities and production resource guards are unchanged;
the US remains an unpublished experiment.

All **64 frame pairs are pixel-identical** within their respective browsers:
four replay positions at overview, 4× and 12× zoom in Chromium, plus those views
and two endpoint-centered 12× cameras in WebKit. These include backward seeks
and completed routes. [Germany Chromium](de-image-comparison.json),
[US Chromium](grouped-image-comparison.json),
[Germany WebKit](de-webkit-image-comparison.json),
[US WebKit](us-webkit-image-comparison.json).

Pure tests verify exact segment coverage, cross-partition endpoints, both search
fronts, arbitrary temporal seeks, coincident midpoints, empty searches and road
IDs above Float32 integer precision. The app context-restoration test now zooms
and pans before losing the context, then requires the restored camera and canvas
event index to match exactly; restored pixels permit at most one 8-bit channel
level of GPU rounding. A captured Chromium reset changed eight pixels by one
level; WebKit changed zero. This allowance applies only across GPU resets, not
to the 64 strictly identical baseline/spatial frame pairs. The complete app suite covers the existing palettes,
meeting flash, route reveal, reduced motion, repeated searches and controls.

Validation: `npm run check` passed 119 tests in the isolated integration tree
and 168 in the shared workspace. The full app run passed 67 of 68 checks; its
remaining context-restoration assertion was corrected and both browser versions
passed the focused rerun. The stale endpoint-caption assertion was also updated
to accommodate the time estimate already introduced by the preceding change.
[Integration check](validation-check.log), [workspace check](workspace-check.log),
[full app run](validation-browser.log), [restoration rerun](validation-drawing.log).

## Other avenues evaluated

- Direct integer texture fetches produced identical pixels but no measurable
  improvement over normalized nearest-neighbour sampling. The shader is unchanged.
- Spatial leaves of 4K, 16K and 64K segments were sampled before implementation.
  4K improves culling but multiplies draw calls; 64K retains substantially more
  offscreen geometry. 16K is the tested compromise. [Sampling](summary.json).
- Grouped uploads and cached temporal buckets reduce preparation overhead
  without changing the image or event semantics and are included.
- Loading only visible GPU batches could reduce residency, but would require
  bounded caching and reliable pan/seek/context-restoration loading. It is not
  implemented here. Routing partitions and shortcuts remain a separate search
  design question; this change preserves the existing real searches in full.

The exploratory `renderFinish` timing fields are not reliable GPU measurements
and are excluded from conclusions. An instrumented Chromium baseline repeat
suffered synchronization-related slowdowns and is also excluded from the timing
comparison. Ordinary playback and deterministic geometry/frame comparisons
support the reported results.

## Reproduction and provenance

[Renderer context](renderer-context.json) records baseline and integration
commits, production file hashes and test-only adaptations. The paired local
snapshots raise resource guards only for the retained experimental US release
and use an 8192-wide event texture in both variants. These adaptations are not
part of the production change. No country data is refreshed or republished.

The retained `.cache/spatial-pipeline/base` and `grouped` snapshots use installed
public package exports. With the immutable local graph files available, run:

```sh
node docs/evidence/spatial-drawing-2026-10-02/proof.mjs base de webkit bidirectional
node docs/evidence/spatial-drawing-2026-10-02/proof.mjs grouped de webkit bidirectional
node docs/evidence/spatial-drawing-2026-10-02/proof.mjs base us webkit bidirectional
node docs/evidence/spatial-drawing-2026-10-02/proof.mjs grouped us webkit bidirectional
```

The US manifest location comes from the retained local
`.cache/replay-optimization/manifest-path.txt`. Source and generated graph files
remain ignored. Saved example frames show the complete luminous rendering and
endpoint-centered road detail.
