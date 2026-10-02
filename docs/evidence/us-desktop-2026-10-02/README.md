# Whole-US desktop feasibility

The complete US road graph loaded, searched and replayed without crashes in Chromium Metal and desktop WebKit on an Apple M4 Max with 36 GiB RAM. Computation is viable on this machine; full-detail national replay is visibly slow, averaging roughly 14 fps. This is an isolated experiment, not a published country release or a phone qualification.

| Measurement | Result |
| --- | --- |
| Browser graph and drawing download | 800,026,269 bytes (800 MB decimal) |
| Routing nodes | 53,308,658 |
| Physical edges / directed arcs | 67,107,295 / 127,122,119 |
| Drawing vertices | 226,125,654 |
| Local load, Chromium / WebKit | 12.5 s / 8.4 s |
| Coast-to-coast searches | 7.8–20.9 s |
| Full-detail replay | 13.8–14.5 fps |

Each browser ran San Francisco–New York bidirectional twice, A*, Dijkstra, and Seattle–Miami bidirectional, with 15-second replays and forward/backward seeks. Repeated searches and both browsers produced identical trace hashes. All three algorithms agreed on the San Francisco–New York distance (4,600.875 km). Geometry coverage matched the manifest, route costs were checked, and no page, console, crash or WebGL errors occurred. See [raw measurements](desktop-report.json), [Chromium image](chromium-metal.png), and [WebKit image](webkit-desktop.png).

The benchmark used a 1440×900 viewport at DPR 1 and local file serving: internet transfer time is additional. WebKit was the Playwright desktop engine, not the Safari application or a physical iPhone. Chromium's sampled process-tree RSS reached 8.70 GB; this is not an exact total memory requirement and does not account reliably for all GPU allocations. WebKit's helper processes escaped the process-tree sampler, so its reported RSS must not be used as a memory estimate.

## Data and compiler

Source: Geofabrik `us-260929.osm.pbf`, timestamp `2026-09-29T20:22:51Z`, 12,175,192,796 bytes. SHA-256: `447809e1e128cef6ef70b02234b4ed741c4831798119095d460f64d59b83971d`. The [source record](source.json) and [manifest](manifest.json) preserve provenance and checksums. Manifest identity: `b72d1c0f671afad5af6963fd273a012b5374feaf79aabcf85b37758662a8826b`.

The streaming compiler retains the existing `road-connectivity-distance-v1` profile and simplification. It streams packaging and uses a disk-backed coordinate index, but its national reference counter still grows with the source; it is not constant-memory compilation. The final build took 3 h 26 m, excluding initial source hashing, with sampled compiler RSS up to 13.52 GB, including mapped pages. [Build report](build-report.json), [memory evidence](compiler-memory.json), and [Swiss parity evidence](swiss-parity.json) are retained. Selected-way counts matched between survey and packaging. Luxembourg chunks matched exactly; Swiss decoded chunks and source evidence matched the shipped data (legacy gzip header differences changed compressed identities).

The profile records rather than applies turn restrictions, barriers and conditional access, as in the existing v1 data. This experiment tests PFAD's road-connectivity study, not navigation accuracy. Optional source evidence is retained separately and is excluded from the browser download above. OSM-derived data remains subject to ODbL and OpenStreetMap attribution.

## Isolated application

The experiment starts from `84f7bb4497f2545e6b3b8fce074e7091917fbbf6`. [The patch](experiment.patch) raises capacity limits, uses integer road IDs beyond Float32's exact-integer range, and widens event textures to 4096 pixels. The US needs 16,384 texture rows, the tested GPUs' maximum. CPU geometry retention and normal replay remain intact. All 100 tests and the complete `npm run check` passed; see [check log](check.log) and [preview check log](preview-check.log).

Full national geometry is processed every frame; reducing drawing work by viewport or detail level is a plausible next step, but was not tested here. Search topology must remain complete.

The ordinary application UI also loaded and computed the US route without browser errors: [UI evidence](ui-proof.json), [image](ui-proof.png). The experimental country entry is injected only by the local preview server; the main application and published catalogue are unchanged. Outlines and ambient mode were not qualified in this experiment.

## Local reproduction

The retained graph is on External Stick:

```text
/Volumes/External Stick/motionstudies/pfad/.cache/us-desktop/countries/us-20260929-b72d1c0f671a/manifest.json
```

The isolated checkout is `.cache/us-desktop/release-tree`. Run `node scripts/data/desktop-country-proof.mjs <manifest-path> <output-directory>` from that checkout for the benchmark. The saved context, changes and patch describe its adaptations. The root repository contains the reusable compiler and benchmark scripts.

For the application preview, run `node ../serve-preview.mjs` from the isolated checkout, then open:

```text
http://127.0.0.1:4216/?country=us&from=san-francisco&to=new-york&algorithm=bidirectional&duration=15
```

The preview requires External Stick. StudioData accelerated compilation, but its temporary source/index cache is no longer needed for the preview; unplugging StudioData does not remove the retained graph. Neither the graph nor application adaptations have been deployed.
