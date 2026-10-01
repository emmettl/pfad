# Development

Use Node 24 and npm 11.21.0, as pinned by `.nvmrc` and `package.json`.
Offline data tools require Python 3.11 or newer and
`scripts/data/requirements.txt`. Ordinary development does not download OSM.

```sh
npm ci
npm run dev
```

The dev server serves `http://127.0.0.1:4188/`. To inspect a production build:

```sh
npm run build
npm run preview
```

## Checks

```sh
npm run check
npx playwright install chromium webkit
npm run test:browser
```

`check` runs type checking, lint, dependency-boundary validation, Vitest, the
production build and payload checks. Browser checks use the built site and start
their own preview server. `npm test` and `npm run test:watch` run logic tests.
Use a separate `PFAD_PREVIEW_PORT` when another server already uses port 4188.
[TESTING.md](TESTING.md) explains which checks need browser APIs and how local
and CI concurrency are bounded.

Public `@motionstudies/*` dependencies are pinned to `0.1.0-alpha.31` and consumed
through declared exports. `@driftbox/rack@0.1.0` is a development dependency for
rendering music. No sibling repository or copied shared implementation is used.
The GitHub repository is public; npm's `private: true` prevents publishing the
edition itself as a package.

## Offline authoring and publication

Source PBFs, candidate graphs, masters and temporary proof output stay in ignored
`.cache/`. These are deliberate actions, separate from builds and page requests:

- [DATA.md](DATA.md) reproduces the Swiss sizing and packaging experiments.
- [COUNTRIES.md](COUNTRIES.md) covers additional road and outline releases.
- [MUSIC.md](MUSIC.md) covers `music:compose`, `music:render` and render identities.
- [RECORDS.md](RECORDS.md) covers manual share-card regeneration with `share:render`.
- [HOSTING.md](HOSTING.md) explains the checked Pages artifact and Cloudflare publication.

## Documentation upkeep

Keep the root README to a short introduction, local start commands, documentation
links and licensing. Put current feature details in [the documentation index](README.md)
and the relevant guide; keep priorities and completion gates in [ROADMAP.md](ROADMAP.md).
Update existing sections when behaviour changes rather than appending a competing
description. Keep measured evidence dated and attributable to its tested version;
do not rewrite historical results to imply newer features were already checked.
