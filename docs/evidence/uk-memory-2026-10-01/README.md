# UK replay memory mitigation

Reported symptom: Safari occasionally exits during UK replay on an iPhone 17 Pro.
No device crash log was available, so memory/GPU pressure is a hypothesis.

The app now grows exact event storage during search and transfers a fixed-length
buffer at completion. It writes timestamps directly into the final integer
textures, accepts transferred drawing attributes without splitting/copying them,
and releases the previous UK replay before another search. Country changes also
release the old WebGL context immediately.

For large graphs on devices with a coarse primary pointer, rendering is capped at
30 fps with a pixel ratio of 1. Replay time, complete road geometry and search
events remain unchanged. Switzerland retains its existing rendering settings.

For this UK graph, application allocations removed from result conversion are
approximately 220 MB for single-front searches and 440 MB for bidirectional
search: the old worst-case trace buffer and duplicate timestamp arrays. These
are allocation accounting, not measured Safari process peaks. Browser internals,
GPU storage and the full retained graph still consume substantial memory.
Browsers without resizable/transferable buffers retain the compatible trace
fallback.

`replay-report.json` records the production worker and renderer on desktop
Chromium and touch-enabled desktop WebKit. Four searches per browser include
repeated Dijkstra, bidirectional Dijkstra and A*. All 23,678,988 drawing vertices
are retained, WebGL reports no errors, trace backing lengths equal recorded
lengths, and event hashes match the previously published UK release. Touch
WebKit reports the 30 fps cap and pixel ratio 1. Frame interval fields measure
requestAnimationFrame callbacks, not the capped render rate.

The physical iPhone still needs a user retest; desktop WebKit cannot establish
that iOS will no longer terminate the page.
