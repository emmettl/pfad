# Sharing and exporting a study

The address bar follows requested endpoints, exact graph identity and profile,
algorithm, replay duration, event progress, outlines and camera position/zoom.
Copy the URL directly, or use **Copy study link** in About this study to flush and
copy the latest frame. Updates replace the current browser-history entry at most
twice a second; they do not reload the graph or add an entry per frame. Opening a
URL recomputes the genuine search and displays that
frame paused. It does not autoplay ambient mode or enable music. Computation
timing is measured anew; a URL does not preserve the original processor time.

Endpoint edits before Search are included, with progress reset to zero because
the existing trace belongs to the previous question. An ambient link captures
the currently accepted journey and its algorithm, not an automatically started
sequence. Candidate retries leave the previous accepted link intact. Exports
continue to describe the actual recorded search, even when picker edits are pending.

Links use `pfad-study-link/1` JSON in the URL fragment. Coordinates and settings
are bounded and validated. The edition accepts only a selected, pinned country
release. An unavailable identity gives an explicit error instead of silently
substituting today's graph. A linked UK release still requires the existing
93 MB confirmation before downloading. Swiss and UK releases remain available
under their immutable published keys; preserving them is a deliberate, bounded
archive policy, not a guarantee of indefinite retention of every future release.

**Export search record** downloads `.pfad.gz`: a gzip envelope containing the
actual existing trace, route and textures, without running another search.
Exporting uses Blob parts and streaming compression rather than expanding
millions of events into JSON numbers. Only one export runs at a time.

After gzip decompression the layout is:

| Field | Encoding |
| --- | --- |
| Bytes 0–7 | ASCII `PFADREC1` |
| Bytes 8–11 | Unsigned little-endian 32-bit JSON byte length |
| Next JSON byte length bytes | UTF-8 `pfad-search-record/1` metadata |
| Remaining bytes | Binary buffers; descriptor offsets are relative to this region |

Metadata includes the full graph manifest and source checksums, profile, compiler,
algorithm and tie-break versions, requested and snapped endpoints/displacements,
cost, work counters, measured timings, heuristic and meeting records when present,
presentation settings and up to twelve ambient attempt records. Ambient metadata
retains pool/selector/cycle versions, journey number, seed, selection number, estimated and actual road
distances, acceptance and replay duration. No previous event buffers are retained.

Buffer descriptors give name, type (`uint32-le` or `uint8`), element count, byte
count and offset. Buffers start at a multiple of four within the binary region.
The absolute file offset need not be aligned: read little-endian values or copy
into an aligned buffer. Optional backward-event and A* proximity arrays are
included only when present. Event word meanings and CSR arc identity follow
[ARCHITECTURE.md](ARCHITECTURE.md) and the exact graph/compiler release.

For example, inspect an exported record with Python's standard library:

```python
import gzip, json, struct

with gzip.open('study.pfad.gz', 'rb') as handle:
    data = handle.read()
assert data[:8] == b'PFADREC1'
length, = struct.unpack_from('<I', data, 8)
record = json.loads(data[12:12 + length])
trace = record['buffers']['trace']
offset = 12 + length + trace['offset']
first_event, = struct.unpack_from('<I', data, offset)
print(record['search']['dataset'], first_event)
```

The exported trace is an existing computation recording; replaying it must not
be labelled as a new computation. It records event order, not per-operation CPU
timestamps. The soundtrack and audiovisual/video export are not included.
Road-derived recordings preserve OpenStreetMap attribution and ODbL terms in
their metadata. Importing an arbitrary file into the live edition is future work;
the documented envelope can already be inspected independently.
