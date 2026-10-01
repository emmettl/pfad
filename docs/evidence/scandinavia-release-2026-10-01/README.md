# Scandinavia release · 1 October 2026

Norway, Sweden and Denmark form one complete road graph, with independently
hosted joined coastline and lake outlines. Switzerland remains the bundled
default. The app's Scandinavia acknowledgement reports a 77.9 MB download and
unverified physical-phone stability.

| Measure | Selected release |
| --- | --- |
| Road dataset | `sc-20260930-0718a55b5352` |
| Road download | 77,858,993 bytes; 116 bounded chunks |
| Optional source evidence | 30,072,766 bytes |
| Routing nodes / physical edges | 5,547,443 / 6,144,949 |
| Directed arcs / drawing vertices | 11,920,666 / 22,790,620 |
| Outline release | `geo-sc-20261001-23b17eadf16e` |
| Outline layers | 414,604 bytes; 151 coastline rings |
| Snapshot | 30 September 2026, 20:22:42 UTC |

`source-config.json` pins three same-time Geofabrik PBFs (2,711,047,150 bytes
combined), with exact dated URLs, published MD5 and SHA-256. Osmium 1.19.1 /
libosmium 2.23.1 streams the union and deduplicates by object type, ID and version.
A complete-way extraction within `[3,54,33,72]` explicitly selects mainland
Scandinavia and coastal islands, excluding Svalbard and Jan Mayen. No Finland
extract is added. The existing road profile excludes ferries and retains its
turn/access limitations; no synthetic connecting edges are inserted.

`composition-proof.json` records silent merge diagnostics, zero missing way-node
references and a repeated extraction matching the pinned composite checksum.
The road manifest preserves upstream inputs and composition settings. Sources
and generated large data remain ignored; only immutable selected chunks are
published. `road-publish.json` and `road-delivery.json` cover all 118 objects,
including evidence and manifest. Geography publication and delivery reports
cover its three separate objects. All existing road and outline identities stay
selected unchanged.

`crossborder.json` checks five genuine journeys: Oslo–Stockholm,
Oslo–Copenhagen, Malmö–Copenhagen (Øresund), Trondheim–Östersund and
Aarhus–Stockholm. Dijkstra, bidirectional Dijkstra and A* agree on exact cost;
route adjacency, one-way direction and centimetre cost sums are checked.

`ambient.json` records 60 accepted journeys in 74 attempts using the production
journey algorithms. All 29 authored places appear; distance bands have 13
regional, 22 interregional and 25 national journeys, with replay durations
25–65 seconds. Rejected proposals are recorded, never displayed as invented
searches. The pool was expanded with short-distance road pairs after the
500-selection availability test exposed exhausted regional choices.

`browser-replay.json` checks the production worker and renderer with the complete
graph on Apple M4 Max: Aarhus–Luleå, 1,742.05923 km. Both desktop Chromium/Metal
and touch WebKit return matching costs, repeated Dijkstra hashes, all 22,790,620
vertices and zero WebGL errors. The long Dijkstra trace has 21,449,141 exact
integer events; its allocation is 85,796,564 bytes. WebKit applies 30 fps / DPR 1
replay limits. These are desktop browser results, not physical iPhone evidence.
Buffer accounting excludes transient allocations, browser overhead and GPU copies.

`browser-context-local.json` checks real external downloads, Oslo–Stockholm with
three algorithms, integer replay events, native query reload, outline toggling,
eight ambient studies, a genuine automatic transition, exit and Swiss restoration.
The accompanying screenshots show the selected context and ambient presentation.

Code remains MIT; OSM-derived graph/evidence retains ODbL attribution.
Natural Earth geographic context is public domain and prepared with pinned
Shapely 2.1.2 before simplification to remove the Norway–Sweden internal border.
