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
- Ambient mode is planned: a curated pool of places produces a looping sequence
  of origin/destination pairs. Journey length shapes both selection and replay
  duration, with grid84 informing the run/hold/transition rhythm.
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
- [x] Town and map-point selection, pan/zoom, pause, seeking and replay duration.
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

- [ ] Specify the initial motor-road profile: included roads, access assumptions,
  direction rules, costs and treatment of unsupported rules.
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
  Revisit the current reachable-destination filter so it does not hide a failed
  journey by silently choosing a different road.
- [ ] Define the graph’s coverage near borders and its treatment of ferries,
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
- [ ] Reduce sequential-download latency with bounded concurrent fetching and
  version-aware caching. Retry failed chunks without redownloading valid ones.
  An incomplete topology must still prevent a complete-route claim.
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
- [ ] Refine playback pacing and duration choices for searches of very different
  sizes. State any nonlinear event-time treatment clearly.
- [ ] Improve endpoint editing, snap feedback, keyboard use and touch controls.
  Add Swiss place-name search and coordinate entry beyond the initial town list,
  using a bounded, attributed place dataset.
- [ ] Add a quiet viewing mode with reduced controls and an optional compact
  explanation of the active algorithm and its counters.
- [ ] Build ambient mode from a reviewed place pool, selecting pairs by distance
  and varying replay duration with actual route length. Include repetition
  controls, a result hold, a clear transition, pause/next/exit and bounded memory.
  [The ambient-mode brief](AMBIENT.md) records confirmed choices, proposed
  heuristics and completion criteria.
- [ ] Compose and audition a provisional repertoire of ambient synth pieces
  using Driftbox. Judge the music in context across varied searches, including
  transitions, quiet passages and extended listening.
  Three original sketches are implemented; the author's listening review remains.
- [ ] Implement opt-in music with volume/mute, gentle fades, continuous playback
  across journeys, bounded audio resources and clear pause/hidden-page behaviour.
  [The music brief](MUSIC.md) proposes composition, delivery and lifecycle choices;
  it keeps the eventual repertoire replaceable.
  The initial manual-study player is implemented; whole-ambient-sequence pause
  and physical-phone sustained-use measurements remain.
- [ ] Check reverse seeking and paused frames as carefully as continuous playback.

**Complete when:** a selected set of local, urban, plateau and Alpine searches
remains readable while playing, paused and seeking; visual states have documented
meanings; the dark-field/luminous-road composition remains the established baseline.
The provisional music has been auditioned in context and its playback meets the
music brief's lifecycle and device criteria.

### R4 · Compare genuinely different searches

**Outcome:** the same geographical question reveals how algorithm choice changes
the field of possibilities explored.

- [ ] Add A* with a heuristic valid for the declared cost model.
- [ ] Verify A* against Dijkstra for optimal cost on the same graph and profile.
  Equal-cost routes may differ; do not require identical geometry unnecessarily.
- [x] Offer algorithm selection while retaining the same endpoints and dataset.
- [x] Add bidirectional Dijkstra with independent cost checks, directed reverse
  adjacency, separate front events and a light at their first real connection.
- [ ] Record algorithm and heuristic versions, tie-breaking, explored work,
  computation time and final cost consistently.
- [ ] Develop a comparison view: first simple switching, then paired playback
  if it helps. Define whether clocks compare event progress or elapsed replay time.

**Complete when:** comparisons are reproducible, costs are independently checked,
and each visible search has its own genuine trace. Search speed and replay duration
remain separate. Bidirectional Dijkstra is delivered as an alternate mode;
A*, paired comparison and more specialised methods remain open.

### R5 · Make studies reproducible and shareable

**Outcome:** a particular question, search and visual treatment can be revisited
and communicated without losing its source identity.

- [ ] Add shareable links containing endpoints, graph/profile identity, algorithm
  and meaningful replay/view settings.
- [ ] Preserve graph, compiler, profile and algorithm versions with exported
  recordings; provide clear behaviour when an older dataset is unavailable.
- [ ] Export a trace and its provenance in a documented format.
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

Begin with **R1 and R2**. Device measurements and routing validation can progress
alongside one another. Use their evidence to guide **R3**, then establish **R4**
before completing **R5**. Small visual improvements can land earlier; additional
algorithms should not multiply unresolved profile or performance problems.
Music composition and auditions can begin alongside R1 and R2 so the sound helps
shape the experience while its playback is developed within R3.

The first implementation tasks should be:

1. Write the road profile and classify restriction support and unresolved records.
2. Establish focused turn/access fixtures and representative Swiss route checks.
3. Capture a physical-phone baseline, including opening latency and memory.
4. Improve chunk fetching/caching and endpoint feedback against those findings.
5. Tune exploration persistence and final-route emphasis on the validated examples.

## Wishlist

These are deliberately uncommitted. Promote an item into a milestone only when
its purpose, dependencies and completion criterion are clear.

| Feature | What it could add | Dependency or constraint |
| --- | --- | --- |
| Bidirectional A* | Extend the delivered two-front Dijkstra mode with goal-directed search | R1–R4; a valid heuristic and bidirectional stopping rule |
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
| Other countries | Compare the influence of geography and infrastructure | Swiss profile, device and publication process established first |
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
[Bidirectional review](evidence/bidirectional-2026-10-01/review.json).
