# Manual country releases

Switzerland remains bundled and selected by default. The other selected immutable
releases are hosted independently on Cloudflare R2. UK and Scandinavia require a
large-download acknowledgement on first use, remembered per country/browser/site;
the smaller releases open on selection.
No country source is acquired by ordinary builds, CI or browser page requests.

## Selected catalogue

Road downloads below are decimal MB for complete topology and drawing, excluding
optional source evidence, outlines and music. Source identity, exact bytes and
coverage are retained in each immutable manifest.

| ID | Study | Road MB | Source date | Coverage |
| --- | --- | ---: | --- | --- |
| `ch` | Switzerland | 15.867 | 29 Sep 2026 | Swiss Geofabrik extract; bundled default |
| `uk` | United Kingdom | 92.375 | 29 Sep 2026 | UK extract; ferry-only regions remain disconnected |
| `is` | Iceland | 1.492 | 30 Sep 2026 | Iceland extract |
| `nz` | New Zealand | 9.272 | 30 Sep 2026 | New Zealand extract; ambient separates the two main islands |
| `lu` | Luxembourg | 0.966 | 30 Sep 2026 | Luxembourg extract |
| `nl` | Netherlands | 22.158 | 30 Sep 2026 | European Netherlands extract |
| `ie` | Ireland | 20.411 | 30 Sep 2026 | Whole island, including Northern Ireland |
| `sc` | Scandinavia | 77.859 | 30 Sep 2026 | Norway, Sweden and Denmark; mainland and coastal islands |

Each study has a versioned ambient pool and independently pinned geographic
references. Iceland and Luxembourg's selected lake source has no features;
no lakes are invented. All studies retain [the current connectivity-profile limits](PROFILE.md).
Phone support, especially for larger graphs, remains unvalidated. New candidates
are not selected releases until complete-graph validation and catalogue publication.

`data/countries/<id>.json` pins source URL/date/bytes/SHA-256, dataset prefix and
drawing projection. Country IDs are short lowercase codes. `src/countries.ts`
selects immutable manifest URLs and identities, places, source-date copy,
geographic references and the large-download notice. Add a country by supplying
both records and validating that country's complete graph. There is no promise
that arbitrarily large countries fit the current browser budget.

## Compile and verify

Use Python 3.11+ with the pinned requirements and Node 24+. All large outputs
stay in ignored `.cache/`. Choose the exact dated source and checksum explicitly.

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r scripts/data/requirements.txt
python scripts/data/build-country.py uk
# To reuse a previously verified sizing proof:
python scripts/data/build-country.py uk --reuse-sizing .cache/uk-sizing
```

The build verifies source identity, sizing graph, drawing geometry and immutable
outputs. It does not alter `public/data/pfad-manifest.json`. Rebuilding Switzerland
through this new path creates a separate candidate; it never switches the current
bundled Swiss release. Sources/evidence keep OpenStreetMap attribution and ODbL.

```sh
python scripts/data/publish-country.py .cache/countries/<dataset-id> --dry-run
node scripts/data/national-proof.mjs \
  .cache/countries/<dataset-id>/manifest.json .cache/<country>-proof
