# PFAD

**A study of time, space, and the paths not taken.**

[Motion Studies edition](https://motionstudies.app/pfad/) ·
[GitHub Pages](https://emmettl.github.io/pfad/) ·
[Concept](docs/CONCEPT.md) · [Architecture](docs/ARCHITECTURE.md)

PFAD will replay genuine pathfinding over Switzerland’s OpenStreetMap road
network. The computation runs normally; its recorded search becomes an event
that can be watched, paused and inspected. The search is the subject.

## Current state

Public scaffolding and a source-backed sizing proof. The published page is an
edition introduction, not a functioning route planner or simulated search.
The national graph has not been shipped. Visual direction leans towards
Gleislicht, with grid84 remaining an influence to explore.

## Development

Use Node 24 and npm 11.19.0. Data tools require Python 3.11 or newer. `npm ci`, then `npm run dev`.
`npm run check` runs type, lint, dependency-boundary, contract, build and
payload checks. `npx playwright install chromium webkit` installs browsers;
`npm run test:browser` checks the built site. Public shared packages are pinned
to `0.1.0-alpha.30`; the repository remains private to npm (`private: true`).

## Evidence and data

The 2026-09-30 proof measured 1,258,587 nodes and 1,390,206 road edges.
The compact graph plus five-metre visual geometry is 16,001,724 gzip bytes;
all original shape points at rounded coordinates total 22,941,882 gzip bytes.
These are feasibility measurements, not a validated driving model.

[Data policy and reproduction](docs/DATA.md) records the source checksum,
refresh policy, limitations and commands. [Evidence](docs/evidence/sizing-2026-09-30/)
includes the original measured results. The portable scripts preserve the proof
for further investigation. Large source and generated files are not in Git.

## Hosting

Successful main-branch checks build and deploy GitHub Pages. Cloudflare then
publishes the same Pages artifact at `motionstudies.app/pfad/`, independently.
See [hosting](docs/HOSTING.md). Neither build nor deploy downloads OSM.

## Licence

Code: [MIT](LICENSE). Road data: © OpenStreetMap contributors, under the
[Open Database Licence](https://www.openstreetmap.org/copyright). The code
licence does not relicense OSM-derived databases. Bundled shared-package fonts
retain their upstream licences.
