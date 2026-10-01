# Whole-island Ireland — 1 October 2026

Ireland includes Northern Ireland. The exact Geofabrik combined extract is
`ireland-and-northern-ireland-260930.osm.pbf`: 414,098,470 bytes, published MD5
`46a3723a387e1bac4872ae0941295a66`, SHA-256
`d9fd87a83a0d646a61756f25f5c8c0be798aa535f491a141e665ee7271477a1f`, PBF replication
timestamp `2026-09-30T20:22:42Z`. The complete compiler/profile output is
`ie-20260930-ec1382418ea4`, identity
`ec1382418ea473b3c8908b102e0f2db3f3fb9493d83270db87213fcd8135c7dd`.
Opening roads total 20,410,943 bytes: 1,683,205 nodes, 1,810,914 edges,
3,532,646 directed arcs and 5,901,368 drawing vertices. Optional source evidence
is 9,383,967 bytes. All 38 road objects are published and byte-verified via R2's
public Worker. Source/intermediate/chunk files stay in ignored `.cache/`.

`crossborder.json` checks five actual journeys with all three production algorithms:
Dublin–Belfast 160.57756 km; Cork–Belfast 381.99568 km; Dublin–Derry 218.36505 km;
Letterkenny–Derry 32.08481 km; Sligo–Enniskillen 63.42918 km. Integer route cost,
adjacency and one-way traversal are checked; all algorithms agree on exact costs.
`ambient-audit.json` contains 60 accepted real journeys in 72 attempts, covering
all 18 authored places. Distance bands: regional 10, interregional 23, national 27.
The internal border imposes no artificial separation on the ambient pool.

The outline release `geo-ie-20261001-9b19a91c7ddb` is independently pinned and
published: 40,313 layer bytes plus its 494-byte manifest, three verified objects.
Natural Earth sources retain the same pinned revision and SHA-256s as previous
countries. The Irish polygons are united with complete UK polygons within the
reviewed Northern Ireland bounds, including Rathlin Island; Great Britain and
Scottish islands are excluded. A polygon union using pinned Shapely 2.1.2 precedes
simplification, removing the internal border from the coastline. GEOS version and
component bounds remain in metadata. Eight border rings and thirteen lake features
include Lough Neagh, Upper/Lower Lough Erne and Lough Corrib.

`browser-replay.json` opens every drawing vertex in Chromium/Metal and desktop
touch WebKit. Cork–Derry is 395.50596 km in all three algorithms. Repeated Dijkstra
traces agree; timestamp arrays are integer and WebGL reports no errors.
`browser-context.json` uses the built app and live immutable data: three manual
algorithms, native shared journey reload, explicit seeking of genuine events,
outlines/toggle, eight real ambient journeys, one automatic hold/fade transition,
Escape exit and return to Switzerland. Screenshots retain whole-island context.
Desktop touch WebKit is not physical iPhone testing.

No routing or rendering changes were required. Country configuration, authored
places, independent geography preparation/packaging and publication reuse the
existing tools. Generic geography preparation now supports joining reviewed
components; packaging discovers source records rather than a fixed country list.
The browser proof follows the current native journey URLs (which omit replay
position), then verifies seeking within the restored real algorithm trace.
Existing country graphs and outline payloads remain unchanged.

Validation: `npm run check` passed 75 unit cases and the complete 44-case
Chromium/touch-WebKit browser suite passed. The app artifact is 57 files /
28,874,669 bytes; country data and outlines remain separate.