npm run check
PFAD_PREVIEW_PORT=4190 npm run test:browser -- --workers=1
```

The UK defaults use Land’s End–John o’ Groats. For another country, pass a
JSON file containing `start` and `goal` (name/lon/lat) as the third harness
argument. The full-graph harness checks deterministic traces, costs for Dijkstra,
bidirectional Dijkstra and A*, all drawing vertices and WebGL errors. Desktop
WebKit at a phone viewport does not establish physical-phone support. Inspect
national bounds, close zoom, default endpoint pairs, disconnected islands and
source coverage separately. Ferries, turn restrictions and conditional rules
retain the current connectivity-profile limitations.

Current limits are 10m nodes, 16m edges, 32m directed arcs, 64m drawing vertices
and 256 MiB downloaded road chunks, with bounded individual decoded chunks.
These are allocation guards, not a guarantee that every device can load them.
The UK selector requires explicit confirmation on first use of its 93 MB download
and approximately 1–2 GB browser-memory requirement, plus graphics memory.
Acceptance is remembered per country in local storage for this site; later selections and
shared links open directly. Cancelling does not save acceptance. Graphs
remain complete: missing chunks prevent searching. Switching countries terminates
the old worker and disposes its map, drawing arrays and GPU resources. Scandinavia
also carries a large-download notice (77.9 MB in the UI) and uses the same
acknowledgement mechanism. If storage is blocked, acknowledgement lasts for the
current page session. Large graphs on coarse-pointer devices use the 30 fps / pixel
ratio 1 rendering cap; this is mitigation, not a physical-phone certification.

## Publish and select

After validation and explicit selection of a release, use an API token with R2
read/write permission, or explicitly reuse the host Wrangler login. The bucket
is `pfad-data`. Refresh Wrangler OAuth with `wrangler whoami` if needed.

```sh
python scripts/data/publish-country.py .cache/countries/<dataset-id> --wrangler-auth
# Alternatively supply CLOUDFLARE_API_TOKEN through the environment.
python scripts/data/publish-country.py .cache/countries/<dataset-id> \
  --verify-url https://motionstudies.app/pfad-data
```

Every chunk and optional evidence file is verified before upload. Existing keys
are checked byte-for-byte and cannot be replaced by this publisher. Chunks upload
first; the manifest uploads only after all transfers succeed. A failure leaves
unreferenced objects, with no published manifest for a partial graph. Retry the
same directory to resume safely. Verify all objects through the public Worker,
then pin the URL/identity in the app catalogue and release the tested app through
the existing Pages pipeline. Cloudflare receives that exact successful artifact.

The UK release is `uk-20260929-0555cf638ba1`: 92,374,715 opening bytes and
42,873,492 optional evidence bytes. Its identity is
`0555cf638ba1cc246e741531c406e9a32a651b3c75b2a842f77f2fdbdfe7f909`.

Refreshes always create a new dated/content-identified directory. Compare source
coverage, graph counts, canonical routes and resource use before selecting it.
Rollback selects an earlier immutable catalogue entry/app artifact. Retain every
release needed by published recordings; remove obsolete, unreferenced releases
only after explicit review. No automatic lifecycle deletion or data refresh is
configured. Swiss migration to R2 is deliberately deferred.

## UK geographic context and ambient journeys

UK uses the same optional faint outline styling as Switzerland. Its pinned Natural Earth 1:10m country and global/European lakes references supply 57 coastline/border rings and 14 lake polygons (including unnamed features). This is a generalized reference layer, not a comprehensive inventory of UK lakes or a routing input. Sources, SHA-256 identities and preparation tolerances are recorded in `data/geography-sources.json`. `npm run data:geography` verifies existing assets or manually prepares missing ones from pinned sources; the raw inputs stay in ignored `.cache/`. UK outline assets total 93,543 bytes.

Ambient uses `uk-places/1`, with 18 Great Britain and four Northern Ireland places.
It retains the complete graph, actual-distance acceptance and the shared sequence
of four journey modes plus territory studies. Candidates remain within one authored
road region; island studies are available manually and no ferry connectivity is
invented. See [AMBIENT.md](AMBIENT.md) for the current selectors and pacing.

## Four-country generalization proof

The four 30 September 2026 extracts use the same compiler, loader, algorithms,
renderer and publication pipeline. Only New Zealand's drawing needs optional
`longitudeWrapping: "centre/1"`; its original OSM coordinates and topology remain
unchanged. Picking converts wrapped drawing longitude back to EPSG:4326. Compiler
`pfad-study-compiler/3` records this new projection capability; existing Swiss/UK
release bytes and identities remain unchanged.

| Country | Road download (decimal MB) | Nodes | Edges | Drawing vertices |
| --- | ---: | ---: | ---: | ---: |
| Iceland | 1.492 | 97,917 | 110,561 | 476,660 |
| Netherlands (European extract) | 22.158 | 1,794,621 | 2,141,404 | 5,572,870 |
| New Zealand | 9.272 | 632,564 | 719,433 | 3,046,354 |
| Luxembourg | 0.966 | 71,628 | 83,662 | 259,166 |

These releases are stored outside the app artifact. Each includes separately
published optional OSM evidence. The 1.4 GB Netherlands source illustrates why
source PBF size alone is not a browser feasibility measure.

`data/geography-countries.json` selects Natural Earth ADMIN names, coverage bounds,
reference latitudes and optional tolerances/wrapping. Run
`python3 scripts/data/prepare-country-geography.py <id>` against the verified
cached sources to produce context assets and update their checksum registry.
The Netherlands outline covers its European extract. Iceland and Luxembourg
have borders only: this pinned Natural Earth lake source supplies no lake
features there. No water features are invented. New Zealand has 24 border rings
and 21 reference lake features; the source contains separate features sharing
some lake names. All outlines use the same quiet styling and never affect routing.

Authored ambient pools live in `src/ambient/pools.ts`. New Zealand separates North
and South Island road regions. Luxembourg uses 5/25/50 km selection thresholds;
the other countries preserve the original 30/100/220 km thresholds. Selector
`distance-balanced-pairs/3` exports the pool identity and distance profile with
bounded journey metadata. Actual road distance still decides acceptance.

```sh
node scripts/data/audit-ambient.mjs --country nz \
  --manifest .cache/countries/<dataset-id>/manifest.json \
  --output .cache/nz-ambient-audit.json
