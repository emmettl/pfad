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
- The visual baseline is validated: a dark field and luminous real road searches,
  drawing on Gleislicht. Refine this language; grid84 may inform individual details.
  The map fills the viewport behind transparent header/footer overlays; controls
  must not reserve vertical map bands or block gestures in their empty space.
  The edition is unnumbered. Do not assign a catalogue number.
- Use `docs/ROADMAP.md` for staged priorities, completion criteria and the feature
  wishlist. Wishlist items are possibilities, not committed implementation scope.
- Music is core R3 scope: begin with original ambient pieces composed using the
  Driftbox rack as a provisional repertoire. Consult `docs/MUSIC.md`; its playback
  details are proposals, and the final musical selection remains open.
- Data refreshes are manual, versioned releases. Do not add scheduled downloads
  or replace the graph behind an existing trace without an explicit request.
- Source OSM and generated graphs belong in ignored `.cache/` until validated
  and explicitly selected for publication. MIT covers code; OSM-derived data
  retains ODbL attribution and applicable database obligations.
- Run `npm run check` and relevant browser checks before publishing.
- GitHub Pages is the primary build artifact; Cloudflare independently publishes
  that same successful artifact using pinned Motion Studies hosting tools.
