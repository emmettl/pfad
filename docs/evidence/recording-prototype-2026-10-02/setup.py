from pathlib import Path
import shutil
r=Path('.cache/endpoint-prototype/snapshot')
for f in ['src/search/manifest.ts','src/search/search.worker.ts','src/search/astar.ts']:
 shutil.copyfile(Path('.cache/recording-audit/snapshot')/f,r/f)
p=r/'src/search/endpoints.ts';s=p.read_text().replace('function candidates(', 'function scanCandidates(')
insert='''
const spatial = new WeakMap<Graph, {offsets: Uint32Array; nodes: Uint32Array; buildMs: number}>()
function latitudeIndex(graph: Graph, lookup: ReturnType<typeof index>) {
  const cached = spatial.get(graph)
  if (cached) return cached
  const begun = performance.now(), offsets = new Uint32Array(9002)
  const cell = (y: number) => Math.max(0, Math.min(9000, Math.floor((y / 100000 + 90) * 50)))
  for (let i=0; i<lookup.eligible.length; i++) if (lookup.eligible[i]) offsets[cell(graph.xy[i*2+1])+1]++
  for (let i=1; i<offsets.length; i++) offsets[i]+=offsets[i-1]
  const nodes = new Uint32Array(offsets[offsets.length-1]), cursor = offsets.slice()
  for (let i=0; i<lookup.eligible.length; i++) if (lookup.eligible[i]) nodes[cursor[cell(graph.xy[i*2+1])]++]=i
  releaseBuffers(cursor)
  const result={offsets,nodes,buildMs:performance.now()-begun};spatial.set(graph,result);return result
}
function candidates(graph: Graph, point: Point, lookup: ReturnType<typeof index>) {
  if (!(globalThis as unknown as {indexedEndpoints?:boolean}).indexedEndpoints) return scanCandidates(graph,point,lookup)
  const ix=latitudeIndex(graph,lookup), choices=new Map<number,Endpoint>(), scale=Math.cos(point.lat*Math.PI/180)
  const radius=maximumSnapMetres/metresPerDegree, limit=radius**2
  // Expand by one bin on each side, then apply the original exact distance test.
  const lo=Math.max(0,Math.floor((point.lat-radius+90)*50)-1),hi=Math.min(9000,Math.floor((point.lat+radius+90)*50)+1)
  for(let k=ix.offsets[lo];k<ix.offsets[hi+1];k++){
    const i=ix.nodes[k],lon=graph.xy[i*2]/100000,lat=graph.xy[i*2+1]/100000
    const dx=(lon-point.lon)*scale,dy=lat-point.lat,distance=dx*dx+dy*dy
    if (!(distance<=limit))continue
    const snapMetres=Math.sqrt(distance)*metresPerDegree,group=lookup.component[i],previous=choices.get(group)
    if(!previous||snapMetres<previous.snapMetres||(snapMetres===previous.snapMetres&&i<previous.node))choices.set(group,{...point,node:i,lon,lat,snapMetres})
  }
  if(!choices.size)throw new Error(`No road within 2 km of ${point.name}. Choose a point closer to the network.`)
  return choices
}
export function endpointIndexAudit(graph: Graph, start:Point,goal:Point){
 const baseline=snapEndpoints(graph,start,goal), began=performance.now()
 ;(globalThis as unknown as {indexedEndpoints:boolean}).indexedEndpoints=true
 const candidate=snapEndpoints(graph,start,goal), elapsed=performance.now()-began
 ;(globalThis as unknown as {indexedEndpoints:boolean}).indexedEndpoints=false
 const ix=spatial.get(graph)!
 const exact=JSON.stringify([baseline.start,baseline.goal,baseline.snapping])===JSON.stringify([candidate.start,candidate.goal,candidate.snapping])
 return {baselineMs:baseline.snapMs,indexedMs:elapsed,buildMs:ix.buildMs,indexBytes:ix.nodes.byteLength+ix.offsets.byteLength,eligibleNodes:ix.nodes.length,exact}
}
'''
s+=insert;p.write_text(s)
p=r/'src/search/search.worker.ts';s=p.read_text().replace("import { releaseEndpointIndex, snapSources }", "import { endpointIndexAudit, releaseEndpointIndex, snapSources }").replace('      const auditStart = performance.now();', '      const endpointAudit=endpointIndexAudit(graph,request.start,request.goal);\n      const auditStart = performance.now();').replace('heuristicPhases:', 'endpointAudit, heuristicPhases:');p.write_text(s)
