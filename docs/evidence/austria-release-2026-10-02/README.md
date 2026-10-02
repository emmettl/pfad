# Austria release · 2 October 2026

Austria is selected in the catalogue with Vienna–Innsbruck as its
opening study, twenty authored places, and independent border/lake references.
The immutable data is published separately; the app catalogue still requires
an application release. Switzerland remains bundled and default.

| Measure | Value |
| --- | ---: |
| Opening road bytes | 23,349,292 |
| Routing nodes | 1,736,661 |
| Physical road edges | 1,932,755 |
| Directed arcs | 3,731,957 |
| Drawing vertices | 6,290,704 |
| Outline layer bytes | 16,822 |

[Source config](source-config.json) pins the dated Geofabrik extract, provider
MD5, measured SHA-256, exact byte count and PBF replication timestamp.
[Road manifest](manifest.json) identifies `at-20260930-f66d15dd279a`,
compiler `pfad-study-compiler/3` and profile `road-connectivity-distance-v1`.
[Outline manifest](geography-manifest.json) identifies
`geo-at-20261002-41fbae937a33`: one Natural Earth border ring and five lake
features. These generalized reference layers never enter routing.

The [ambient audit](ambient-audit.json) accepts sixty real journeys in 65
attempts: ten regional, 23 interregional and 27 national. It covers all twenty
places and all four exact shortest-distance algorithms, with route adjacency,
direction and centimetre cost sums checked. Greedy and territory modes are
covered separately by the full application UI proof.

[Manual endpoint validation](manual-endpoints.json) checks all nineteen other
places both to and from Vienna. Vienna’s original pedestrian-centre coordinate
snapped to a directed dead end; the authored point is now near a connected city
centre road. No graph edges were added or removed to resolve this.

[National replay](replay-report.json) loads every verified road and drawing
chunk in Chromium Metal and desktop WebKit at a phone viewport. Bregenz–Vienna
is 660.51955 km for Dijkstra, bidirectional Dijkstra and A*. Repeated Dijkstra
trace checksums agree in both browsers, and all runs report zero WebGL errors.
The harness prepares drawing asynchronously and records both complete source
drawing vertices and the subset submitted for the replay frame.

[Local-data UI proof](browser-context.json) checks country switching, the three
manual modes, seeking, shared-link reload, outline toggling, eight real ambient
studies, an automatic transition and return to Switzerland. The proof serves
only the exact local candidate road/outline bytes at their eventual public
addresses. Screenshots show [outlines](outlines-phone.png) and
[ambient](ambient-phone.png).

[Hosted-data UI proof](public-browser-context.json) repeats the same complete
application journey against the publicly delivered immutable graph and outlines.
[Road delivery](delivery.json) verifies all 39 objects; [outline delivery](geography-delivery.json)
verifies all three objects, including CORS, immutable caching and exact bytes.
Publication records are [roads](publication.json) and [outlines](geography-publication.json).

`npm run check` passes typechecking, lint, package boundaries, 155 unit tests,
production build and artifact budget checks. The complete browser suite passes
all 64 Chromium/touch-WebKit tests against the finished build, on a fresh preview
server. An earlier run was invalidated by concurrent rebuilding of its served
`dist`; the clean rerun is the regression result. Physical-phone stability remains
unverified. Existing unrelated compiler/profile and renderer work was retained
in the shared workspace; this evidence describes that checkout, not an isolated
Austria-only app artifact.

Before committing, the Austria-only candidate on `d51b29c` also passed
`npm run check` (106 committed unit tests and a 28,950,977-byte artifact), with
unrelated profile work excluded. Its [isolated hosted-data UI proof](isolated-browser-context.json)
repeats all country, replay, outline, shared-link and ambient checks successfully.