node scripts/data/country-browser-proof.mjs nz
# Same UI/replay checks against either published app host:
node scripts/data/country-browser-proof.mjs nz https://motionstudies.app/pfad/
```

The current audit runs sixty real journeys per country with all four journey algorithms, checks
route adjacency/directions/cost sums and permits at most five attempts per
journey. Original release reports retain the three-algorithm set tested then.
The browser proof checks manual modes, reduced-motion ambient studies, outlines,
an automatic transition and return to Switzerland. See
`docs/evidence/countries-2026-10-01/` for source identities and measured results.
Desktop WebKit is useful regression evidence, not a physical iPhone certification.

## Independent outline releases

Borders and lakes are fetched only for the selected country; none of their
coordinates are imported into the app bundle. Switzerland's road graph remains
bundled. `src/map/geography-releases.json` pins each outline manifest URL, exact
byte count and SHA-256 separately from road graph identities. The verified
manifest pins the two layer objects. Metadata inside each layer retains source
edition, source checksum, simplification and attribution. Outlines never enter
routing or algorithm events. Missing or corrupt outlines produce a visible
message and retry action; genuine road searches remain available.

After explicitly preparing/reviewing geographic references with `npm run
data:geography`, package them using the chosen manual release date:

```sh
node scripts/data/package-geography.mjs YYYYMMDD
python scripts/data/publish-country.py .cache/geography/<geo-release-id> --dry-run
python scripts/data/publish-country.py .cache/geography/<geo-release-id> --wrangler-auth
python scripts/data/publish-country.py .cache/geography/<geo-release-id> \
  --verify-url https://motionstudies.app/pfad-data
