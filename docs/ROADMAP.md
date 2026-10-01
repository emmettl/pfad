# PFAD roadmap and wishlist

Working plan · updated 1 October 2026

PFAD makes genuine route-finding visible at human scale. The search is the
subject. Features should deepen that experience, make its claims more dependable,
or make the edition easier to use. This is an ordered plan, not a dated delivery
promise. The wishlist is a pool of possibilities rather than committed scope.

## Decisions established

- **The aesthetic concept is validated.** A dark field and luminous roads are
  PFAD’s visual baseline, drawing on Gleislicht. Refine that language; grid84 may
  inform individual details without reopening the whole direction.
- Switzerland is the first subject, at the scale of the whole national graph.
- Displayed activity must come from real algorithm events over real road data.
  Visual emphasis and pacing can be authored; algorithm events cannot be invented.
- Event order, measured computation time and the playback clock remain distinct.
  A road absent from the final route is not automatically an algorithmic rejection.
- The current cost is shortest distance. A future fastest-route profile would be
  separately declared; neither profile claims live traffic.
- Ambient mode is implemented for review across the selected catalogue. Curated
  pools produce distance-selected pairs; four journey algorithms rotate and a
  three-source territory study follows every four journeys. Real road distance
  shapes selection and pacing, with grid84 informing the run/hold/transition rhythm.
- Music selection and playback are core parts of the piece. Begin with original
  ambient synth pieces made using the Driftbox rack as a provisional repertoire,
  taking inspiration from Luft. The final musical selection remains open.
- Data refreshes remain manual, versioned releases. The edition is unnumbered.

## Baseline delivered

- [x] Public repository, usual edition scaffolding and dual hosting of the same
  checked artifact.
- [x] Pinned Swiss OSM snapshot with source date, checksum and attribution.
- [x] A complete national graph: 1,258,587 nodes and 1,390,206 physical road edges.
- [x] Verified chunks: 15,866,559 opening road bytes; source evidence is optional.
- [x] Deterministic Dijkstra in a worker, with genuine recorded events and counters.
- [x] Alternate bidirectional Dijkstra: two real fronts, an event-tied meeting
  light, shortest-distance verification and selection on the same dataset.
- [x] A* with a checked remaining-distance bound and a blue-to-ice visual
  treatment driven by its genuine goal-directed trace.
- [x] Bidirectional A* with balanced feasible bounds and a shortest-distance certificate.
- [x] Town and map-point selection, pan/zoom, pause, seeking and replay duration.
- [x] Transparent viewport overlays, readable translucent endpoint controls and
  a faint selection fill that clears on point placement/cancellation.
- [x] Keyboard playback and 5/15/30/60/120-second manual presets.
- [x] Country/regional catalogue with complete immutable graphs and independent
  optional outlines; see [COUNTRIES.md](COUNTRIES.md).
- [x] Curated ambient loops, quiet controls, four-algorithm rotation and three-source territories.
- [x] Concise autoplay links, static sharing metadata, exact trace exports and bounded caching.
- [x] Reduced-motion behaviour, Chromium and mobile-viewport WebKit checks.
- [x] Hardware rendering and replay measurements on an M4 Max.
- [x] First opt-in soundtrack prototype: three original Driftbox sketches,
  volume control, crossfades and playback independent of the visual replay.

This is a shortest-distance **connectivity study**. Turn restrictions, barriers
and conditional access are retained as evidence but are not yet enforced.
Mobile-viewport tests do not establish physical-phone performance.

## Roadmap

### R1 · Make the route defensible under a declared profile

**Outcome:** the displayed route obeys a documented road-use model, and the
edition clearly states what that model can and cannot answer.

- [x] Specify the preserved connectivity profile in [PROFILE.md](PROFILE.md): included roads, access assumptions,
  direction rules, costs and treatment of unsupported rules. Driving-rule enforcement remains open.
- [ ] Audit compiler topology at restriction points and barriers. Preserve the
  junctions and source references needed to apply those rules after compression.
- [ ] Apply turn restrictions, beginning with via-node `no` and `only` rules;
  address via-way restrictions as part of the profile rather than silently ignoring them.
