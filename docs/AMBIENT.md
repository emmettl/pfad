# Ambient mode

Design brief · updated 1 October 2026 · Initial implementation for review

PFAD should be able to run as an unattended succession of genuine road searches.
The places are curated; the origin/destination pairs are chosen by a distance
heuristic. Journey length influences both selection and replay duration. These
two choices were confirmed by the author on 30 September 2026.

## The experience

Borrow grid84’s loop rhythm: a quiet introduction, one run, a hold on the result,
then the next run. Retain PFAD’s validated dark field and luminous roads.
Grid84’s current loop uses authored scenarios, roughly 45-second runs and a
nine-second result hold. PFAD adapts the presentation rhythm while generating
pairs from its own place pool and varying replay duration with journey length.

1. Introduce the origin and destination with restrained labels.
2. Run the real algorithm and replay its recorded search.
3. Hold the final route within the field of explored roads, with its actual
   distance and measured computation time.
4. Fade the drawing to darkness, introduce the next pair, and repeat.

The end-of-run fade is a presentation transition, not an algorithmic rejection.
No vehicle needs to travel along the route: the subject remains the search.

Controls retreat to a small pause/resume, next journey and exit affordance.
Attribution, profile identity and source information remain accessible. Leaving
ambient mode restores deliberate exploration of the current journey.

During a running loop, the controls, About and sound fade after four seconds of
inactivity. Pointer movement, a tap, wheel input or keyboard activity restores
them. Keyboard-focused controls and an open About panel stay visible; pause,
reduced-motion stills and search errors also keep controls available. Escape exits
ambient. A small PFAD mark, journey names, current algorithm and geographic
credits remain on screen.

## Curated place pool

Use a versioned list of places, with stable IDs, names, coordinates and optional
regional/geographic tags. Begin by reviewing the existing twelve places:
Zürich, Genève, Basel, Bern, Lausanne, Luzern, Lugano, Chur, St. Gallen,
St. Moritz, Sion and Andermatt. Add or replace places to improve the geographical
range, rather than treating the current menu as a finished curation.

The pool should give the selector plateau, lake, urban and Alpine possibilities.
Those tags describe the curated places; they do not establish what a route
crosses. Claims about a particular tunnel, pass or corridor require route evidence.
Allow explicit pair exclusions and occasional authored exceptions without turning
the mode into a fixed playlist.

The journeys are independent studies. The destination of one does not have to
become the origin of the next.

## Pair selection heuristic

These are initial tuning proposals, to be tested visually rather than treated
as established thresholds.

- Exclude identical endpoints and trivially nearby pairs. A provisional minimum
  of 30 km straight-line separation is a cheap first filter, with explicit
  exceptions for an authored local study.
- Choose a target distance band to keep the loop varied. Start with regional,
  interregional and national bands, provisionally 30–100, 100–220 and 220+ km
  of actual road distance. Favour the latter two without removing regional searches.
- Use straight-line separation to shortlist candidates cheaply. It is an estimate
  for selection, not the displayed road distance. Check the actual route length
  after the real search; allow bounded retries when a target band is missed.
- Keep a recent-history window, initially six pairs. Avoid immediate repeats
  and reversals, and avoid repeatedly favouring one origin or destination.
- Use a seeded selector and record its version, seed and chosen pairs so a
  sequence can be repeated. Treat reversed routes as distinct directed searches,
  even when the repetition rule groups them together.
- If a pair cannot be routed under the active profile, record the failure and
  choose another eligible pair with a bounded retry policy. Stop with an honest
  explanation if the pool has no eligible journeys.

Do not solve and retain every pair before starting. Selection should operate
against the loaded graph, with only the active recording and a bounded amount
of next-journey preparation held in memory. A selected route must retain the
normal snap feedback and profile limitations; ambient mode must not quietly
relax routing rules to obtain a spectacle.

## Replay duration heuristic

Use **actual road-route distance**, obtained from the completed computation.
Longer journeys receive more screen time, with diminishing returns and a floor
and ceiling. A starting rule is:

