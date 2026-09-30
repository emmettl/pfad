# Ambient mode

Design brief · 30 September 2026 · Planned, not implemented

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

This is planned within R3, with R1’s profile and R2’s device reliability as the
release gates. See [the roadmap](ROADMAP.md).