- [ ] Apply relevant barriers and access rules. For conditional rules, declare
  any required date/time or vehicle context and expose unsupported cases.
- [ ] Classify the 571 unresolved restriction-member references from the sizing
  proof, distinguishing excluded roads, extract boundaries and compiler defects.
- [ ] Improve endpoint snapping, including points along road segments. Show any
  meaningful displacement and explain inaccessible or disconnected selections.
- [x] Replace the asymmetric reachable-destination filter with symmetric,
  distance-bounded snapping to a shared nearby road component. Preserve genuine
  directed no-route outcomes and requested coordinates in the search record.
  Genève → Zürich, all 144 curated pairs and ten three-algorithm comparisons
  are covered by the [endpoint audit](evidence/endpoints-2026-10-01/review.json).
- [x] Define the current graph’s coverage near borders and its treatment of ferries,
  tunnels, passes and disconnected fragments.
- [ ] Validate representative national journeys and focused rule fixtures.
  Check route legality and cost against the declared profile, with reproducible
  failures and source evidence; agreement with a commercial planner is not the criterion.

**Complete when:** every route displayed as valid passes the profile checks;
unsupported rules and coverage limits are explicit; direction, turn, access and
disconnection cases have regression evidence. The preserved connectivity study
can remain available as an identified earlier profile.

### R2 · Establish browser and device budgets

**Outcome:** opening Switzerland and replaying a search work reliably on the
devices the edition intends to support.

- [ ] Measure cold and warm opening, first rendered search frame, memory,
  frame pacing and repeated-query behaviour on physical iOS and Android devices.
- [ ] Publish a small device matrix and use its results to set payload, memory
  and rendering budgets. Proposed rendering targets: 60 fps on capable desktops
  and 30 fps on supported phones; these are targets, not current phone claims.
- [x] Reduce sequential-download latency with bounded concurrent fetching and
  version-aware caching. Retry failed chunks without redownloading valid ones.
  An incomplete topology still prevents searching. Two in-flight chunks, versioned
  IndexedDB storage (Cache Storage fallback), at most two releases / 128 MiB,
  reverified reads and one automatic retry are covered by unit and browser checks.
- [x] Separate deterministic logic and national search regressions into Vitest;
  retain browser API, input and rendering integration checks. Browser engines
  run on concurrent CI runners; local workers are bounded and benchmarked. See
  [test responsibilities and timings](TESTING.md).
- [ ] Keep loading, decoding, endpoint preparation, search recording and first
  usable drawing separately measurable.
- [ ] Add cancellation and replacement of pending searches, with clear behaviour
  during rapid endpoint changes or a failed load.
- [ ] Optimise drawing and replay memory where measurements justify it. Any
  drawing detail reduction must leave search topology and costs intact.
- [ ] Check sustained use, viewport changes, touch interaction and WebGL recovery;
  provide a useful explanation where the complete study cannot run.
- [ ] Measure sustained audiovisual playback and set separate audio download,
  decoded-buffer and processing budgets before releasing the soundtrack.

**Complete when:** the supported-device matrix meets published budgets, repeated
queries do not continually grow memory, cold/warm behaviour is measured, and
missing data or rendering failure never produces a misleading success.

### R3 · Refine the experience of the search

**Outcome:** the validated visual language communicates the computation clearly
across short local searches and long national ones, with a considered musical
accompaniment and a coherent ambient experience.

- [ ] Tune brightness, pulse decay and persistence of explored roads.
- [ ] Distinguish examined roads, current search activity and the final route
  using only states supported by the trace. Any future queue/frontier treatment
  must represent actual queue state rather than an invented wave.
- [ ] Make the final route legible within dense urban exploration without
  overwhelming the wider field of considered roads.
- [x] Give completion an origin-to-destination reveal with a travelling glow and
  a gentle settle, drawn from the actual route curves. Keep this closing clock
  separate from search events; support pause, restart, seeking and reduced motion.
- [x] Add very faint national-border and lake outlines, with an on/off comparison
  control. Use a separate, attributed reference layer and preserve search state.