```text
replaySeconds = min(65, max(25, 30 × sqrt(routeKilometres / 100)))
```

| Actual route length | Proposed replay duration |
| --- | --- |
| 50 km | 25 seconds |
| 100 km | 30 seconds |
| 200 km | About 42 seconds |
| 300 km | About 52 seconds |
| 450 km | About 64 seconds |

Start with a six-second result hold and a two-second clear/transition. Keep these
values configurable and tune them on representative searches. A manual duration
override can remain available outside the quiet view.

Distance is a pacing heuristic, not a proxy for computational work. A shorter
journey can explore a dense or obstructed network. Judge legibility using the
actual trace as well as route length, and document any later pacing adjustment.
The replay clock still advances through genuine event order; these durations
neither change the algorithm nor claim to preserve individual operation timings.

## Framing and operation

Music is a core part of the planned experience. Start with a provisional repertoire
of ambient synth pieces made using Driftbox, drawing on Luft's listening experience.
The proposed musical clock spans several journeys: distance-based replay pacing,
result holds and next-journey actions do not restart or stretch the soundtrack.
Sound remains opt-in, with clear volume, mute and sequence-pause behaviour.
[The music brief](MUSIC.md) records the composition and playback proposals.

- Keep the camera stable within a search. Begin with the national view; investigate
  fitting the actual explored extent for regional searches when needed. Fitting
  only the chosen route must not crop away the search that produced it.
- Load the national graph once and reuse it across journeys. Next-journey
  preparation must fit R2’s measured memory and sustained-use budgets.
- Pause the sequence and its hold/transition timers while the page is hidden.
- Pause/resume and next must work during replay and the final hold. Exiting must
  cancel automatic advancement and preserve an inspectable current study.
- Respect reduced motion: no automatic entry or camera/fade choreography.
  Offer completed stills and deliberate advancement; any optional still-image
  cycling needs an explicit start control.
- Every run carries the dataset, profile, algorithm and selector identities.
  A cached recording is acceptable only when it is an actual, correctly identified
  trace from that graph; it must not be presented as newly measured computation.

## Completion criteria

- A reviewed place pool produces a varied, repeatable sequence under a documented
  selector, with bounded repetition, retries and memory use.
- Actual journey length affects both selection and replay duration; estimates,
  computed route distance and measured execution time remain distinguishable.
- Each displayed run comes from a real search or an identified real recording.
  Failures never appear as successful journeys.
- The run/hold/transition rhythm is visually reviewed on regional and national
  examples, with final routes readable and no invented exploration.
- Pause, next, exit, hidden-page and reduced-motion behaviour are verified.
- With sound enabled, music continues across journeys and transitions; sequence
  pause and hidden-page handling follow the music brief. Silent use is complete.
- Sustained looping passes the supported-device checks without growing retained
  recordings, reloading the graph each time or continuing work in hidden tabs.

This is implemented for initial review within R3, with R1’s profile and R2’s device reliability as the
release gates. See [the roadmap](ROADMAP.md).

## Implemented prototype

`swiss-places/1` uses the twelve named places above with stable IDs.
`distance-balanced-pairs/2` selects a target band with weights 1:3:3 (regional,
interregional, national), shortlists pairs using straight-line distance × 1.25,
excludes direct distances below 30 km and the last six undirected accepted pairs,
and weights candidates inversely by one plus both endpoints’ accumulated use.
A seeded xorshift32 generator makes the sequence reproducible. No precomputed
route list is retained.

`four-algorithm-rotation/1` cycles Dijkstra → bidirectional Dijkstra → A* → bidirectional A* →
Dijkstra, beginning with the manually selected algorithm. Automatic advancement
and deliberate Next each advance one slot; retries within that journey keep its
algorithm. Pause/resume leaves the slot unchanged. The quiet status identifies
the current mode; exiting restores that mode alongside the current trace.

