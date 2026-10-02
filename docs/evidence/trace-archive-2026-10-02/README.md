# Exact trace archiving and streaming exports

Large completed traces (at least 64 MiB) now move into verified 8 MiB IndexedDB
blocks before replay drawing preparation. Runtime state explicitly records the
original event count and a packed two-bit counter index; the resident full trace
becomes an empty array only after all blocks and provenance metadata commit.
The routing worker always returns its complete trace. Search order, graph,
algorithm version, route costs, textures and geometry remain unchanged.

If capacity, storage, cancellation or metadata commit fails, the original trace
remains resident and the study proceeds normally. Packing yields between bounded
blocks. A superseded search deletes its partial archive. Shared backing buffers
are not detached. Small traces skip archive I/O.

Exports retain `PFADREC1` and its existing exact little-endian buffer descriptors.
An archived export reads and SHA-256 verifies one bounded block at a time into the
gzip stream; it never reconstructs the full trace. Resident arrays are also streamed
in bounded slices, replacing the former combined input Blob snapshot. The resulting
compressed download Blob still occupies storage; no bounded-total-export-memory
claim is made. Damaged/missing blocks fail export rather than omit events.

Export leases defer record deletion until all active exports finish. Retired searches
remove their blocks/metadata and close their database connection. Browser locks
protect other tabs' active records during startup/next-archive abandoned-record
cleanup. Browsers without lock support skip abandoned-record sweeping; optional
storage failures never block app startup. This is session recording storage, not
an imported/reopened recording feature.

## Validation

- `npm run check`: **132 tests passed** on isolated HEAD plus owned changes.
- Full Chromium/mobile-WebKit browser suite: **70 tests passed**.
- Final abandoned-record cleanup fixture: **2 browser tests passed**, followed by **6 targeted final storage/dark-field/recovery tests**.
- Unit fixtures verify byte-identical decompressed resident/archived exports,
  counter seeks, block boundaries, corruption rejection, quota/write/commit failures,
  cancellation, superseded results, shared subarray ownership and export leases.
- Real browser storage fixtures verify two-block exports, counter positions,
  lease-safe retirement and cancellation cleanup. Startup sweeping preserves a
  live record while deleting an intentionally abandoned record.

## Complete US experiment

M4 Max, 36 GiB RAM, Chromium Metal, 1440×900 DPR1. The original unpublished US
experiment and its manifest identity `b72d1c0f671afad5af6963fd273a012b5374feaf79aabcf85b37758662a8826b`
are unchanged. Only test capacity limits, maximum chunk count and atlas width are
raised in isolated copies. No US publication or dataset refresh is included.

SF–New York distance A* retains the exact **162,342,445-event** trace:
`b84f210727929384632f4c1ff1ffaabe6ab633dfa07e82cbdb36ce17030b5f66`.
Distance remains **4,600,874.9 metres**, drawing remains **155,734,468 replay vertices**.
Both variants retain identical textures, temporal/spatial batches and source geometry.

| Measurement | Resident baseline | Archived |
| --- | ---: | ---: |
| Active full trace | 649,369,780 bytes | 0 bytes |
| Packed counter index | 0 | 40,585,612 bytes |
| Archive handover | 0 | about 0.76–0.98 s |
| Drawing preparation, first paired runs | 9.36 s | 9.68 s |
| Overview replay, first paired runs | 44.3 fps | 44.8 fps |
| 4×/12× replay, first paired runs | about 60 fps | about 59–60 fps |

The active trace payload decreases **608,784,168 bytes (93.75%)**, separately from
storage-backend caches. All 101 sampled counter positions match. Every one of
78 archived blocks was read and verified against its committed SHA-256; no events
or source IDs are dropped. The initial **20 paired camera/seek frames are pixel-identical**;
see [pixel comparison](pixel-comparison.json). Subsequent ordinary frame pairs also
match exactly. This does not claim whole-process RAM falls by the payload difference.

Overview timing varied substantially in later runs: about 13.6 fps during continuous
process sampling, 45 fps in an uninstrumented repeat and 26.9 fps in another repeat.
The spatial session independently observed substantial overview variance. All those
ordinary paired pixels match, and zoomed replay generally remains at 60 fps. These
are single exploratory runs, not a stable frame-rate guarantee or causal attribution
of the variance. Raw reports preserve the slower run as well as the initial pair.

The process-tree sampler reached **7.45 GB RSS** in the search phase. It sums sampled
browser descendant RSS, excludes the Node parent, is not a complete GPU-driver
memory account, and has no identically sampled new resident baseline. No percentage
process-memory saving is inferred. The computing-phase peak is not reduced by
archiving, which starts after the complete search result exists. No physical iPhone
memory or crash-resolution claim is made.

The no-geography US recovery proof exposed an existing clear-colour reset: Three
returned `000000` after context restoration instead of `080d10`. A minimal dataset-free
fixture reproduced it. `restoreDrawing` now reapplies the original field colour and
marks the frame dirty; no ordinary renderer settings, shader or colour changed.
A dedicated Chromium/WebKit regression checks the actual GL clear value as well as
the renderer's stored colour, without a country fill obscuring the field.

Final US recovery uses a test-only `preserveDrawingBuffer` setting for reliable
headless before/after pixel capture, matching the existing browser recovery test.
Production renderer settings remain unchanged. Earlier recovery images preserve the
pre-fix background mismatch and are not accepted as passing pixel comparisons. One
intermediate harness attempt omitted a local frame variable and is excluded. Final
recovery has **zero pixel difference** before/after reset, all 78 blocks verified,
and the original event count preserved; evidence is saved separately after the correction; ordinary
replay comparisons above use production renderer options.

## Reproduction

The proof serves an immutable source snapshot plus locally retained verified country
chunks. Copy the proof to `.cache/trace-integration/final-proof.mjs`, create
`.cache/trace-integration/us-final` from the released code with a root node_modules
symlink, apply only the existing unpublished US graph-capacity/chunk-count/atlas-width
test allowances, and use the existing manifest-path file. Then:

```sh
node .cache/trace-integration/final-proof.mjs preserved us chromium astar
PFAD_SAMPLE_RSS=1 node .cache/trace-integration/final-proof.mjs sampled us chromium astar
```

The retained data volume must be mounted. Run with no other heavy browser proofs.
`us-memory-sample.json` preserves the instrumented run; `us-baseline.json` and
`us-archived.json` preserve the initial paired replay proof. Final recovery evidence
is saved separately. Compilation/check/browser logs are retained alongside the reports.
