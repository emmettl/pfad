# Independent outline delivery — 1 October 2026

Six immutable geography releases retain exactly the reviewed border/lake bytes
and source metadata. Each has two JSON layers and a manifest, uploaded last.
`publication.json` records immutable R2 uploads; `delivery.json` records every
object verified byte-for-byte through the public read-only Worker. The app pins
manifest bytes/SHA-256; each verified manifest pins both layers. These releases
are independent of road graph identity, routing and event time. All road releases
are unchanged; Switzerland's roads remain bundled.

`browser-context.json` records desktop touch WebKit opening all six complete
country graphs, checking country-specific outline segments and toggling them.
The Iceland image was inspected for visible coastline and retained dark field.
Border/lake opacity is 0.18, with luminous roads still dominant. This is desktop
WebKit at a phone viewport, not a physical iPhone assertion.

Failures produce a visible outline-specific message. Retrying downloads only
geographic context and preserves the current search/replay. Country switches
abort pending outline requests; late results cannot attach to a new scene.

The app has no imports of border/lake coordinates. Review source assets remain
in the repository for offline preparation and validation, but are excluded from
the build. Outline releases are manual; no mutable aliases or scheduled refreshes.

Validation: `npm run check` passed 69 unit tests; all 44 Chromium/touch-WebKit
browser tests passed. The app artifact is 57 files / 28,869,865 bytes, saving
356,400 bytes against the preceding release.

Publication: Pages run 36846977621 passed both hosted browser engines and
deployed. Cloudflare run 36847569792 published that exact successful artifact,
recorded in `deployment.json`. `live-browser-context.json` confirms correct
outline country, nonzero drawn segments and working toggles for all six countries
on both live hosts. The hosted artifact is 28,869,866 bytes.
