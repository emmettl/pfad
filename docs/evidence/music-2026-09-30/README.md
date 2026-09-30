# First soundtrack prototype

30 September 2026 · M4 Max · Chromium and WebKit with an iPhone viewport

The committed reports measure the actual AAC delivery files and all three
eight-second joins rendered through `OfflineAudioContext`. They check decoded
duration, stereo channels, finite samples, level/headroom and sample continuity.
They establish technical playback evidence, not a listening judgement.

The complete local check passed 14 unit/contract tests and 12 browser tests.
Browser checks cover the actual national graph, no music fetch or audio context
before opt-in, two-piece preparation, visual pause/seek independence, volume,
context reuse, mute/resume, page-leave handling and failed-download retry.
Hidden/return lifecycle events are dispatched deterministically; actual phone
backgrounding remains part of the device review.
The player tests also cover cancellation during decode and repeated playlist
cycles while retaining at most two voices.

The first two decoded pieces use about 61.4 MB at 32 kHz, below the player's
64 MiB cap. All three encoded files total 3,473,623 bytes. The complete static
artifact is 28,469,956 bytes, including optional road-source evidence; silent
opening does not fetch music.

Physical-phone sustained use, battery and total process memory remain R2 work.
The author's musical listening review remains R3 work. See [the music brief](../../MUSIC.md).
