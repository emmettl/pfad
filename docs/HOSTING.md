# Dual hosting

- GitHub Pages: https://emmettl.github.io/pfad/
- Cloudflare Static Assets: https://motionstudies.app/pfad/
- Alternate address: https://pfad.motionstudies.app/
- Worker: `pfad-hosting`; route: `motionstudies.app/pfad*`, plus the Custom Domain
  `pfad.motionstudies.app`.

`pages.yml` runs reusable checks, uploads the tested build as `github-pages`,
and deploys it. `cloudflare.yml` follows successful main-branch Pages runs and
publishes exactly that artifact using a pinned commit of Motion Studies hosting
tools. Cloudflare failures cannot undo a successful Pages release. The relative
Vite base supports all addresses without a second build. The subdomain maps its
root to the same `/pfad/` assets through a small Worker handler; matching assets
on the existing path route continue to be served directly. Asset redirects stay
at the subdomain root. Both Cloudflare addresses are checked for matching release
identity and cache policies after each publication. Requests invoking the
subdomain handler follow Worker request billing. The canonical edition remains
`https://motionstudies.app/pfad/`.

Cloudflare publishing requires the `cloudflare` environment, restricted to
`main`, its `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ENABLED=true` repository
variable. Tokens remain in encrypted secrets. Never store local Wrangler OAuth
credentials in CI. Manual workflow dispatch accepts a successful Pages run ID.

The shared publisher validates repository/workflow identity, required files,
data paths, archive safety and static asset limits. It creates `_release.json`,
checks release identity and cache headers, and skips superseded Pages releases.
Content-hashed application assets are immutable; manifests and stable files
revalidate. There is no periodic source download. Additional country data uses the separate
R2 service described below.
The PFAD allowlist admits only its edition record and dated, content-identified
graph directories containing the manifest, hashed topology/geometry chunks and
optional source evidence. Raw PBFs and intermediate compiler files are excluded.
The full artifact budget is 30 MiB, including optional evidence; each static file
stays below 25 MiB. The initial road load is 15.9 MB, separate from that evidence.

To pause Cloudflare publication, set `CLOUDFLARE_ENABLED=false`. An older verified
Pages artifact can be republished with the shared publisher without its
`--require-latest` switch. Hosting tools and PFAD data admission rules live in
the Motion Studies repository; advance the workflow’s pinned commit deliberately.

Automatic Cloudflare publication is enabled (`CLOUDFLARE_ENABLED=true`). The
`cloudflare` environment credential was provisioned on 2026-09-30 with explicit
author approval, using encryption for the destination environment. The temporary
transfer workflow and encrypted artifact were removed. Both the environment and
publishing workflow restrict deployment to `main`.

## Independent country data delivery

From 1 October 2026, additional countries use the private R2 bucket `pfad-data`
and the read-only Worker `pfad-data`, at `https://motionstudies.app/pfad-data/`.
Its more specific route takes precedence over the app's `pfad*` route. Switzerland
remains bundled in the existing app artifact, with the same dataset identity.
GitHub Pages and Cloudflare still publish exactly the same tested app artifact.
The app artifact includes Switzerland and music and stays within its 30 MiB budget.
Additional country graphs and all outline coordinates are served independently;
they add no graph/outline objects to Pages. The catalogue and pinned outline
manifest references are compiled into the application.

Dataset paths contain country, source date and content identity. Every object is
immutable and publicly readable; there are no public uploads, object listings,
mutable `latest` pointers or scheduled refreshes. The Worker streams R2 objects,
uses edge caching, serves GET/HEAD and byte ranges, and supplies CORS for Pages.
Gzip containers have no HTTP Content-Encoding: checksums cover stored bytes.
Optional UK source evidence is 42.9 MB and is served through R2, avoiding the
static-asset file limit. Code remains MIT; graph and evidence remain ODbL.

Country releases are manual. [COUNTRIES.md](COUNTRIES.md) documents compilation,
validation, publishing and rollback. Deploy the delivery Worker independently
with pinned tooling after tests:

```sh
npm exec --yes --package=wrangler@4.143.0 -- wrangler deploy \
  --config hosting/data-worker/wrangler.jsonc
```

The Worker config identifies the existing bucket and route; it does not create
or change the app build. Use a host Wrangler login or an appropriately scoped
Cloudflare API token. Never copy OAuth credentials into the repository or CI.
R2 storage/operations and Worker requests use the account's existing billing;
this architecture does not promise unlimited free storage or requests.
