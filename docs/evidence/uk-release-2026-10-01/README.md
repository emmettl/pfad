# UK country release — 1 October 2026

The complete UK connectivity graph is published independently in Cloudflare R2
through the read-only `pfad-data` Worker. Switzerland's shipped files and default
selection remain unchanged. [Procedure](../../COUNTRIES.md).

Dataset: `uk-20260929-0555cf638ba1`; source: Geofabrik's dated UK extract,
2026-09-29T20:22:51Z, SHA-256
`34553df28e9f73aa64abb029c34147dcf0650d8857f4e75254707e56ad789ab8`.
The [immutable manifest](manifest.json) contains compiler/profile, counts,
projection, ODbL attribution and all object hashes. The publisher verified all
157 public objects byte-for-byte through the Worker, including optional source
evidence. Opening roads: 92,374,715 bytes; evidence: 42,873,492 bytes.

The initial [feasibility experiment](../uk-feasibility-2026-10-01/README.md)
identified two correctness limits. This release uses exact UInt32 event textures
with integer shader comparisons, preserving events beyond 2^24, and Float32
normalised drawing positions reconstructed from source coordinates. The source
coordinates retain 1e-5 degree rounding; the five-metre shape simplification
and original road-length costs remain separate. No UK-wide 22.9 m drawing grid
is introduced. The columnar stored chunk encoding remains unchanged.

[Desktop benchmark](replay-report.json) uses the full 7,366,915-node,
8,209,041-edge, 15,613,192-arc graph and all 23,678,988 drawing vertices.
Land's End–John o' Groats costs 1,297,497.29 m for Dijkstra, bidirectional Dijkstra
and A*. Repeated Dijkstra and both desktop-host browsers produce the same trace
hash. Dijkstra records 28,188,014 events; A* records 25,123,776. Integer event
textures and WebGL checks pass. Replay median is about 16.7–17 ms on the M4 Max.
The report records individual timings, deterministic algorithm identities and
the integrated `nearby-shared-component/1` endpoint preparation.
A* bound preparation is separate from its search timing.

Memory remains the limiting mobile question. CPU graph arrays are 357.7 MB,
road attribute buffers 284.1 MB and retained edge offsets about 32.8 MB; drawing
positions are shared with attribute buffers. A long Dijkstra trace adds 112.8 MB
and an event texture 65.7 MB. Reverse adjacency, search working allocations,
transient decoding, GPU copies and a second bidirectional texture add more.
The app explicitly asks before opening the UK and states approximately 1–2 GB
browser memory plus graphics memory. Physical-phone support remains unverified;
a desktop WebKit phone viewport does not establish iPhone memory or thermals.

The model enforces lengths and one-way directions, retains source restrictions
as evidence and excludes ferries. Turn, barrier and conditional-access legality
is still R1 work. Islands and Northern Ireland may be disconnected components.
This is a shortest-distance computation study, not validated driving navigation.

Browser checks cover lazy country loading, rejection of a mismatched release,
cancellation and restoration of the Swiss worker/map. The live app check loads
London–Edinburgh through the public R2 Worker and then restores Zürich–Genève.
The original Swiss trace and route remain unchanged. App publication continues
through the same Pages artifact for both hosting providers.
