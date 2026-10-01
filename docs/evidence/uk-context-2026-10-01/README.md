# UK context and ambient review

The immutable UK road release remains `uk-20260929-0555cf638ba1`.
Geographic context is separate from routing: 57 generalized coastline/border
rings and 14 lake features from pinned Natural Earth 1:10m country/global/European
lake layers. Source and output checksums, tolerances and public-domain provenance
are recorded in `data/geography-sources.json`. Both prepared assets total 93,543
bytes; raw sources remain in ignored `.cache/`. This is a reference layer, not a
complete UK lake inventory. Swiss geographic assets are unchanged.

`uk-places/1` contains 22 places, grouped into Great Britain and Northern Ireland
road regions. The selector never proposes a sea crossing. Actual graph routes
and distance-band acceptance remain mandatory. Metadata exports retain the
selected country's pool version, dataset identity and algorithm cycle.

`ambient-audit.json` covers sixty real journeys, all three algorithms and all 22
places against verified graph chunks. Sixty accepted journeys took 67 attempts:
11 regional, 24 interregional and 25 national; durations span 25–65 seconds.
Each accepted route's adjacency, direction and exact summed cost were checked.

`browser.json` records touch-enabled desktop WebKit with the complete UK graph:
all three manual search modes, outline toggle, eight consecutive reduced-motion
ambient journeys, a normal hold/fade transition after seeking to the completed
trace via End/Space, algorithm rotation, exit and return to Switzerland. It
reports no application errors and a 30 fps phone budget at pixel ratio 1.
The images show the faint geographic context and a completed ambient study.
Desktop WebKit is not physical iPhone stability or thermal evidence.

Repeat the routing audit with
`node scripts/data/audit-ambient.mjs .cache/uk-ambient-audit.json --uk`.
After building, `node scripts/data/uk-browser-proof.mjs` starts its own preview;
optional URL arguments select deployed hosts instead. `npm run data:geography`
verifies the prepared geographic assets or manually recreates missing assets
from the pinned sources.
