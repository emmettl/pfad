# Manual country releases

Switzerland remains bundled and selected by default. United Kingdom, Iceland, Netherlands, New Zealand and Luxembourg are additional
immutable releases hosted independently on Cloudflare R2. The UK requires an
explicit large-download acknowledgement; the smaller releases open on selection.
No country source is acquired by ordinary builds, CI or browser page requests.

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
The UK selector requires explicit confirmation of its 93 MB download and
approximately 1–2 GB browser-memory requirement, plus graphics memory. Graphs
remain complete: missing chunks prevent searching. Switching countries terminates
the old worker and disposes its map, drawing arrays and GPU resources.

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

Ambient uses `uk-places/1`, with 18 Great Britain and four Northern Ireland places. It retains the country’s complete published road graph, actual-distance acceptance, algorithm rotation and phone rendering budget. Candidates never cross the sea between the two road regions. Island studies remain available manually; no ferry connectivity is invented. Switzerland’s original geographic assets and pool remain unchanged.

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

The audit runs sixty real journeys per country with all three algorithms, checks
route adjacency/directions/cost sums and permits at most five attempts per
journey. The browser proof checks three manual modes, eight reduced-motion
journeys, outlines, an automatic transition and return to Switzerland. See
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

The 1 October 2026 outline releases contain 18 objects in total. Border and lake
bytes per country are: CH 123,585; UK 93,543; IS 40,507; NL 16,112; NZ 83,798;
LU 4,767, plus approximately 494 bytes for each manifest. Reviewed geometry is
unchanged; Iceland and Luxembourg's pinned lake references contain no features.

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