```

The package tool checks every layer against `data/geography-sources.json`, writes
ignored release candidates and updates the app's small manifest-reference registry.
Review that registry, publish and verify every referenced candidate, then run
`npm run check` and relevant browser checks before app publication. Never follow a
mutable “latest” outline. Road releases need no rebuild when geographic context
changes. The data Worker accepts only immutable graph/outline keys and GET, HEAD,
OPTIONS. It supplies CORS and immutable caching; manifests upload last and existing
objects cannot be overwritten by the publisher.

The initial six-country outline publication contained 18 objects. Border and lake
bytes per country are: CH 123,585; UK 93,543; IS 40,507; NL 16,112; NZ 83,798;
LU 4,767, plus approximately 494 bytes for each manifest. Reviewed geometry is
unchanged; Iceland and Luxembourg's pinned lake references contain no features.
Ireland and Scandinavia's later releases are documented below. The outline
toggle works as soon as verified context arrives, including while roads are
loading. Point selection reuses the country exterior for a temporary faint fill,
independently of line visibility; it does not clip or alter the road graph.

## Whole-island Ireland

Ireland (`ie`) uses Geofabrik's combined Ireland and Northern Ireland extract,
with Dublin–Belfast as its opening journey. Its immutable road release is
`ie-20260930-ec1382418ea4`: 20,410,943 opening bytes, 1,683,205 nodes and
1,810,914 edges. No routing border is inserted. Eighteen authored places across
the island form one ambient pool; the sixty-journey audit includes every place.
Five explicit cross-border studies agree on exact route cost across all three
algorithms. See [release evidence](evidence/ireland-release-2026-10-01/README.md).

Its independent outline release is `geo-ie-20261001-9b19a91c7ddb` (40,313 layer
bytes). Natural Earth's Irish polygons are joined to complete Northern Irish
polygons with pinned Shapely 2.1.2 before simplification, so the internal border
is removed from the coastline. The geographic config explicitly selects component
coverage bounds. Lakes include Lough Neagh and both Upper and Lower Lough Erne.
The package tool now discovers countries from reviewed border-source records.

## Composite regional sources

Scandinavia uses the internal study ID `sc` for Norway, Sweden and Denmark.
Its configuration pins three Geofabrik snapshots at exactly the same replication
timestamp, including each input's URL, byte length and SHA-256. The streaming
Osmium merge deduplicates objects by type, ID and version before road compilation;
concatenating compiled country graphs would disconnect shared border nodes.

The explicit extent is `[3, 54, 33, 72]` (west, south, east, north): mainland
Scandinavia and coastal islands, excluding Svalbard and Jan Mayen. Osmium's
`complete_ways` strategy retains complete ways and their referenced nodes instead
of clipping roads at the extent. Finland is not part of this selected study.
The existing motor-road profile excludes ferries, so ferry-only islands remain
separate connected components rather than receiving invented connecting edges.

After acquiring the exact input files named in the config into `.cache/osm/`,
reproduce the pinned union with Osmium 1.19.1 / libosmium 2.23.1:

```sh
python scripts/data/prepare-composite-source.py sc
python scripts/data/build-country.py sc
```

The preparation command verifies all input pins, matching snapshot dates, tool
versions, merge diagnostics, complete way references and the final source hash.
Normal acquisition refuses to download a composite source from its informational
landing-page URL. Road manifests retain every upstream input checksum and the
composition settings. The merged PBF remains ignored; browser downloads still
use bounded, independently verified chunks of one complete graph.

The selected Scandinavia road release is `sc-20260930-0718a55b5352`:
77,858,993 opening bytes across 116 verified chunks, 5,547,443 routing nodes,
6,144,949 edges and 22,790,620 drawing vertices. Its 29-place ambient pool
passed sixty real accepted journeys, including all places and all three distance
bands. Five cross-border studies agree on exact cost across Dijkstra,
bidirectional Dijkstra and A*. The long browser proof covers Aarhus–Luleå
(1,742.05923 km), repeated deterministic traces, all drawing vertices and zero
WebGL errors in Chrome and touch WebKit. Physical iPhone stability is unverified.

The independent outline release is `geo-sc-20261001-23b17eadf16e`: 414,604
layer bytes, with 151 joined coastline rings and major lakes. Source polygons
from the three countries are dissolved before simplification. This data remains
outside the app artifact. See [release evidence](evidence/scandinavia-release-2026-10-01/README.md).
