# Southern Africa combined-area feasibility

The complete ten-country union fits PFAD's existing capacity guards: **80,335,965
opening bytes (80.3 MB decimal)**, **4,667,431 routing nodes**, and **6,166,826
physical edges**. The countries are South Africa, Namibia, Botswana, Lesotho,
Eswatini, Zimbabwe, Zambia, Mozambique, Malawi and Angola. This is an ignored
local experiment, not a selected or published country release.

| Measurement | Southern Africa | UK | Germany |
| --- | ---: | ---: | ---: |
| Opening road MB, decimal | 80.336 | 92.375 | 140.876 |
| Routing nodes | 4,667,431 | 7,366,915 | 10,488,625 |
| Physical edges | 6,166,826 | 8,209,041 | 11,974,914 |
| Drawing vertices | 28,170,226 | 23,678,988 | 32,951,556 |

The union has 11,991,687 directed arcs and retains 1,619,841.997 km of physical
motor roads, counting each edge once. The largest weak component contains
98.659% of routing nodes; there are 11,800 weak components. Weak connectivity
ignores one-way direction and does not establish navigability.

Nine directed journeys from Pretoria to Windhoek, Gaborone, Maseru, Mbabane,
Harare, Lusaka, Maputo, Lilongwe and Luanda establish real road connectivity
across all ten countries. A*, Dijkstra and bidirectional Dijkstra agree on exact
integer-centimetre cost for each journey. Every route edge passes adjacency,
one-way direction and cost-sum checks; snaps are within 2 km. See
[audit](audit.json) for coordinates, algorithm versions, deterministic tie-breaking,
trace hashes and source identity. These journeys demonstrate country connectivity,
not every individual border crossing or every disconnected component.

## Desktop browser verification

Chromium Metal and desktop WebKit each loaded the complete topology and drawing,
including every geometry vertex and exact road ID. Local opening took 0.973 s
and 0.981 s respectively. Each ran Cape Town–Luanda bidirectional Dijkstra twice,
A*, Dijkstra, and Cape Town–Lilongwe bidirectional Dijkstra, with a 15-second
replay and forward/backward seeks after each search. All runs passed without
page, console, crash or WebGL errors. Repeated traces match, and all five
corresponding trace hashes match across browsers. Cape Town–Luanda is
3,384.92642 km under this shortest-distance profile.

See [desktop measurements](desktop-report.json) for hardware, browser versions,
search and replay timings, resource observations and deterministic trace hashes.
These are local desktop checks on an Apple M4 Max with 36 GiB RAM, 1440×900 at
DPR 1; network download latency is additional. Playwright WebKit does not qualify
native Safari or physical phones. The measurements use the complete expanded
drawing; resource observations are approximate process-tree samples, not a
guaranteed device memory requirement.

The archived local browser harness updates the older shared harness's seek
assertion to use `replayFrame`: the current presentation reserves its final
interval for route reveal, so search events reach completion before presentation
progress reaches one. No application timing or renderer code was changed.

Measured searches took 0.113–1.011 seconds; all ten replays averaged
59.75–60.06 fps. The ten-country area is below the UK in topology and download
size, and between the UK and Germany in drawing vertices. This supports a
combined desktop study without raising capacity guards. Tanzania and the newer
enforced motorcar profile have not been measured by this experiment.

All ten Geofabrik snapshots are dated 2 October 2026 and share replication
timestamp `2026-10-02T20:21:34Z`. Every input was verified against the provider's
MD5 and independently pinned by SHA-256. Osmium 1.19.1 / libosmium 2.23.1 merges
whole extracts by OSM object identity before compilation, with no bounding-box
clip and no concatenation of separately compiled graphs. The deduplicated union
is 1,630,312,666 bytes with SHA-256
`751af15ca503225787fb8b2480f38e052fcaa2e61724581794cfca48baf45e17`.
`osmium check-refs` found zero missing way-node references. Source details and
all input checksums are in [source.json](source.json).

The [manifest](manifest.json) pins streaming compiler
`pfad-study-streaming-compiler/1`, profile `road-connectivity-distance-v1`,
projection, chunks, drawing tolerance and identity
`d8bd464dd23e` (full identity in the manifest). Topology, direction and original
road lengths remain distinct from 5 m simplified drawing. The existing basic
access profile excludes tracks and ferries; restrictions, barriers and conditional
access remain source evidence rather than enforced navigation rules. This does
not size the newer enforced motorcar profile. OSM-derived data remains ODbL with
© OpenStreetMap contributors attribution.

## Reproduction

Copy the archived experiment scripts into `.cache/southern-africa/` and run from
the repository root with Python 3.14, the project's installed Python dependencies,
Osmium 1.19.1 / libosmium 2.23.1 and Node 24 or later. Acquisition is a manual
dated download; it never follows `latest`. The archived `source.json` is the
authoritative input pin and must be compared with the newly acquired record.

```sh
.cache/uk-python/bin/python .cache/southern-africa/acquire.py
.cache/uk-python/bin/python .cache/southern-africa/build.py
node --max-old-space-size=8192 .cache/southern-africa/audit.mjs \
  .cache/southern-africa/packaged/southern-africa-20261002-d8bd464dd23e/manifest.json
node .cache/southern-africa/desktop-proof.mjs \
  .cache/southern-africa/packaged/southern-africa-20261002-d8bd464dd23e/manifest.json \
  .cache/southern-africa/browser-verified .cache/southern-africa/journeys.json
```

[Build report](build-report.json) records counts and compiler duration;
[tooling hashes](tooling.json) capture the existing compiler and search sources
used in this working checkout. Graph chunks and source PBFs remain in ignored
`.cache/southern-africa/`.
