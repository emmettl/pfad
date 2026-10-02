# Estimated road-class time

The manual Distance / Estimated time toggle selects the cost objective independently
of the algorithm. Dijkstra, bidirectional Dijkstra and both A* variants minimize
integer modelled milliseconds in time mode. Greedy, depth-first and breadth-first
retain their traversal and report the time of that unchanged route. Manual
three-source territories use time costs too. Ambient remains distance-based.
`road-class-time/1` derives costs from the existing road-class byte and physical
centimetre length: `max(1, round(lengthCm * 36 / speedKph))`. No graph download
or source refresh is required. Each exported result includes the speed table,
model version, rounding and assumptions, alongside its original graph identity.
Time heuristic and territory records carry explicit millisecond metadata; no
time value is exported as a physical distance. Distances and route drawing
lengths remain physical centimetres/metres; estimated
milliseconds are separate. Existing distance recordings retain their meaning.

## Provisional speeds

These are modelling assumptions, not measured averages or legal limits.

| Class | km/h |
|---|---:|
| Motorway / link | 100 / 50 |
| Trunk / link | 80 / 40 |
| Primary / link | 60 / 35 |
| Secondary / link | 50 / 30 |
| Tertiary / link | 40 / 25 |
| Unclassified | 35 |
| Residential | 25 |
| Living street | 10 |
| Service | 15 |
| Road / unknown class | 25 |

Both directions use the same speed. Posted limits, traffic, turn and junction
delays are absent. The underlying connectivity profile does not enforce all
vehicle-access restrictions. The UI identifies this as a road-class estimate.
Time mode stays outside the ambient repertoire.

Directional speed codes and source limits require a separately compiled,
validated data profile. They are not silently inferred from this release.
