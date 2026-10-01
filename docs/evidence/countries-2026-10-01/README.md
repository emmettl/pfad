# Four additional country releases — 1 October 2026

All four dated Geofabrik sources were checked against published MD5 files,
SHA-256 and their PBF replication timestamp (`2026-09-30T20:22:42Z`). Each source
was compiled completely using `road-connectivity-distance-v1` and
`pfad-study-compiler/3`. Raw PBFs, sizing intermediates and graph chunks remain
in ignored `.cache/`; the selected immutable releases are published in R2.
`manifest.json` pins source, compiler, projection, counts, chunks and identity;
`publication.json` and `delivery.json` record upload and public byte verification.

| Country | Release | Opening road bytes | Accepted/attempts | Regional/interregional/national |
| --- | --- | ---: | ---: | --- |
| IS | is-20260930-ad6c30aac073 | 1,492,367 | 60/66 | 6/26/28 |
| NL | nl-20260930-40fbb64d05c2 | 22,158,494 | 60/82 | 11/21/28 |
| NZ | nz-20260930-7bbcde863f2e | 9,271,569 | 60/77 | 9/22/29 |
| LU | lu-20260930-e04927d2555c | 965,963 | 60/66 | 10/21/29 |

Each `ambient-audit.json` contains sixty accepted, genuine searches rotating
Dijkstra, bidirectional Dijkstra and A*. Route adjacency, one-way traversal and
exact integer cost sums are checked. Selection retains at most six recent pairs;
actual distance decides acceptance. Luxembourg uses 5/25/50 km bands; the others
use 30/100/220 km. New Zealand's pool keeps North and South Island pairs within
their authored road regions. No ferry connections or fictitious events exist.

`browser-replay.json` records Chromium/Metal and desktop touch WebKit opening the
complete graphs, repeating Dijkstra deterministically and comparing all three
algorithms' route costs. Every drawing vertex is loaded; event timestamps remain
integer and WebGL reports no errors. Buffer accounting is retained arrays, not
peak browser memory. These tests are not physical-phone certification.

`browser-context.json` records the built app using the live immutable dataset
URLs: three manual modes with actual results, a shared paused-frame reload,
outline toggles, eight reduced-motion ambient journeys, a real automatic
hold/fade transition after seeking the completed trace, keyboard Escape exit and return to Switzerland.
Screenshots show manual outlines and an ambient still in touch WebKit.

`nz/islands.json` verifies a 19.83344 km Waitangi–Owenga road route on Chatham
Island with equal cost in all three algorithms. The mainland-to-Chatham search
returns no route. 329 offshore nodes remain in the complete graph. Wrapped
longitude affects drawing/picking only; original graph coordinates are preserved.
Run `node scripts/data/audit-nz-islands.mjs <manifest>` to reproduce this audit.

Geographic source identities and prepared asset checksums are in
`data/geography-sources.json`. Iceland and Luxembourg have border-only context
because these pinned Natural Earth lake references supply no features there.
Netherlands geography matches its European extract. Swiss and UK data identities
and their geographic assets are unchanged.

Validation: `npm run check` passed 65 Vitest cases; all 42 Chromium/touch-WebKit
browser regression checks passed. Both engines exercise real workers, rendering,
storage, controls and audio. The app artifact is 57 files / 29,226,265 bytes.
CI stops on the first browser failure and publishes only after both engines pass.

The score check waits for ambient controls to retreat, then focuses the control
and activates it with a trusted Space key. The complete eight-case ambient group
passed; software Chromium also passed the score check.

The shared-study proof waits for country, algorithm and progress together before
reloading. Waiting for progress alone can match an earlier algorithm's URL while
the current result is still being written to the hash.

`live-browser-context.json` repeats every country UI proof on both GitHub Pages
and Cloudflare. All eight host/country combinations passed, including shared
paused replay, outlines, eight ambient journeys and an automatic transition.
`deployment.json` records the successful Pages artifact and Cloudflare delivery
receipt. Cloudflare analytics CORS errors on Pages are listed separately from
application errors; no application errors occurred. Physical iPhone testing
remains separate. This evidence-only update does not change the published app.