- [x] Make verified outlines toggleable while roads are downloading; retain a
  separate outline retry without blocking road searches.
- [x] Use transparent header/footer overlays and translucent, blurred endpoint controls.
- [x] Show a subtle country fill while selecting a map point, independent of
  outline visibility; clear it on selection/cancellation and provide a context-free tint fallback.
- [x] Offer a 5-second replay alongside the 15/30/60/120-second presets.
- [ ] Refine playback pacing and duration choices for searches of very different
  sizes. State any nonlinear event-time treatment clearly.
- [ ] Refine endpoint editing, snap feedback and touch controls beyond the
  delivered map picking and keyboard playback.
- [x] Add keyboard playback: Space play/pause, Left/Right one-second scrubbing,
  Shift five-second jumps and Home/End boundaries. Keep native control keys,
  expose a focusable map and pause the replay when scrubbing.
- [ ] Add Swiss place-name search and coordinate entry beyond the initial town list,
  using a bounded, attributed place dataset.
- [x] Add quiet ambient viewing with reduced controls; About keeps the profile,
  source and algorithm explanations accessible. Running loops fade controls
  after four seconds of inactivity; input reveals them, pause and keyboard focus
  keep them available, and Escape restores the manual study.
- [ ] Add a compact inspectable algorithm/counter overlay within quiet viewing.
- [x] Build ambient mode from versioned curated pools for every selected study,
  choosing pairs by distance and replay duration by actual route length. Include
  repetition controls, hold/fade, pause/next/exit and bounded state. Four journey
  algorithms rotate from the selected mode; retries retain the same slot.
  [AMBIENT.md](AMBIENT.md) records current selectors, pacing and remaining review.
  The [four-algorithm audit](evidence/bidirectional-astar-2026-10-01/ambient-audit.json)
  checks sixty real Swiss journeys; country release audits retain their tested versions.
- [x] Insert three-source Dijkstra after four ambient journeys. Use seeded,
  separated curated places and source-tagged events for mint/amber/periwinkle
  road territories. Hold the completed field without a route reveal; retain
  all sources in links and exact exports. [Territory evidence](evidence/territories-2026-10-01/README.md).
- [ ] Compose and audition a provisional repertoire of ambient synth pieces
  using Driftbox. Judge the music in context across varied searches, including
  transitions, quiet passages and extended listening.
  Three original sketches are implemented; the author's listening review remains.
- [x] Implement opt-in music with volume/mute, gentle fades, continuous playback
  across journeys, bounded audio resources and clear pause/hidden-page behaviour.
  [MUSIC.md](MUSIC.md) documents the implemented delivery/lifecycle and open
  composition choices, keeping the eventual repertoire replaceable.
  Manual and whole-sequence pause, next/exit continuity and hidden-page opt-in
  are verified in Chromium and WebKit. Physical-phone sustained-use measurements
  remain R2 work; the repertoire still needs the author’s listening review.
- [x] Verify reverse seeking and paused frames with genuine event counters and
  rendering regressions across journey modes and territories; visual tuning remains open.

**Complete when:** a selected set of local, urban, plateau and Alpine searches
remains readable while playing, paused and seeking; visual states have documented
meanings; the dark-field/luminous-road composition remains the established baseline.
The provisional music has been auditioned in context and its playback meets the
music brief's lifecycle and device criteria.

### R4 · Compare genuinely different searches

**Outcome:** the same geographical question reveals how algorithm choice changes
the field of possibilities explored.

- [x] Add A* with a heuristic valid for the declared cost model.
- [x] Verify A* against Dijkstra for optimal cost on the same graph and profile.
  Equal-cost routes may differ; do not require identical geometry unnecessarily.
- [x] Offer algorithm selection while retaining the same endpoints and dataset.
- [x] Add bidirectional Dijkstra with independent cost checks, directed reverse
  adjacency, separate front events and a light at their first real connection.
- [x] Add bidirectional A* with balanced feasible bounds, original directed
  costs and a stopping certificate. Integrate manual selection, ambient rotation,
  links and provenance. [Validation](evidence/bidirectional-astar-2026-10-01/README.md).
