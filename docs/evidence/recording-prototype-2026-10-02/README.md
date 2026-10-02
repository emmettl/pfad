# Exact recording blocks and endpoint latitude index prototypes

Isolated prototypes at `9197c1a`, existing complete US/Germany datasets, Apple M4
Max with 36 GiB RAM. No production source, dataset or renderer was changed. These
measurements are typed-array payload and exploratory desktop timings, not physical
phone qualification or process RSS. The spatial session paused heavy work for the
accepted runs.

## Trace storage

The prototype packs two-bit event kinds, retains existing checkpoints, writes the
complete original Uint32 trace into fixed 8 MiB browser storage blocks, then detaches
the original trace. All blocks are recovered and individually SHA-256 compared;
501 replay-counter positions are compared to the original before detachment. Complete
pre-storage trace hashes match prior evidence and repeated searches. Blocks are deleted
at the end of each proof. No gzip is applied to this high-entropy trace.

| Distance A* journey | Original trace | Hot counter index | Storage | Write | Read | Verify recovered blocks |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| US SF–Sacramento | 6.42 MB | 0.40 MB | OPFS | 6.1 ms | 2.2 ms | 2.3 ms |
| US SF–New York | 649.37 MB | 40.59 MB | OPFS | 570 ms | 217 ms | 230 ms |
| Germany Munich–Augsburg | 2.27 MB | 0.14 MB | IndexedDB | 1 ms | 1 ms | 1 ms |
| Germany Munich–Berlin | 31.45 MB | 1.97 MB | IndexedDB | 10 ms | 4 ms | 11 ms |

All stored bytes, counters and endpoint selections are exact. The broad US trace
has 78 blocks; Germany Munich–Berlin has four. Original trace buffers report zero
bytes after detachment. Broad US packing adds about a quarter-second (see raw report),
so the proposed hot trace representation removes approximately **608.8 MB** of typed
array payload with under a second of measured packing plus writing. Write timings
exclude initial block hashing, metadata preparation and the initial complete trace
hash. Browser-managed file caching is not measured: this is not an assertion that
process RAM falls by the same amount. No GPU or dense-event-array memory is removed.

Chromium uses Origin Private File System storage. The tested ephemeral WebKit
context rejects that path, so the prototype falls back to IndexedDB. IndexedDB
ArrayBuffer blocks passed; Blob storage did not pass in that context and is not
used. A simulated write failure leaves the original 4 MiB fixture trace intact.
The small fixture passes in Chromium and WebKit; failure proof passes in Chromium.

### Production integration still required

The prototype demonstrates byte ownership and I/O, not a shipped alternate
SearchResult contract. It detaches the trace only inside the isolated proof after
recording counter expectations. Production needs an explicit resident/archived trace
representation, durable block metadata and dataset identity, bounded streaming export,
quota checks, cancellation cleanup, multiple-record cleanup and unavailable-storage
fallback. App/ambient/scene event-count consumers must use the explicit recorded count;
they cannot silently read a detached array's zero length. Successful storage must
retain full event IDs for exact exports. Recovery/export must not reconstruct the
entire broad trace in memory at once. The first computing-phase peak remains unchanged
because this prototype archives after search completes. This is therefore not a
confirmed fix for a physical phone failing at that transition.

## Exact endpoint index

The index groups existing eligible node IDs into 0.02-degree latitude bands, in
ascending ID order within each band. Candidate queries include an extra band on
each side, then apply the original distance threshold, component selection and
explicit lower-node-ID distance tie-break. No nearest-neighbour approximation,
component filtering or road removal is introduced. Original component/eligibility
construction is unchanged; this prototype does not publish a prebuilt index.

| Graph / browser | Extra index | Eligible nodes | Index build | Original repeated query | Indexed repeated query |
| --- | ---: | ---: | ---: | ---: | ---: |
| US / Chromium | 129.45 MB | 32,353,369 | 300 ms | 396–424 ms | 4.2–5.2 ms |
| Germany / WebKit | 26.22 MB | 6,546,961 | 43 ms | 56–58 ms | 3 ms |

Index bytes include Uint32 node IDs and band offsets. Construction uses temporary
counts/cursors, released after filling. Existing eligibility/component arrays remain;
reported extra bytes are additional retention. A desktop worker can amortize this
across queries. A disposable phone worker cannot reuse it, so enabling it everywhere
would be an inappropriate policy without device measurements. The reference query
runs before the indexed query in each paired probe, potentially warming coordinate
pages; these are exploratory single-run values rather than randomized confidence
intervals. The first reference query also includes cold component/index construction
(3.08 s US, 492 ms Germany), and must not be compared directly to warm indexed queries.

All eight real endpoint pairs match (two journeys each, repeated). An additional
700 seeded synthetic pairs match at equator/poles, band boundaries, disconnected
components and duplicated coordinates/equal-distance ties. Search output traces remain
identical; the worker's actual search still uses the reference endpoint path after
these probes, so this is an isolated query comparison, not an integrated total-search
speed claim.

## Reproduction

The patches and scripts preserve the complete setup. Run the prior
[recording/setup audit](../recording-setup-2026-10-02/README.md) snapshot setup first,
create `.cache/endpoint-prototype/snapshot` from `git archive 9197c1a` with a root
node_modules symlink, copy `setup.py`, `proof.mjs`, `storage.txt` and fixture scripts
into `.cache/recording-prototype/`, and `endpoint-parity.mjs` into
`.cache/endpoint-prototype/parity.mjs`. Then:

```sh
python3 .cache/recording-prototype/setup.py
node .cache/endpoint-prototype/parity.mjs
node .cache/recording-prototype/small-proof.mjs
node .cache/recording-prototype/failure-proof.mjs
node .cache/recording-prototype/proof.mjs us chromium
node .cache/recording-prototype/proof.mjs de webkit
```

The US retained data volume must be mounted. Only test graph-capacity limits and
chunk-count guard are raised. Exact modifications are in [prototype.patch](prototype.patch).
The first WebKit query-URL harness attempt failed before loading and is excluded.
Raw accepted [US report](us-chromium-report.json), [Germany report](de-webkit-report.json),
[small fixture report](small-report.json) and [failure report](failure-report.json)
are saved. No accepted run reported a page/worker error or parity mismatch.
