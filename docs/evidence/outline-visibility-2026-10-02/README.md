# Phone outline visibility · 2 October 2026

A phone screenshot showed Austria’s outlines disappearing beside the roads.
The three public outline objects pass checksum, byte-length, CORS and immutable
cache verification. The existing native WebGL lines were only one framebuffer
pixel wide at 18% opacity. With reduced renderer pixel ratios, that can be a
fraction of a CSS pixel on a high-density phone.

Borders and lakes now use Three’s public screen-space line addons. The border
is 1.25 CSS pixels at 48% opacity; lake shorelines are 1.1 CSS pixels at 44%.
Their colours are brighter but remain quieter than the luminous road search.
The addon updates its logical viewport resolution before drawing, maintaining
stroke width during zoom, resize and renderer pixel-ratio changes. Empty lake
layers produce no drawing object; disposal uses the existing mesh cleanup.

The reference coordinates, immutable data releases and routing graph are unchanged.

[Before](before-webkit-app.png) and [after](after-webkit-app.png) show the same
completed Vienna–Innsbruck study at a 393×852 touch viewport, device scale 3.
[Browser report](report.json) verifies 736 Austria outline segments in WebKit
and Chromium, with no page errors. These are desktop engines at phone settings;
the physical phone in the original screenshot has not been retested.

[Pixel comparison](pixels.json) compares static canvas captures with outlines
on and off. WebKit’s mean changed-pixel difference rises from 9.70 to 55.95
8-bit channel levels; pixels differing by at least 20 levels rise from 1,028 to
17,517. Chromium also improves (9.27 to 54.69 mean difference). This measures
visible drawing rather than relying only on loaded-data attributes.

`npm run check` passes. Eight focused Chromium/WebKit regressions pass for
outline loading, toggling/retry, country switching and drawing restoration.

To repeat: build the baseline into a separate directory, build the correction,
then run `node docs/evidence/outline-visibility-2026-10-02/proof.mjs <baseline-dist> [corrected-dist]`.
Captures go to ignored `.cache/outline-phone/`; run
`python3 docs/evidence/outline-visibility-2026-10-02/pixels.py` to compare them.
Do not rebuild either served directory while the proof runs.
