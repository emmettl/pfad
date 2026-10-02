# Germany bidirectional A* memory follow-up

The author still observed a physical iPhone crash for Munich–Berlin with bidirectional A*. The earlier national phone proof covered Berlin–Munich with bidirectional Dijkstra and single-front A*, so this follow-up qualifies the reported mode and direction explicitly. Desktop WebKit completed the published version; the physical-device crash was not reproduced or conclusively diagnosed here.

## Changes

Balanced bidirectional A* previously retained both full Float64 heuristic arrays during search, despite overwriting the forward estimate with the balanced potential. Compact preparation now proves that initial integer estimates fit signed 32-bit differences. It reuses the forward buffer as an Int32 array containing twice the balanced potential and divides differences by two when calculating priorities and the stopping bound. This preserves exact half-centimetres, including odd and negative differences. Large or mixed-width estimates fall back to Float64. The backward preparation buffer is released before the main search allocations.

Owned scratch buffers are detached with `ArrayBuffer.transfer(0)` at phase boundaries when available: graph-construction cursors, snapping union ranks, heuristic correction flags/heaps, and finished search distances, predecessors, settled flags and heaps. Returned trace words, route arrays, timestamp arrays and metadata are preserved. Older engines retain normal garbage-collection behaviour; compact balanced storage still applies.

Large-phone workers now explicitly declare themselves one-shot. After snapping endpoints and compiling any reverse graph, they discard the snapping index and redundant direction/category/incoming tables. The complete directed CSR, physical endpoints/costs and reverse arcs remain intact throughout routing. Reusable desktop workers retain their graph metadata and snapping index. The window still terminates phone workers before drawing uploads, and another search reloads verified cached topology into a fresh worker. Search errors also retire one-shot workers.

For Germany's 10,488,625 nodes and 11,974,914 physical edges, balanced storage falls from 167,818,000 to 41,954,500 bytes. Phone snapping and redundant metadata account for another 118,347,453 bytes released before search. The combined reduction in retained typed-array storage is **244,210,953 bytes**. Another 314,658,750 bytes of bidirectional scratch, excluding heaps, is explicitly released before result assembly. These counts are not measurements of physical iPhone peak RAM; see [buffer accounting](buffer-accounting.json).

## Evidence

The reported Munich–Berlin bidirectional A* search produces exactly **9,147,727 events**, route distance **578,130.91 m**, and trace SHA-256 `499db21b077d114a25610c85d764bc37a515dde186d7cf446565376e66f07b8c` before and after this change. Single-front A* and repeated bidirectional A* also match their published trace hashes and route costs. Full replay, forward/backward seeks and WebGL context restoration pass with no page, console or WebGL errors. See [published baseline](baseline.json) and [optimized proof](optimized.json).

A test-only wrapper around `ArrayBuffer.transfer(0)` confirms WebKit detached 41,954,504 bytes during loading and 511,243,474 bytes across search phases, over 25 calls. This is cumulative scratch cleanup, not a peak-memory reduction. The instrumented bundle is separate from the unmodified build used for normal checks and publication. [Probe results](scratch-proof.json), [wrapper](memory-probe.js), and [probe runner](scratch-proof.mjs) retain the method.

`npm run check` passes with 112 tests, including compact half-centimetres, large/mixed-width fallback, scratch detachment snapping-index regeneration, and caller-owned reusable heuristic storage. The complete 66-test Chromium/mobile-WebKit suite passes. Integrated browser checks also cover current geographic outlines. Search/event versions and dataset identity `08358206061146a9950e97708e3f48a8c2095c537948a688f792802a59371555` remain unchanged. No OSM data was refreshed. [Context and source hashes](context.json) record the implementation.

The first repeated-route attempt was interrupted by rebuilding the local test server beneath its loaded worker URL. The saved successful proof uses an immutable build. A physical iPhone retest remains necessary.

```sh
PFAD_PROOF_FROM=munich PFAD_PROOF_TO=berlin PFAD_PROOF_MODE=bidirectional-astar \
  node scripts/data/mobile-memory-proof.mjs '' .cache/munich-berlin.json
```
