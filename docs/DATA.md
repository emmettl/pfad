# Road data and refresh policy

PFAD starts with a dated snapshot. Refreshes are manual, explicit graph releases.
There is no scheduled collector and no OSM download in CI or page requests.
A future periodic refresh can be chosen if ongoing use warrants it; the edition
does not claim live traffic, live closures or current navigation advice.

The initial feasibility source is Geofabrik’s Switzerland extract:

- URL: https://download.geofabrik.de/europe/switzerland-260929.osm.pbf
- Source data timestamp: 2026-09-29T20:22:51Z.
- Bytes: 547,273,092.
- SHA-256: `95e29e18873357b927d22daa0bfc08a35e8840079a591cd70ba24a4208b4a4dd`.
- Attribution: © OpenStreetMap contributors.
- Licence: https://www.openstreetmap.org/copyright (ODbL 1.0).

Geofabrik provides updated extracts and change files. Their availability does
not require PFAD to update with every release. Adopt a new snapshot when its
corrections or changed roads are useful, compare connectivity and canonical
routes, and publish it under a new identity. Preserve any graph required by a
published recording within an explicitly bounded archive. Do not accumulate
every intermediate snapshot indefinitely.

## Reproduce the sizing experiment

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r scripts/data/requirements.txt
npm run data:acquire
npm run data:measure
npm run data:browser
```

The acquisition command uses the fixed source above and verifies bytes and
SHA-256. Everything large is written under ignored `.cache/`. Browser proof
requires the Playwright engines installed as described in the README. The
benchmark uses a local HTTP server, not a mobile network simulation.

The compiler includes motorway through residential/service road classes, with
a preliminary motor access filter. It does not include ferries. It retains
original OSM way endpoints, node controls and turn restrictions. Five- and
fifteen-metre simplification changes visual geometry only; costs come from
original geometry. Compact coordinates are rounded to 1e-5 degrees.

Known limitations: turn, barrier and conditional rules are not enforced;
571 restriction members in the original proof referenced excluded or missing
objects and need classification; endpoint selection must handle disconnected
directed fragments. Source locations cover the Geofabrik extract, which is not
a promise of every cross-border route. None of these are solved by compression.

## Selected browser dataset

`public/data/pfad-manifest.json` selects the immutable dataset
`ch-20260929-6a17f71de78c`. Its manifest specifies source checksum and timestamp,
compiler/profile version, lengths and SHA-256 for every chunk. Total opening
road bytes: 15,866,559. The optional evidence file is 8,090,540 bytes and contains
OSM node and way IDs, tag profiles, controls and original restriction relations.
Both the delivered graph and that evidence are available in this public repo.

After the sizing experiment, package the selected snapshot explicitly:

```sh
python3 scripts/data/build-study.py --source .cache/osm/switzerland-260929.osm.pbf \
  --sizing .cache/sizing --output public/data/pfad
```

The compiler checks source and baseline graph hashes and refuses to replace an
existing dataset with different bytes. gzip output is deterministic. CI only
verifies and builds the committed record; it never fetches OSM.

The `le-columnar-deltas/1` encoding uses little-endian values inside gzip files:

- Node chunks: interleaved signed 32-bit longitude/latitude deltas at 1e-5 degree
  resolution. Deltas restart from zero per chunk; dense IDs are `start + index`.
- Edge chunks: signed 32-bit from-node deltas, signed 32-bit to-node relative to
  from, unsigned 32-bit length in centimetres, unsigned 8-bit direction and road
  class. Columns occupy 14 bytes per edge. Direction 0 is both, 1 forward, 2 reverse.
- Geometry chunks: unsigned 16-bit interior-point count per physical edge, followed
  by interleaved signed 32-bit coordinate deltas from that edge’s from-node.
  Endpoints are implicit. Five-metre simplification affects drawing only.

The worker checks all files, covers the complete graph, reconstructs directed
adjacency and drawing geometry, and enables searching only after validation.
A missing or corrupt chunk is an error, never a truncated routing network.
Projection quantisation is approximately 6.1 metres for the drawing buffers;
original edge costs and graph topology remain separate.

The first study’s endpoint preparation selects nearby main/residential roads
with incoming and outgoing connections. The destination must be reachable from
the source within the recorded directed graph and within two kilometres of the
requested point. Preparation time is separate from Dijkstra time. This keeps
small disconnected fragments from making town-centre examples misleading;
it does not establish turn-rule legality or solve cross-border coverage.

MIT covers application code only. The OSM-derived files retain ODbL attribution
and database obligations. The earlier compact JSON experiment remapped some
restriction references; this delivery format instead publishes the original
restriction evidence separately and does not claim to apply it.

Files end in `.gz.bin` to keep the gzip container opaque to static servers.
The worker explicitly unpacks gzip after verifying its stored-byte checksum.

## Geographic reference outlines

The optional outlines use reviewed geographic reference assets prepared for
Gleislicht, pinned to its published commit `5910d68b2eb4c78376007b42639d1c4a17986b7b`.
PFAD contains the exact data bytes and consumes public npm contracts; it does
not import sibling application code. [The source record](../data/geography-sources.json)
retains the published URLs, byte lengths, SHA-256 and preparation commits.
Run `npm run data:geography` to verify or manually reacquire those exact assets.
The build and CI do not download or refresh them.

- National border: swissBOUNDARIES3D, January 2026; three closed rings, 476
  coordinates, generalised to 700 metres. Original source and CRS are retained
  in the asset metadata. This is a faint national-scale reference, not a cadastral boundary.
- Lakes: FOEN Vector25 reference shorelines (2007); 160 lakes with 190 rings,
  5,357 coordinates, generalised to 60 metres and minimum area 0.1 km².
  Outer shores and island rings are preserved, including complete cross-border
  lake outlines present in the source. No polygon fills, labels or river overlay.

Together they occupy 123,585 JSON bytes, bundled and compressed with the app.
They use the same projection as the roads but are independent of graph topology,
search costs and events. The renderer adds 11,280 static line vertices.

Border attribution is © swisstopo; lake attribution is © FOEN, swisstopo.
These geographic references are supplied under
[swisstopo's free-geodata terms](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices),
with source attribution in the study footer and asset metadata. They are not
relicensed under the code's MIT licence or the road graph's ODbL licence.
