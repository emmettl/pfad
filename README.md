# PFAD

**A study of time, space, and the paths not taken.**

[Motion Studies](https://motionstudies.app/pfad/) ·
[GitHub Pages](https://emmettl.github.io/pfad/)

PFAD makes real route-finding visible at human scale. A worker computes over a
recorded OpenStreetMap road network; the map replays the genuine search events.
The search is the subject.

Explore Switzerland and selected country or regional studies with four journey
algorithms, map-point selection, playback and seeking. Ambient mode cycles
distance-selected journeys and occasional three-source territory studies.
An optional soundtrack uses original Driftbox sketches.

The current profile models shortest-distance road connectivity. Turn restrictions,
barriers and conditional rules are retained as evidence but not enforced.
PFAD is not a validated driving route planner.

## Run locally

Use Node 24 and npm 11.21.0.

```sh
npm ci
npm run dev
```

## Documentation

[Documentation and current state](docs/README.md) ·
[Development](docs/DEVELOPMENT.md) · [Roadmap and wishlist](docs/ROADMAP.md) ·
[Concept](docs/CONCEPT.md)

## Licence

Code: [MIT](LICENSE). Road data: © OpenStreetMap contributors,
[ODbL](https://www.openstreetmap.org/copyright). Geographic references and fonts
retain their own source terms and attribution; see [data policy](docs/DATA.md).