Every candidate runs its journey's real algorithm. Its actual road distance must
match the target band; a mismatch or no route is recorded and retried, up to five
candidates. Exhaustion stops honestly and offers Next for a new band. Accepted
road distance sets the proposed square-root duration exactly, within 25–65 s.
The real route flourish finishes before the 6 s hold and 2 s fade. The map stays
dark during preparation of the next journey. All searches share the loaded graph.

Pause freezes replay, reveal, hold and fade, and fades/suspends the score; resume
continues it. Next preserves musical continuity. Exit cancels pending automatic
advancement and leaves the current trace inspectable at its existing event
cutoff, restoring the prior manual duration. Hidden pages pause without automatic
return. Reduced motion shows completed stills with deliberate Next and allows
explicit listening without camera or fade choreography.

Only the active trace and twelve metadata records are retained, with six recent
pairs and one sequence animation frame. Exported records include selector/pool
versions, algorithm-cycle version, journey number, seed, selection number, actual distance and rejected attempts. See
[RECORDS.md](RECORDS.md). The pools cover Switzerland and the United Kingdom. `uk-places/1` contains 22 authored places across Great Britain and Northern Ireland; candidates remain within their authored road region to avoid sea crossings. Actual graph connectivity and road distance still decide acceptance.

The [60-journey audit](evidence/ambient-2026-10-01/review.json) accepts all sixty
journeys within bounded attempts (four distance mismatches, 64 actual searches),
uses all twelve places and all three algorithms, and checks every final route’s
adjacency, direction and exact cost sum. Eight journeys are regional, 27
interregional and 25 national; durations span 26.5–61.8 seconds. This is selector
and routing evidence, not physical-device or memory measurement.

Browser and unit checks cover pause/next/exit, hold/fade, reduced motion, hidden
return and music continuity. Visual pacing, place balance and sustained listening
remain author review; actual phone memory, thermal behaviour and frames remain R2.

## Repeating the checks

`npm run data:audit-ambient -- .cache/ambient-audit.json` repeats the seeded
sixty-journey audit against verified committed graph bytes, without any source
download. After building and starting `npm run preview`, run
`npm run data:browser-ambient` for cold/warm opening and eight consecutive real
journeys in desktop Chromium and mobile-viewport WebKit. It saves screenshots and
a report under `.cache/ambient-browser-proof/`; an optional first argument selects
another host URL. The committed [browser review](evidence/ambient-2026-10-01/browser.json)
shows zero chunk-download bytes on warm opening and stable live WebGL object
counts (seven textures, 34 buffers) across the eight complete frames in each
browser. These counts do not measure GPU bytes, process memory or phone budgets.

The UK audit can be repeated with `node scripts/data/audit-ambient.mjs .cache/uk-ambient-audit.json --uk` against the cached immutable UK release. Seed 20261001 accepted sixty journeys in 67 attempts, spanning all 22 places and all three distance bands.

## Three-source studies · 1 October 2026

`four-journeys-one-territory/1` keeps the four journey algorithms in their existing
order, beginning with the selected mode, and inserts a three-source Dijkstra
study after every fourth journey. The territory slot does not advance the
journey algorithm. Retry stays within the slot; Next advances a slot.

`separated-three-sources/1` uses a separate xorshift32 stream seeded with
`ambientSeed XOR 0x74657272`. It selects triples in one authored road region,
requiring each pair to meet that pool's minimum separation and at least 20% of
the triple's largest separation. Candidate weights equal minimum pair separation;
source order is seeded and shuffled to vary colour placement. The last three
accepted triples are excluded; retries exclude previously attempted triples and
stop after five attempts. The exact stream seed, selector and pool are recorded.

Territories compute to exhaustion and replay for 25–65 seconds, using the normal
square-root pacing function on the maximum recorded nearest-source road distance.
This coverage distance is not a journey distance or distance-band acceptance.
The completed mint/amber/periwinkle field holds for six seconds, then fades for
two. There is no final-route reveal. Reduced motion presents completed stills
with deliberate Next. Pause, visibility, music and quiet chrome use the same
sequence lifecycle. The manual picker gains no third endpoint control.

[Validation](evidence/territories-2026-10-01/README.md).
