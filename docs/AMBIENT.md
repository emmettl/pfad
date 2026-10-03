# Ambient mode

Implemented for author review · updated 1 October 2026

Ambient is a succession of genuine road studies drawn from curated places.
The author confirmed pair selection by distance and distance-based replay duration
on 30 September 2026. PFAD adapts grid84's run/hold/transition rhythm within its
validated dark field and luminous geography. It chooses studies rather than
replaying a fixed playlist.

## Sequence and presentation

`four-journeys-one-territory/1` runs four journeys, followed by one three-source
Dijkstra territory study, then repeats. The journey algorithms rotate Dijkstra →
bidirectional Dijkstra → A* → bidirectional A*, beginning with the selected manual
mode. The territory slot does not advance that rotation. Retries keep the same
slot and algorithm; Next advances a slot, and pause/resume keeps it unchanged.

Each accepted journey introduces its endpoints, replays its recorded search,
finishes the actual-route flourish, holds for six seconds and fades to darkness
for two seconds. A territory holds its completed three-colour field without a
route reveal. The map remains dark while the next computation is prepared.
The fade is a presentation transition, not an algorithmic rejection.

The camera begins at the fitted national or regional view and stays stable within
the study. Running controls, About and Sound fade after four seconds without input.
Pointer movement, a tap, wheel or keyboard activity restores them. Focused controls,
About, pause, reduced-motion stills and errors keep the controls visible. The PFAD
mark, current study/algorithm and geographic credits remain on screen.

Pause freezes replay, reveal, hold and fade and suspends the score. Next preserves
musical continuity. Exit cancels automatic advancement, preserves the inspectable
current trace and restores the previous manual duration. Escape exits too. A
territory can be switched back to two-point controls with Journey. Hiding the page
pauses the sequence; returning needs an explicit resume and a separate sound opt-in.
Reduced motion presents completed stills with deliberate Next, without automatic
camera or fade choreography. See [usage](USAGE.md) and [music](MUSIC.md).

## Curated pools

`src/ambient/pools.ts` contains versioned places with stable IDs, names,
coordinates and optional authored road regions. Every selected catalogue study
has a pool. Manual picker places and ambient curation need not be identical.

| Study | Pool | Places | Authored road regions |
| --- | --- | ---: | --- |
| Switzerland | `swiss-places/1` | 12 | One pool |
| United Kingdom | `uk-places/1` | 22 | Great Britain / Northern Ireland |
| Iceland | `is-places/1` | 12 | One pool |
| Netherlands | `nl-places/1` | 12 | European extract |
| New Zealand | `nz-places/1` | 18 | North / South Island |
| Luxembourg | `lu-places/1` | 10 | One pool; smaller distance bands |
| Ireland | `ie-places/1` | 18 | Whole island |
| Scandinavia | `sc-places/1` | 29 | Connected mainland region |
| Australia | `au-places/1` | 39 | Mainland / Tasmania |

Candidates remain within one authored region; these labels avoid proposing known
sea crossings, not proving connectivity. The complete directed graph decides
whether a route or source coverage exists. Islands remain available manually,
and no ferry edges are invented. [COUNTRIES.md](COUNTRIES.md) records coverage.
Place tags do not establish which pass, tunnel or landscape a route crosses.

## Journey selection

`distance-balanced-pairs/3` uses a seeded xorshift32 generator. It chooses
regional/interregional/national distance bands with weights 1:3:3. The default
actual-road bands are 30–100, 100–220 and 220+ km; Luxembourg uses 5–25, 25–50
and 50+ km. The pool's minimum also filters straight-line separation.

Straight-line distance × 1.25 shortlists candidates. This is a selection estimate,
not the displayed route distance. Identical endpoints, the last six accepted
undirected pairs and pairs already attempted in this slot are excluded. Candidate
weights are inverse to one plus both endpoints' accumulated use. Reversed
journeys remain different directed searches even though repetition groups them.

Each candidate runs the slot's real algorithm. Its actual route distance must
match the target band; mismatches and no-route outcomes are recorded and retried.
Five attempts are allowed. Exhaustion stops with an explanation and deliberate
Next can try another band. The selector does not precompute and retain all routes
or relax the routing profile to obtain an accepted journey.

## Three-source selection

`separated-three-sources/1` uses a separate xorshift32 stream seeded with
`ambientSeed XOR 0x74657272`. Triples come from one authored road region. Every
pair must meet the pool's minimum separation and at least 20% of the triple's
largest separation. Candidate weights equal minimum pair separation; seeded
shuffling varies source colour order. The last three accepted triples and the
slot's previously attempted triples are excluded, with five attempts at most.