- [x] Record algorithm and heuristic versions, tie-breaking, explored work,
  computation time and final cost consistently.
- [ ] Develop a comparison view: first simple switching, then paired playback
  if it helps. Define whether clocks compare event progress or elapsed replay time.

**Complete when:** comparisons are reproducible, costs are independently checked,
and each visible search has its own genuine trace. Search speed and replay duration
remain separate. Dijkstra, bidirectional Dijkstra, A* and bidirectional A* are delivered;
paired comparison and more specialised methods remain open.

### R5 · Make studies reproducible and shareable

**Outcome:** a particular question, search and visual treatment can be revisited
and communicated without losing its source identity.

- [x] Add concise native query links containing place slugs or coordinates, country,
  algorithm and meaningful replay/view settings; omit defaults, offsets and graph hashes.
  Bind these parameters automatically to the address bar, with throttled history
  replacement and automatic replay from the beginning, or a completed still for
  reduced motion. Keep existing JSON links readable;
  exact source identity and frames remain in exported recordings.
- [x] Publish an attributed share card from a genuine search, with static Open Graph,
  X card and canonical metadata, accessible image text and crawler verification.
- [x] Preserve graph, compiler, profile and algorithm versions with exported
  recordings; provide clear behaviour when an older dataset is unavailable.
- [x] Export an exact packed trace and its provenance in the documented
  [PFAD record envelope](RECORDS.md), including optional ambient metadata.
- [ ] Curate a small set of representative studies showing different geography
  and search behaviour, with concise contextual notes.
- [ ] Add still-image export with accessible attribution and source information;
  investigate video capture after the playback and recording contract is stable.
- [ ] Define a bounded archive and a manual refresh procedure with route and
  topology comparisons before admitting a new graph release.

**Complete when:** a shared study reconstructs its intended search, exported
evidence identifies its source and algorithm, and a data refresh cannot silently
change the meaning of an existing recording.

## Working order

Prioritise the remaining **R1 and R2** gates: driving-rule validation and physical
device budgets. R3 author review can proceed alongside them. R4's four journey
algorithms and R5's core sharing/recording features are delivered; their open
comparison, curation, export and refresh work remains separately tracked.

Next priorities:

1. Classify unresolved restriction references and establish turn/access fixtures
   for a new enforced profile; retain the identified connectivity profile.
2. Capture physical iOS/Android opening, memory, frame-pacing and sustained
   audiovisual baselines, including the larger UK/Scandinavia studies.
3. Review exploration persistence, route/territory brightness, ambient pacing,
   geographical balance and the provisional music in extended use.
4. Add pending-search cancellation, WebGL recovery and better snap/place feedback.
5. Curate representative studies, then assess paired comparison and attributed still export.

## Country releases — scope added 1 October 2026

The author selected a parallel country-publication task while retaining the
Swiss default. This does not mark R1 routing legality or R2 phone validation
complete.

- [x] Generalise pinned source acquisition, sizing and packaging through country configs.
- [x] Keep Swiss data bundled and its selected identity unchanged.
- [x] Deliver additional immutable graph releases from a separate R2 bucket/Worker.
- [x] Fetch separately pinned border/lake releases on country selection; keep outline coordinates out of the app bundle and preserve road searches on context failure.
- [x] Add a country catalogue, places, optional geographic references and switching.
- [x] Preserve exact replay timestamps beyond 2^24 events and source drawing precision.
- [x] Validate the complete UK graph on desktop Chromium and WebKit; retain evidence.
- [x] Remember explicit large-download acknowledgement per country/site in local
  storage; cancellation does not persist it and storage refusal remains usable.
- [x] Add UK coastline/border and major-lake context, plus audited country ambient journeys.
- [ ] Establish physical-phone memory and frame-pacing support for UK.
- [x] Add the selected Iceland, Netherlands, New Zealand and Luxembourg releases, with outlines and 60-journey ambient audits for each.
- [x] Add whole-island Ireland, including Northern Ireland, with joined coastline, cross-border routing checks and a 60-journey ambient audit.
- [x] Add Scandinavia (Norway, Sweden and Denmark) as one deduplicated complete graph, with independent joined outlines, cross-border checks and a 60-journey ambient audit.
- [ ] Add further countries only when explicitly selected and individually validated.

