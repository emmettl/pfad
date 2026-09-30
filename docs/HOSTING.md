# Dual hosting

- GitHub Pages: https://emmettl.github.io/pfad/
- Cloudflare Static Assets: https://motionstudies.app/pfad/
- Worker: `pfad-hosting`; route: `motionstudies.app/pfad*`.

`pages.yml` runs reusable checks, uploads the tested build as `github-pages`,
and deploys it. `cloudflare.yml` follows successful main-branch Pages runs and
publishes exactly that artifact using a pinned commit of Motion Studies hosting
tools. Cloudflare failures cannot undo a successful Pages release. The relative
Vite base supports both hosts without a second build.

Cloudflare publishing requires the `cloudflare` environment, restricted to
`main`, its `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ENABLED=true` repository
variable. Tokens remain in encrypted secrets. Never store local Wrangler OAuth
credentials in CI. Manual workflow dispatch accepts a successful Pages run ID.

The shared publisher validates repository/workflow identity, required files,
data paths, archive safety and static asset limits. It creates `_release.json`,
checks release identity and cache headers, and skips superseded Pages releases.
Content-hashed application assets are immutable; manifests and stable files
revalidate. There is no live-data Worker, R2 bucket or periodic source download.

To pause Cloudflare publication, set `CLOUDFLARE_ENABLED=false`. An older verified
Pages artifact can be republished with the shared publisher without its
`--require-latest` switch. Hosting tools and PFAD data admission rules live in
the Motion Studies repository; advance the workflow’s pinned commit deliberately.

Automatic Cloudflare publication is initially disabled (`CLOUDFLARE_ENABLED=false`)
until the environment credential is explicitly provisioned. Initial Cloudflare
publication uses the same verified artifact through the authenticated host.