`multisource-dijkstra/1` searches to exhaustion from the three snapped sources.
Settled nodes receive their minimum outward directed road distance from any
source. Mint, amber and periwinkle identify the source of each road's first real
examination. They are not interpolated geographical borders within a road.
Unreachable roads stay dark. There is no meeting flash or final path; the manual
picker gains no third endpoint control. See the [event contract](ARCHITECTURE.md#three-source-territory-study).

## Replay duration and retained state

Journeys use actual route kilometres. Territories use the maximum reached node's
nearest-source road distance, a coverage measure rather than a journey length.
Both apply the implemented pacing rule:

```text
replaySeconds = min(65, max(25, 30 × sqrt(kilometres / 100)))
```

| Distance measure | Replay duration |
| --- | --- |
| 50 km | 25 seconds |
| 100 km | 30 seconds |
| 200 km | About 42 seconds |
| 300 km | About 52 seconds |
| 450 km | About 64 seconds |

Distance controls selection/pacing, not computational work. A shorter journey can
explore a denser network. Replay follows genuine event order rather than measured
per-operation CPU time. The 25–65 s range, six-second hold and two-second fade
are implemented authored choices still awaiting visual review.

The loaded graph is reused. Only the active trace, twelve attempt metadata records,
six recent journey pairs, three recent territory triples and bounded selector state
are retained. Superseded route geometry and textures are disposed. Exported
metadata preserves graph/profile/algorithm, pool/selector/cycle versions, slot,
seed, selection and acceptance. Journey records retain estimated/actual distance
and band; territory records retain source IDs and coverage statistics.
[RECORDS.md](RECORDS.md) specifies links and exports. Music uses one independent
player and is neither stretched nor restarted for variable journey durations.

## Evidence and reproduction

- The [initial Swiss audit](evidence/ambient-2026-10-01/review.json) preserves its
  earlier three-algorithm run; the [four-algorithm audit](evidence/bidirectional-astar-2026-10-01/ambient-audit.json)
  validates the later journey rotation. Each checks sixty real accepted journeys,
  adjacency, directions, exact cost sums, distance acceptance and bounded attempts.
- [Territory evidence](evidence/territories-2026-10-01/README.md) compares six
  Swiss triples with separate complete single-source runs and checks source-tagged events.
- Country-specific sixty-journey audits are linked from [COUNTRIES.md](COUNTRIES.md).
  Older release reports identify the three algorithms tested at publication.
- Unit and browser checks cover the current insertion cycle, seeking, pause/next/exit,
  quiet controls, hidden return, reduced motion, sharing and music continuity.

```sh
npm run data:audit-ambient -- .cache/ambient-audit.json
node scripts/data/audit-territories.mjs .cache/territory-audit.json
node scripts/data/audit-ambient.mjs --country nz \
  --manifest .cache/countries/<dataset-id>/manifest.json \
  --output .cache/nz-ambient-audit.json
```

These commands use verified graph bytes, not a new OSM source. The current journey
audit rotates all four algorithms; territory validation is separate. After
building and serving a preview, `npm run data:browser-ambient` checks opening and
successive real studies in Chromium and mobile-viewport WebKit. An optional first
argument selects another host; output stays in `.cache/ambient-browser-proof/`.
The [earlier browser review](evidence/ambient-2026-10-01/browser.json) records its
warm-download and WebGL object counts; those are not memory-byte or phone budgets.

Review still open: place balance, geographical variety, pacing, road persistence,
territory colour/brightness and extended listening. Physical-phone memory, frames,
thermal behaviour and sustained audiovisual budgets remain R2 work. Driving-rule
enforcement remains R1. Browser checks do not complete those gates.

## Greedy addition · 1 October 2026

`five-algorithms-with-territories/1` rotates Dijkstra → bidirectional Dijkstra →
A* → bidirectional A* → greedy best-first, starting from the selected journey
mode. After every four accepted journey slots, the existing territory slot is
inserted without advancing the journey algorithm. For a Dijkstra start the
first slots are Dijkstra, bidirectional Dijkstra, A*, bidirectional A*, territories,
greedy, Dijkstra, bidirectional Dijkstra, A*, territories. Explicit Next also
advances a slot; retries keep its algorithm. Earlier exported cycle versions
retain their original meaning.

Greedy uses the same actual chosen-route distance for band acceptance and replay
pacing, even though that route is not guaranteed shortest. Its quiet caption
keeps that distinction visible. The coral/peach exploration and recorded focus
glow follow the normal pause/seek, reduced-motion and route-reveal lifecycle.
[Validation](evidence/greedy-2026-10-01/README.md).

## Australia pool · 3 October 2026

`au-places/1` covers all six states, the ACT and Northern Territory. Its 35
mainland places and four Tasmanian places preserve separate road regions; no
ferry crossing is proposed. The existing 30/100/220 km bands and actual road
distance determine acceptance and pacing. Sixty validated journeys accepted
all 39 places in 63 attempts: ten regional, 23 interregional and 27 national.
Manual selection still allows disconnected islands to be studied explicitly.
[Release evidence](evidence/australia-release-2026-10-03/README.md).
