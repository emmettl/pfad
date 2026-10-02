# US recording retention and search setup measurements

Measured on Apple M4 Max with 36 GiB RAM, Chromium 153.0.8010.12. An immutable
snapshot at `9197c1a` ran the existing complete US graph in a topology-only worker.
No renderer, geometry decoding, replay preparation or GPU upload ran. All sizes are
decimal MB of typed-array payload, not measured process memory. No source refresh,
search optimization or production change was made.

## Recording storage

| Distance A* journey | Retained result arrays | Per-buffer gzip | Compression | Decompression | Trace only | Packed counter kinds | Packing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SF–Sacramento | 610.4 MB | 10.2 MB | 1.19 s | 0.19 s | 6.42 MB | 0.40 MB | 2.9–3.8 ms |
| SF–New York | 1,254.0 MB | 948.6 MB | 17.72 s | 2.84 s | 649.37 MB | 40.59 MB | 238–249 ms |

Every compressed buffer was decoded and SHA-256 compared to its original. All
passed. Every packed two-bit event kind was checked against the original trace.
Repeated traces and route costs also match the previous US evidence: local trace
`2f71711b6c8bcdafcde6770bbc540cf5d19a0b8f820552f33d54730770170c7a`,
coast-to-coast `b84f210727929384632f4c1ff1ffaabe6ab633dfa07e82cbdb36ce17030b5f66`.

The dense forward event array alone is 536.9 MB; goal proximity adds 67.1 MB even
for a short route. Local gzip reduces these to 3.79 MB and 0.42 MB. Broad gzip
reduces them to 317.0 MB and 14.7 MB. The broad trace barely compresses:
649.4 MB becomes 616.4 MB and takes 9.56 s. Compressing a complete broad result
before playback would add unacceptable latency for relatively modest savings.

`countsAt` reads only the low two kind bits, with existing checkpoints. Full IDs
are required by export, but do not drive normal counters or road drawing. A small
counter index plus separately persisted complete trace blocks is therefore worth
prototyping. The full IDs cannot simply be discarded: export fidelity must remain
exact. Packed kinds save 608.8 MB of hot broad trace payload only if those full IDs
are moved out of resident memory; adding the index alone increases memory. The
experiment measures packing and exactness, not persistence throughput or recovery.

Gzip measurements use browser CompressionStream on individual buffers, sequentially.
They exclude hashes/verification, packing, disk writes and JSON/container metadata.
Blob snapshots and decompression create temporary copies; no peak-memory saving is
claimed. Production export already uses gzip; this investigates retaining compressed
storage earlier rather than introducing a new export codec.

## Search setup

| Phase | Local first query | Local repeat | Broad first query | Broad repeat |
| --- | ---: | ---: | ---: | ---: |
| Total worker computation wall | 6,296 ms | 3,333 ms | 12,069 ms | 12,350 ms |
| Snapping / index | 2,971 ms | 433 ms | 435 ms | 433 ms |
| Reverse CSR | 1,194 ms | reused | reused | reused |
| Heuristic bounds scan | 50 ms | 53 ms | 49 ms | 52 ms |
| Initial potential values | 367 ms | 373 ms | 375 ms | 383 ms |
| Feasibility arc scan | 1,444 ms | 2,158 ms | 2,115 ms | 2,133 ms |
| Correction propagation | 122 ms | 130 ms | 89 ms | 87 ms |
| Search loop (`searchMs`) | 138 ms | 172 ms | 8,932 ms | 9,161 ms |

The broad first query follows both local queries; it is **not** a cold national
query. Graph, endpoint index and reverse CSR remain in the desktop worker. Large
phone workers are disposable and do not receive these reuse benefits. Phase rows
are not exhaustive: result assembly, route-time annotation and instrumentation
fall outside some subtimers. Heuristic phases are included in algorithm wall time,
but outside `searchMs`.

Coordinate-bound caching can save only about 50 ms per A* heuristic on this US
measurement. Endpoint lookup is more promising: ~0.43 s recurring scans and ~2.97 s
cold construction. A packaged exact endpoint/component index could remove rebuilding,
but its size and connectivity guarantees need measurement. Reverse CSR packaging
could remove ~1.19 s cold work while adding download/storage. The largest recurring
setup cost is enforcing heuristic feasibility over every original directed arc:
~1.4–2.2 s. Removing that scan without proving equivalent feasible potentials risks
changing correctness or exact traces. A stronger dataset invariant or cached exact
potentials deserves a separate experiment; arbitrary search goals limit cache reuse.

## Reproduction and caveats

Copy `proof.mjs` and `setup.py` into `.cache/recording-audit/`; create
`snapshot` with `git archive 9197c1a`, symlink its node_modules to the root, then run
`python3 .cache/recording-audit/setup.py` and
`node .cache/recording-audit/proof.mjs`. It reads the existing US manifest path from
`.cache/replay-optimization/manifest-path.txt`; the retained data volume must be mounted.
Only test capacity/chunk guards are raised. Instrumentation is in
[instrumentation.patch](instrumentation.patch); raw results are [report.json](report.json).

Four searches ran sequentially, with compression after the first query of each
journey. Compression/verification may affect subsequent GC and cache behavior;
these are exploratory single-run timings, not confidence intervals. The spatial
session paused heavy proofs for this run. Earlier harness attempts failed before
search at a capacity guard or relative-URL error and produced no accepted timings.
There were no accepted-run page, worker or recording verification errors.
