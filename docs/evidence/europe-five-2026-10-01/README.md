# Five European country releases · 1 October 2026

Poland, Italy, Spain, France and Germany use immutable, separately hosted road
chunks and Natural Earth coastline/border and lake layers. Switzerland remains
bundled and the default. Raw PBFs and large sizing intermediates use External
Stick through ignored repository cache links; external storage is not a browser
or deployment dependency.

Poland, Italy, Spain and France pin the 30 September 2026 20:22:42 UTC
snapshot. Germany uses the dated 29 September snapshot because the newer
provider file repeatedly stalled on uncached bytes. Every source preserves its
actual timestamp, dated Geofabrik URL, published MD5 and SHA-256. The road-connectivity-distance-v1 profile and
pfad-study-compiler/3 remain unchanged. Turn/access restrictions remain source
evidence rather than enforced navigation constraints; ferries remain excluded.
Italy includes Sicily and Sardinia. European Spain includes the Balearic Islands;
the source graph does not include the Canary Islands. France is metropolitan
France including Corsica. Islands receive real road components and separate
ambient regions, with no invented connections across water.

Compilation now filters irrelevant OSM objects before Python callbacks. The
node location cache precedes that filter, preserving every referenced position.
A complete Luxembourg recompilation verifies identical graph, all drawing
variants, classes, restrictions, controls, counts, compressed sizes and hashes;
see `compiler-filter-parity.json`. This is a compiler performance improvement
with byte-identical output, so no encoding or profile version changes.

Each country directory records the road manifest, source config, sizing,
independent geography manifest, sixty real ambient journeys, and national
replay evidence. Browser proofs check repeated deterministic Dijkstra traces,
equal cost across Dijkstra/bidirectional Dijkstra/A*, exact integer event
textures, the full drawing, zero WebGL errors, and the mobile 30 fps/DPR 1
budget. Production UI proofs also cover external outlines, native sharing,
eight real ambient studies including three-source territories, automatic
transitions and restoring Switzerland. These are desktop Chromium and touch
WebKit viewport checks; physical iPhone stability remains unverified.

Spanish plaza-centre pins for Madrid, Barcelona and Seville originally snapped
to directed road endpoints that could not leave those points. The curated pins
now use nearby road anchors, verified in both directions between all three
cities. The complete graph and snapping algorithm are unchanged. The fresh
sixty-journey audit includes all thirty Spanish places.

| Country | Opening MB | Routing nodes | Physical edges | Drawing vertices |
| --- | ---: | ---: | ---: | ---: |
| Poland | 59.626 | 4,586,298 | 5,150,988 | 14,769,466 |
| Italy | 85.323 | 5,740,613 | 6,915,632 | 24,655,422 |
| Spain | 59.008 | 3,885,623 | 4,989,358 | 17,261,400 |
| France | 151.882 | 10,506,139 | 12,357,600 | 42,305,096 |
| Germany | 140.876 | 10,488,625 | 11,974,914 | 32,951,556 |

## Published release

The source release is `c8144c5ab9e29593420b7832cd4ec4d0184c87c5`.
[Pages run 36872661298](https://github.com/emmettl/pfad/actions/runs/36872661298)
passed the build and both browser gates. [Cloudflare run 36873902968](https://github.com/emmettl/pfad/actions/runs/36873902968)
mirrored that exact artifact. The public receipt records 57 source files,
28,928,681 source bytes and content SHA-256
`4759f3923d32ea18d1a2166f3b2a16f8401146c495861cd263ac22a08ef5d7e5`.

Every published static file on both hosts matches the tested local artifact
byte-for-byte, including the bundled Swiss graph, fonts, code and music.
`live-artifact-verification.json` records each file's size and digest.
Every country has a `live-browser.json` covering both hosts: ten complete UI
runs and eighty real ambient studies, including territories, with no app errors.
Known Cloudflare analytics CORS failures are recorded separately by the harness.
All transferred source PBFs on External Stick also pass fresh SHA-256 checks.
The data/source dates and physical-phone caveat remain unchanged.
