# Manual country releases

Switzerland remains bundled and selected by default. United Kingdom is an
additional, explicitly opened release hosted independently on Cloudflare R2.
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
