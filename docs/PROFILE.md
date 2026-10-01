# The current routing profile

`road-connectivity-distance-v1` is an explicitly preserved connectivity study,
not a validated motor-navigation profile. Its [machine-readable specification](../public/profiles/road-connectivity-distance-v1.json)
describes the exact existing compiler behaviour. This documentation does not
change any published graph bytes, costs, identity or algorithm events.

The compiler includes fifteen motorway, main, residential and service classes.
It uses the first present unconditional value in `motorcar`, `motor_vehicle`,
`vehicle`, `access` order and excludes `no`, `private`, `agricultural`, `forestry`
and `impassable=yes`. Other values, including destination-only and permit access,
remain included. This preliminary filter does not establish driving permission.

`oneway=-1` reverses a road; `yes`, `1` and `true` allow forward travel. An absent
one-way tag implies forward travel on motorways and roundabouts. Other values
allow both directions: explicit `no` overrides the implicit rule, while
reversible, alternating and conditional directions remain unsupported.

Distances sum original OSM way-shape segments with the compiler's local planar
formula, then round each graph edge to integer centimetres. The objective is
shortest total distance. Drawing simplification never changes those costs;
zero-cost rounded edges remain possible and are handled by all algorithms.

Shared OSM node IDs establish junctions. Original way endpoints, control nodes
and restriction via-nodes are preserved when they lie on selected ways. A
crossing on the screen alone does not connect two roads. Barrier and turn-rule
evidence remains available, but it does not yet prohibit traversal or turns.

Coverage follows each pinned Geofabrik extract. The decorative border does not
clip the graph. Cross-border detours are possible only where included source
roads connect; completeness beyond the extract is not promised. Ferries are
excluded. Tunnels, bridges and mountain passes follow the same road/access
filter, without vehicle-size, toll, seasonal, weather or live-closure context.
Small components are preserved and can honestly produce no-route outcomes.

R1's remaining work is a new validated profile: classify unresolved source
references against the original extract, enforce turn and barrier rules, specify
conditional context, and test legality with focused fixtures and national
journeys. Agreement between three shortest-path algorithms establishes cost
agreement on this graph; it does not establish driving legality.
