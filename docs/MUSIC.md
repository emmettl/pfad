# Music

Design brief · 30 September 2026 · Planned, not implemented

Music selection and implementation are central to PFAD. The author's initial
direction is to use the Driftbox rack to create ambient synth pieces as a
placeholder repertoire, taking inspiration from Luft. The first pieces should
help establish the relationship between music and the visual study; they do not
settle the final selection.

The choices below are initial proposals for composition and playback. No music
has yet been composed or added to PFAD.

## Musical direction

Begin with a small family of original Driftbox sketches. Audition them against
the actual search, including dense urban exploration, plateau journeys and
Alpine corridors. Look for space, sustained attention and gradual development.
The roads should remain readable without every visual event demanding a musical
response.

Three possible starting palettes:

- Warm, slowly shifting sustained tones, with a little movement in their texture.
- Sparse upper-register notes above a quiet harmonic bed, with room for decay.
- A darker low drone and thin, airy overtones, with occasional passages of silence.

Try pieces of roughly two to four minutes first. Compare them on headphones and
ordinary speakers, at quiet listening levels. Review dynamics, harmonic movement,
fatigue and the transition between pieces as carefully as individual sounds.
These are audition directions, not a fixed track list or a requirement for three
finished pieces.

## Relationship to journeys

Let music develop across several journeys on an independent clock. The route's
distance-based replay duration should not stretch the audio, restart a piece or
force a cadence. Result holds and transitions to darkness can occur within a
continuing musical phrase. Starting the next journey should leave that continuity
intact.

Use deliberately authored loop boundaries or crossfades between compatible
pieces. Preserve release and effect tails; avoid obvious repetition or a constant
wash that leaves no room for silence. Keep soundtrack selection independent of
the seeded journey selector so musical curation can change without changing the
geographical sequence.

The soundtrack is composed accompaniment. Event-driven sound remains a separate
wishlist possibility, and any such sound must use real recorded search events.

## Composition and delivery

Use Driftbox as the composition tool. Preserve each selected patch, authored
automation, module/package versions and any seed or source assets needed to
reproduce the render. Record manual performance into automation when it is part
of the piece. Keep a short note identifying its author and intended playback
behaviour.

For the first implementation, prefer rendered stereo pieces. This makes the
auditioned performance consistent and lets us measure decoding, memory and
download cost separately from route computation. Driftbox's public rack API
supports offline rendering; PFAD does not need to include a rack editor to use
music made with it.

Keep the original patches and masters as composition sources. Publish only the
selected, appropriately encoded delivery files, with their identity and credits.
Check decoded loop boundaries and crossfades in supported browsers, including
phones. Load audio on demand after sound is enabled, and bound decoded buffers
and next-piece preparation. Audio must have its own measured delivery budget.

Live rack playback remains an option if it adds something meaningful to the
piece. Evaluate it against R2's sustained CPU, memory and battery measurements
before adopting it. Any runtime integration must use an exact published
`@driftbox/rack` version through public exports; do not import sibling source or
copy the synthesis implementation.

## Playback behaviour

Borrow Luft's explicit sound opt-in, gentle gain ramps and reusable audio context.
Luft's current score is rendered locally with Web Audio; its useful precedent
here is the listening experience and lifecycle. Driftbox is PFAD's proposed
composition workflow.

- Sound starts off. Enabling it is a deliberate action, and ambient mode can
  be entered silently. Provide a small volume control and an immediate mute.
- Scrubbing or pausing an individual visual replay leaves music on its own clock.
  Pausing the whole ambient sequence also pauses its soundtrack with a short
  fade. Controls should make these different actions clear.
- Next journey preserves musical continuity. Leaving ambient mode must not
  create a second player or restart the current piece.
- Hiding or leaving the page fades and suspends sound. Returning does not resume
  it automatically; an explicit sound action restores playback. Preserve the
  musical position where practical.
- Use one audio owner and bounded preparation. Repeated toggles, pending decodes
  and crossfades must not create duplicate players or let stale work restart sound.
- A failed download, decode or unavailable audio context leaves the visual study
  usable and offers a retry. Reduced-motion preferences do not enable sound.

## Completion criteria

- A small provisional repertoire has been auditioned in PFAD, with deliberate
  selection, transitions and silence. Original composition sources and render
  identity are retained.
- Music remains continuous through variable-length journeys, result holds and
  next-journey actions. Loops and crossfades have no unintended cut, click or
  sudden level change; decoded audio has headroom and finite sample values.
- Opt-in, volume, mute, visual pause/scrubbing, sequence pause, hidden-page
  suspension, return and failures behave as documented on supported browsers.
- Sustained audiovisual playback meets R2's device budgets, without growing
  buffers or duplicate contexts. Opening the silent study does not fetch music.
- The repertoire can be replaced without changing routing or search-event logic.
  Future audiovisual exports retain the selected piece's identity and credits.

Composition and auditioning can begin alongside R1 and R2. Playback belongs to
R3, with physical-device checks as a release gate. See [the roadmap](ROADMAP.md)
and [the ambient-mode brief](AMBIENT.md).
