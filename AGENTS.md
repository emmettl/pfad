# PFAD working agreements

PFAD is an independent Motion Studies edition. Its subject is real pathfinding
over a real road graph, replayed at human scale. No invented search activity.

- Consume exact published `@motionstudies/*` versions through public exports.
  Do not import sibling repositories or copy shared package implementations.
- The routing engine, OSM compiler, evidence contracts and visual composition
  belong here. Do not force routing events into timetable or vehicle contracts.
- Keep topology, drawing geometry, algorithm events and replay time distinct.
  Missing chunks must never silently remove roads from a search.
- Preserve source date, checksum, compiler/profile version, algorithm version
  and deterministic tie-breaking for every reproducible search recording.
- Visual direction starts from Gleislicht; grid84 remains a possible influence.
  The edition is unnumbered. Do not assign a catalogue number.
- Data refreshes are manual, versioned releases. Do not add scheduled downloads
  or replace the graph behind an existing trace without an explicit request.
- Source OSM and generated graphs belong in ignored `.cache/` until validated
  and explicitly selected for publication. MIT covers code; OSM-derived data
  retains ODbL attribution and applicable database obligations.
- Run `npm run check` and relevant browser checks before publishing.
- GitHub Pages is the primary build artifact; Cloudflare independently publishes
  that same successful artifact using pinned Motion Studies hosting tools.
