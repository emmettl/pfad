import type { LoadMeasurements } from './chunks.ts'
export interface Chunk {
  kind: 'nodes' | 'edges' | 'geometry'
  path: string
  start: number
  count: number
  stride: number
  bytes: number
  decodedBytes: number
  sha256: string
}

export interface StudyManifest {
  schema: 'pfad-road-study/1'
  encoding: 'le-columnar-deltas/1'
  id: string
  identity: string
  compiler: string
  profile: string
  source: { dataTimestamp: string; attribution: string; licence: string; licenceUrl: string; url: string; sha256: string }
  counts: { nodes: number; edges: number; directedArcs: number; vertices: number }
  coordinateScale: number
  projection: { longitudeWrapping?: 'centre/1'; centre: [number, number]; referenceLatitude: number; scaleMetres: number; quantisationMetres: number }
  bounds: [number, number, number, number]
  classes: string[]
  chunks: Chunk[]
  evidence: { path: string; bytes: number; sha256: string }
  downloadBytes: number
  limitations: string[]
}

export interface Graph {
  routingObjective?: 'time'
  xy: Int32Array
  from: Uint32Array
  to: Uint32Array
  length: Uint32Array
  direction: Uint8Array
  category: Uint8Array
  offsets: Uint32Array
  arcTo: Uint32Array
  arcEdge: Uint32Array
  incoming: Uint32Array
}

export interface Point { name: string; lon: number; lat: number }
export interface Endpoint extends Point { node: number; snapMetres: number }
export interface SnappingRecord { version: 'nearby-shared-component/1'; requestedStart: Point; requestedGoal: Point }
export type SearchAlgorithm = 'dijkstra' | 'bidirectional' | 'astar' | 'weighted-astar' | 'bidirectional-astar' | 'multisource' | 'greedy' | 'depth-first' | 'breadth-first' | 'bidirectional-breadth-first' | 'time-dijkstra' | 'spanning-tree'
export interface Meeting { event: number; node: number; lon: number; lat: number; candidateConnections?: number; candidateMetres?: number; candidateMilliseconds?: number }
export interface HeuristicRecord {
  version: 'feasible-planar-distance/1'
  preparationMs: number
  correctedNodes: number
  longitudeScale: number
  initialStartCm: number
  startLowerBoundCm: number
}

export interface ProximityHeuristicRecord { version: 'great-circle-proximity/1'; preparationMs: number; startEstimateCm: number }

export interface SearchResult {
  dataset?: { identity: string; compiler: string; profile: string; sourceSha256: string; sourceTimestamp: string }
  algorithm: 'dijkstra/1' | 'bidirectional-dijkstra/1' | 'astar/1' | 'weighted-astar/1' | 'bidirectional-astar/1' | 'multisource-dijkstra/1' | 'greedy-best-first/1' | 'depth-first/1' | 'breadth-first/1' | 'bidirectional-breadth-first/1' | 'time-dijkstra/1' | 'spanning-tree/1'
  tieBreak: string
  start: Endpoint
  goal: Endpoint
  searchMs: number
  snapMs: number
  snapping?: SnappingRecord
  tree?: { version: 'undirected-prim-component/1' | 'undirected-prim-goal/1'; root: number; nodes: number; totalMetres: number; directions: 'ignored'; traceIds: 'kind-0-node-kind-1-2-physical-road' }
  treeEdges?: Uint32Array
  routeMetres: number | null
  objective?: 'distance' | 'time'
  timeHeuristic?: { version: 'feasible-road-class-time/1'; unit: 'millisecond'; preparationMs: number }
  routeMilliseconds?: number | null
  timeModel?: { version: 'road-class-time/1'; costUnit: 'millisecond'; rounding: 'nearest-ms-minimum-one'; speedsKph: Record<string, number>; fallbackKph: number; assumptions: string[] }
  routeNodes: Uint32Array
  routeEdges: Uint32Array
  routeReversed: Uint8Array
  routeLengths: Uint32Array
  trace: Uint32Array
  /** App-owned runtime storage; worker results always contain the full resident trace. */
  traceArchive?: {
    count: number
    kinds: Uint8Array
    bytes: number
    blocks: number
    readBlock: (index: number) => Promise<Uint8Array<ArrayBuffer>>
    retain: () => () => void
    dispose: () => Promise<void>
  }
  checkpoints: Uint32Array
  checkpointStride: number
  edgeTimes: Uint32Array
  sources?: [Endpoint, Endpoint, Endpoint]
  requestedSources?: [Point, Point, Point]
  sourceSnappingVersion?: 'nearby-shared-three-source-component/1'
  territories?: { version: 'three-source-first-examination/1'; sourceNodes: number[]; maximumMetres?: number; maximumMilliseconds?: number }
  edgeSources?: Uint8Array
  backwardTimes?: Uint32Array
  goalProximity?: Uint8Array
  balancedHeuristic?: { version: 'balanced-feasible-planar-distance/1'; preparationMs: number; forward: HeuristicRecord; backward: HeuristicRecord }
  proximityHeuristic?: ProximityHeuristicRecord
  weighting?: { version: 'fixed-heuristic-weight/1'; weight: number; reopening: false }
  routeGuarantee?: 'first-found' | 'fewest-connections'
  focusVersion?: 'expanded-node-focus/1' | 'depth-first-traversal-focus/1'
  focusEvents?: Uint32Array
  focusCoordinates?: Int32Array
  heuristic?: HeuristicRecord
  meeting?: Meeting
  textureWidth: number
  textureHeight: number
  exploredNodes: number
  examinedArcs: number
  improvements: number
  uniqueEdges: number
  maxQueue: number
}

export type Request = { type: 'load'; manifestUrl: string; expectedIdentity?: string; topologyOnly?: boolean; compactDrawing?: boolean; releaseAfterSearch?: boolean } | { type: 'search'; requestId: number; start: Point; goal: Point; algorithm: SearchAlgorithm; objective?: 'distance' | 'time'; sources?: [Point, Point, Point] }
export type Reply =
  | { type: 'progress'; loaded: number; total: number; stage: string }
  | { type: 'manifest'; manifest: StudyManifest; manifestUrl: string }
  | { type: 'geometry'; start: number; count: number; bytes: ArrayBuffer; drawingEncoding?: 'float32-delta-gzip/1' }
  | { type: 'ready'; measurements: LoadMeasurements }
  | { type: 'result'; requestId: number; result: SearchResult }
  | { type: 'error'; requestId?: number; message: string }