[Country release procedure](COUNTRIES.md) · [UK release evidence](evidence/uk-release-2026-10-01/README.md).

## Wishlist

These are deliberately uncommitted. Promote an item into a milestone only when
its purpose, dependencies and completion criterion are clear.

| Feature | What it could add | Dependency or constraint |
| --- | --- | --- |
| Fastest-route profile | Compare distance with estimated travel time | Declared speed assumptions and access rules; no live-traffic claim |
| Waypoints and alternative routes | Explore different answers to the same journey | Genuine routing method with explicit constraints |
| Reachability / distance contours | Show the territory reachable within a distance or modelled time | Real single-source computation; separate from destination search |
| Event inspector | Explain why a node was settled or a connection improved a cost | Additional trace evidence; optional so the main view stays quiet |
| Search tree and cost view | Inspect the changing best-known predecessors and distance from the origin | Actual recorded cost/predecessor state; a separate inspection mode |
| Counterfactual studies | Observe the effect of excluding a road, crossing or pass | Label the modified graph as hypothetical and retain its identity |
| BOOP / instant result | Make the contrast between computation and theatrical replay tangible | Honest measured timing; event replay must not imply per-operation timestamps |
| Sound from search events | A second way to perceive rhythm and density, alongside the planned soundtrack | Opt-in, restrained and derived from real events; soundtrack composition is already R3 scope |
| Faint geographic context | Border/lake outlines delivered; optional relief remains | Separate sourced layer; keep emerging roads central |
| Large-format image / video export | Editions, prints and short films of a particular search | R5 provenance and export pipeline; appropriate credits |
| Offline study | Revisit a selected graph and recordings without a connection | Explicit bounded storage, verified cache and an update/removal path |
| Further countries | Extend the selected country/regional catalogue | Explicit selection, source/projection config and measured device budget |
| Walking or cycling | Reveal other possible networks of movement | Separate access/cost profiles and relevant source data |

## Outside the initial scope

Live traffic, live closures, turn-by-turn navigation, accounts, a general-purpose
GIS interface and automatic daily OSM refresh are not initial edition goals.
Adding countries or modes should follow a working, defensible Swiss study.

## Keeping this plan useful

Keep the R1–R5 identifiers stable. Work should name the milestone or wishlist item
it advances and leave the completion evidence with it. Mark a checkbox complete
when its behaviour is implemented and verified, not merely proposed. Record
material changes to scope or priorities here; dates can be added when there is
enough evidence to make them credible.

Related: [Concept](CONCEPT.md) · [Music](MUSIC.md) · [Architecture](ARCHITECTURE.md) ·
[Data and refresh policy](DATA.md) · [Initial replay evidence](evidence/first-study-2026-09-30/replay-report.json) ·
[Bidirectional review](evidence/bidirectional-2026-10-01/review.json) ·
[A* review](evidence/astar-2026-10-01/review.json).

## Review handoff · 1 October 2026

Delivered work includes verified chunk caching/retries, the selected country/regional
catalogue, independent outlines, keyboard playback and map-point selection cues.
Ambient rotates four journey algorithms from the current mode and adds territories
after four journeys, with a shared music lifecycle and quiet controls. Concise URLs
autoplay, static previews are attributed, and exact exports retain source identity.
[The documentation index](README.md) summarises the current state; [RECORDS.md](RECORDS.md)
specifies links and exports.

Author review: the ambient 25–65 s pacing, 6 s result hold and 2 s transition;
regional versus national balance; final-route and territory brightness; and the three sketches
in longer listening sessions. These are provisional authored choices.

Technical work still open: a new profile enforcing turns/barriers/conditional
context and classifying unresolved source references; physical phone budgets;
search cancellation, WebGL recovery, richer place/coordinate entry, paired
comparison, still-image export and a deliberate future graph-refresh audit.
No physical-device or driving-legality completion is implied by browser tests.
