# South America combined-dataset feasibility

**Eleven countries fit PFAD's existing capacity guards and passed complete-graph
desktop search and replay. All twelve exceed the current routing-node guard.**
This is local feasibility evidence; no candidate is selected or published.

The measured eleven-country union contains Argentina, Bolivia, Chile, Colombia,
Ecuador, Guyana, Paraguay, Peru, Suriname, Uruguay and Venezuela. Brazil is
excluded. This establishes eleven as the maximum country count under unchanged
current guards: there are twelve sovereign countries, and the complete continental
extract already exceeds the node guard during partial compilation. It does not
establish that every possible eleven-country combination fits.

| Measurement | Eleven-country union | Existing guard |
| --- | ---: | ---: |
| Routing nodes | 8,046,874 | 11,000,000 |
| Physical edges | 10,932,322 | 16,000,000 |
| Directed arcs | 20,165,377 | 32,000,000 |
| Drawing vertices | 50,169,266 | 64,000,000 |
| Road opening download | 144,249,082 bytes | 268,435,456 bytes |

The opening download is 144.25 MB decimal, excluding optional source evidence,
outlines and music. It is similar to Germany's download but has more drawing
vertices than the currently selected France release. The complete graph remains
chunked; no roads are removed to fit these guards.

## Connected coverage

Eight directed journeys from Buenos Aires reach La Paz, Santiago, Bogotá, Quito,
Asunción, Lima, Montevideo and Caracas. All three algorithms—A*, Dijkstra and
bidirectional Dijkstra—agree on exact integer-centimetre costs. Each route passes
adjacency, one-way direction and exact cost-sum checks, and both endpoint snaps
are within 2 km. [Audit](audit.json) retains source identity, algorithm versions,
tie-breaking and deterministic trace hashes.

This demonstrates connections across nine countries: Argentina, Bolivia, Chile,
Colombia, Ecuador, Paraguay, Peru, Uruguay and Venezuela. Georgetown (Guyana)
and Paramaribo (Suriname) snap into separate weak components from Buenos Aires;
these two countries can remain in the same dataset but need component-aware
journey selection. This does not prove that every road in either country is
isolated, or audit every individual border crossing.

The largest weak component contains 7,814,203 nodes (97.109% of the union).
There are 16,823 weak components. Retained physical motor-road length is
2,673,090.622 km, counting each edge once. Weak connectivity ignores direction.
The profile excludes tracks and ferries and retains restrictions, barriers and
conditional access as evidence without enforcing them; these are computation
studies, not navigation certification. The newer enforced motorcar profile has
not been sized here.

## Desktop verification

Chromium Metal and desktop WebKit loaded every drawing vertex and exact road ID.
Local opening took 1.594 s and 1.457 s respectively. Each browser ran
Bogotá–Buenos Aires bidirectional Dijkstra twice, A*, Dijkstra, and
Montevideo–Santiago bidirectional Dijkstra, with a 15-second replay and forward
and backward seeks after every search. Repeated traces and all five corresponding
cross-browser trace hashes match. All tested algorithms agree on the long journey's
6,583.59593 km shortest-distance cost. Direction reversal explains why the
Buenos Aires–Bogotá audit has a different distance.

Searches took 0.504–1.903 s. Replay averages were 59.77–60.05 fps in Chromium
and 53.28–60.06 fps in WebKit. No page, console, crash or WebGL errors occurred.
[Desktop measurements](desktop-report.json) retain timings and resource
observations; [summary](summary.json) provides the compact results.

These are local desktop measurements on Apple M4 Max with 36 GiB RAM,
1440×900 at DPR 1, with expanded drawing. Internet download latency is additional.
Playwright WebKit does not qualify native Safari or physical phones. Process-tree
RSS observations are approximate and cannot establish total browser/GPU memory.
No application capacity guards or runtime source were changed for this experiment.

## Full continent rejection

The pinned Geofabrik South America extract is 4,132,357,038 bytes, timestamp
`2026-10-02T20:21:34Z`. Its provider MD5 was verified and its independent SHA-256
is `eb9dd33d7abf9bce3474d3106e6bab77c32bb3b138535901747ddf54d6f7f9c3`.
The complete survey retained 10,920,706 eligible ways and 133,755,274 shape nodes.
Completed edge chunks already establish at least **11,344,591 routing nodes**,
exceeding the 11-million guard. The run was then stopped to free resources.
[Lower-bound evidence](continent-lower-bound.json) and [log](continent-build.log)
record this partial result. These are lower bounds, not final continental counts.
Brazil alone and combinations retaining Brazil have not been compiled here.

## Provenance and reproduction

All eleven country extracts are dated 2 October 2026 with the same replication
timestamp. Provider MD5 and independent SHA-256 pins are in [inputs](inputs.json).
Osmium 1.19.1 / libosmium 2.23.1 merges whole extracts by OSM object identity,
without clipping or synthetic connectors. The deduplicated union is 2,016,287,248
bytes with SHA-256 `75bae6e9a7bf609ca0a5491152ae928f42401ac7b0cc94f2b36dfb0244d5a4a1`.
`osmium check-refs` reports zero missing way-node references.

[Source](source.json), [manifest](manifest.json) and [build report](build-report.json)
pin the input, `pfad-study-streaming-compiler/1`, `road-connectivity-distance-v1`,
projection, 5 m drawing simplification and graph identity. Original road lengths
and topology remain separate from simplified drawing. OSM-derived data retains
© OpenStreetMap contributors attribution and ODbL obligations. Sources and graph
chunks remain in ignored `.cache/`.

Copy the archived acquisition, preparation, audit, browser and journey scripts
into `.cache/south-america-eleven/` before running their retained relative paths.
With the existing project Python environment, Osmium and Node 24 or later:

```sh
python3 .cache/south-america-eleven/acquire.py
.cache/uk-python/bin/python .cache/south-america-eleven/build.py
node --max-old-space-size=8192 .cache/south-america-eleven/audit.mjs \
  .cache/south-america-eleven/packaged/south-america-eleven-20261002-1ee0e0599fde/manifest.json
node .cache/south-america-eleven/desktop-proof.mjs \
  .cache/south-america-eleven/packaged/south-america-eleven-20261002-1ee0e0599fde/manifest.json \
  .cache/south-america-eleven/browser .cache/south-america-eleven/journeys.json
```

Compare regenerated source pins with the archived records before using outputs.
The build refuses to replace an existing packaged release.
