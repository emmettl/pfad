# Road data and refresh policy

PFAD starts with a dated snapshot. Refreshes are manual, explicit graph releases.
There is no scheduled collector and no OSM download in CI or page requests.
A future periodic refresh can be chosen if ongoing use warrants it; the edition
does not claim live traffic, live closures or current navigation advice.

The initial feasibility source is Geofabrik’s Switzerland extract:

- URL: https://download.geofabrik.de/europe/switzerland-260929.osm.pbf
- Source data timestamp: 2026-09-29T20:22:51Z.
- Bytes: 547,273,092.
- SHA-256: `95e29e18873357b927d22daa0bfc08a35e8840079a591cd70ba24a4208b4a4dd`.
- Attribution: © OpenStreetMap contributors.
- Licence: https://www.openstreetmap.org/copyright (ODbL 1.0).

Geofabrik provides updated extracts and change files. Their availability does
not require PFAD to update with every release. Adopt a new snapshot when its
corrections or changed roads are useful, compare connectivity and canonical
routes, and publish it under a new identity. Preserve any graph required by a
published recording within an explicitly bounded archive. Do not accumulate
every intermediate snapshot indefinitely.

## Reproduce the sizing experiment

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r scripts/data/requirements.txt
npm run data:acquire
npm run data:measure
npm run data:browser
```

The acquisition command uses the fixed source above and verifies bytes and
SHA-256. Everything large is written under ignored `.cache/`. Browser proof
requires the Playwright engines installed as described in the README. The
benchmark uses a local HTTP server, not a mobile network simulation.

The compiler includes motorway through residential/service road classes, with
a preliminary motor access filter. It does not include ferries. It retains
original OSM way endpoints, node controls and turn restrictions. Five- and
fifteen-metre simplification changes visual geometry only; costs come from
original geometry. Compact coordinates are rounded to 1e-5 degrees.

Known limitations: turn, barrier and conditional rules are not enforced;
571 restriction members in the original proof referenced excluded or missing
objects and need classification; endpoint selection must handle disconnected
directed fragments. Source locations cover the Geofabrik extract, which is not
a promise of every cross-border route. None of these are solved by compression.

The delivery payload omits OSM object IDs after remapping restriction references
to dense IDs. The baseline compiler output retains them for provenance. A
production release must provide the OSM-derived database or a compliant way to
obtain it and keep attribution accessible. MIT covers application code only.
