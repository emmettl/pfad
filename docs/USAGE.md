# Using PFAD

Open [PFAD](https://motionstudies.app/pfad/). Switzerland opens by default.
The country selector loads other complete, pinned studies on demand. Large
studies ask for a download acknowledgement on first use. Acceptance is
remembered per country in local storage for that browser and site; cancelling
saves nothing. Storage refusal permits the study but cannot persist acceptance.
See [country coverage and resource limits](COUNTRIES.md).

## Choose a journey

Choose start and destination places, or use the crosshair beside either picker
to place that endpoint on the map. While picking, a faint fill inside the country
indicates that selection is active; it follows pan and zoom and remains visible with outlines
off. Placing the point or choosing Cancel clears it. If the border reference is
unavailable, a subtle map-background tint provides the cue instead.

Search runs the selected algorithm over the complete graph. Requested endpoints
snap to nearby eligible road nodes; disconnected or inaccessible selections can
produce an honest no-route result. The fill is geographic context, not a road-use
or reachability guarantee. Changing the algorithm searches the same endpoints.

| Journey algorithm | Visual treatment |
| --- | --- |
| Dijkstra | Exploration spreads in mint from the origin |
| Bidirectional Dijkstra | Mint and amber fronts, with a small light at their first real connection |
| A* | A blue-to-ice field coloured by its checked remaining-distance estimate |
| Bidirectional A* | Two guided mint/amber fronts with the same first-connection light |

First contact does not certify the final route. The algorithm completes its
shortest-distance check before the closing route reveal. The
[routing profile](PROFILE.md) explains what that distance model includes.

## Playback and map

Drag to pan; use a wheel or pinch to zoom. Show whole network restores the fitted
view. Header and footer overlays leave the map's empty space available for gestures.
The endpoint controls use a translucent, blurred background for legibility.

Play/Pause controls the recorded search and its closing route reveal. The timeline
seeks genuine event order and pauses playback. Duration presets are 5, 15, 30, 60
and 120 seconds; the closing reveal has its own presentation clock.

| Key | Action |
| --- | --- |
| Space | Play or pause |
| Left / Right | Seek back / forward one replay second |
| Shift + Left / Right | Seek five replay seconds |
| Home / End | Seek to the beginning / completed result |
| Escape in ambient | Exit into the current manual study |

Focus the map or timeline for playback shortcuts. Native selectors, editable fields,
sound controls and About keep their own keys. Shortcuts are inactive while loading,
computing, choosing a point, confirming a large dataset or showing an error.
Reduced motion opens the completed trace and skips route/meeting animation.

Outlines toggles faint borders and available lake shorelines independently of the
search. It works as soon as verified outlines arrive, including while roads are
still downloading. A failed outline download has its own retry and does not
prevent road searches. Sources and dates remain visible through the footer and About.

## Ambient and sound

Ambient loops curated, distance-selected journeys through the four algorithms,
then adds a three-source territory study after every four journeys. Territory
colours record which source first examined each road; there is no final route.
The manual picker retains two endpoints. Journey returns from an inspected
territory to the normal controls.

Running ambient controls fade after four seconds of inactivity. Input reveals
them; pause, keyboard focus, About and reduced-motion stills keep them available.
Pause sequence, Next and Exit remain accessible. Hidden pages pause the sequence;
returning requires an explicit resume. Reduced motion uses completed stills with
deliberate Next. [AMBIENT.md](AMBIENT.md) records selection and pacing.

Sound is off until enabled. The three provisional Driftbox pieces crossfade on
an independent clock: visual pause and seeking leave music continuous, while
Pause sequence pauses it too. Next and Exit preserve the player. Hiding the page
silences sound; returning requires enabling it again. Volume and mute are available.
See [MUSIC.md](MUSIC.md) for the repertoire and resource limits.

Copy the address bar or use Copy study link in About. New links replay from the
beginning, or show a completed still under reduced motion; sound and automatic
ambient sequencing require deliberate actions. About also exports the genuine
search record. [RECORDS.md](RECORDS.md) documents URLs, previews and exports.
