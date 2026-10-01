# Sharing and exporting a study

The address bar follows requested endpoints, country, algorithm, replay duration,
outlines and camera position/zoom using readable native query parameters:

```text
https://motionstudies.app/pfad/?from=zurich&to=geneve
https://motionstudies.app/pfad/?from=basel&to=lugano&algorithm=astar&duration=15
https://motionstudies.app/pfad/?country=is&from=reykjavik&to=akureyri
```

Curated places use lowercase name slugs; map-picked points use `longitude,latitude`.
Switzerland, Dijkstra, a 30-second replay, visible outlines and the default camera
are omitted as defaults. Other settings use `country`, `algorithm`, `duration`,
`outlines=0` and `view=x,y,zoom`. Camera values keep up to six decimal places and
replay durations up to two; requested
coordinates retain their numeric precision. Custom endpoint labels, when needed,
use `from-name` or `to-name`.

Copy the URL directly, or use **Copy study link** in About this study to flush and
copy the latest settings. Updates replace the current browser-history entry at most
twice a second; replay ticks do not change the URL. Opening a link recomputes the
genuine search and automatically plays the replay from the beginning. Reduced-motion
preferences open a completed still instead, so a shared journey never waits on a
dark starting frame. Ambient mode and music still require a deliberate action. Computation
timing is measured anew; a URL does not preserve the original processor time.

Endpoint edits before Search are included. An ambient link captures
the currently accepted journey and its algorithm, not an automatically started
sequence. Candidate retries leave the previous accepted link intact. Exports
continue to describe the actual recorded search, even when picker edits are pending.

New links do not contain a replay offset or graph checksum. They use the immutable
country release selected by the edition that opens them. Exact source identity
and replay frames remain in search record exports below. Coordinates and settings
are bounded and validated; malformed or ambiguous parameters give an explicit error.

Existing `pfad-study-link/1` JSON fragments resume playback from their recorded frame;
completed frames stay complete. Reduced motion shows the completed result.
An unavailable legacy identity gives an explicit error instead of silently
substituting today's graph. Successful legacy links are rewritten to the concise
format in the address bar. A linked UK study still requires the existing
93 MB confirmation before downloading. Swiss and UK releases remain available
under their immutable published keys; preserving them is a deliberate, bounded
archive policy, not a guarantee of indefinite retention of every future release.

## Share previews

The initial HTML includes a canonical Motion Studies URL, Open Graph and X card
metadata, image dimensions/type/alternative text, icons and CreativeWork JSON-LD.
Both hosts identify `https://motionstudies.app/pfad/` as the canonical edition.
No JavaScript, graph download or sound is needed to read the metadata or image.

The 1200 × 630 card is an authored composition of the actual Zürich → Genève
Dijkstra study, captured from the production renderer at the pinned Swiss release.
Its [source record](evidence/sharing-2026-10-01/social-card.json) retains the graph,
algorithm, requested/snapped endpoints, event count, route cost and image checksum.
Road and outline attribution appears in the card. It is an edition preview shared
by all study URLs. The static hosts serve the same edition preview for every
journey; previews do not depict each linked journey individually.

The committed image has a content-hashed filename. To regenerate deliberately,
build and serve a local preview on port 4191, then run `npm run share:render`.
An optional argument selects another built local preview URL. Review the image
and source record, update image references in `index.html`, and remove the old
card only when publishing its replacement. Normal builds reuse the reviewed PNG.
The renderer uses the pinned public font assets; it does not refresh geographic data.

Metadata follows the [Open Graph protocol](https://ogp.me/) and uses a large-image
card declaration. Automated checks read the delivered HTML with JavaScript disabled,
verify asset responses, dimensions/checksums and canonical agreement, and confirm
that crawling does not load road chunks or music.

## Search record exports

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
