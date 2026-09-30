import argparse
import brotli, gzip, json, pathlib
from collections import defaultdict
parser=argparse.ArgumentParser(description='Compact an existing PFAD sizing export')
parser.add_argument('--directory',type=pathlib.Path,required=True)
root=parser.parse_args().directory
g=json.loads((root/'graph.json').read_bytes())
node_map={g['nodes'][i+2]:i//3 for i in range(0,len(g['nodes']),3)}
way_map=defaultdict(list)
xy=[]
px=py=0
for i in range(0,len(g['nodes']),3):
    x,y=g['nodes'][i:i+2]
    xy.extend((x-px,y-py))
    px,py=x,y
columns=[[] for _ in range(5)]
previous=0
for i,(u,v,cost,direction,profile,osmid) in enumerate(g['edges']):
    for col,value in zip(columns,(u-previous,v-u,cost,direction,profile)):
        col.append(value)
    previous=u
    way_map[osmid].append(i)
restrictions=[]
unresolved=0
for rid,tags,members in g['restrictions']:
    resolved=[]
    for typ,ref,role in members:
        target=way_map.get(ref) if typ=='w' else node_map.get(ref) if typ=='n' else None
        if target is None:
            unresolved+=1
            resolved.append([typ,None,role,ref])
        else:
            resolved.append([typ,target,role])
    restrictions.append([tags,resolved])
runtime={'coordinateScale':100000,'nodeDeltas':xy,'edgeFromDeltas':columns[0],'edgeToRelative':columns[1],'edgeLengthCm':columns[2],'edgeDirection':columns[3],'edgeProfile':columns[4],'profiles':g['profiles'],'controls':g['controls'],'restrictions':restrictions}
def save(name,obj):
    raw=json.dumps(obj,separators=(',',':'),ensure_ascii=False).encode()
    gz=gzip.compress(raw,compresslevel=9,mtime=0)
    br=brotli.compress(raw,quality=9)
    (root/(name+'.json')).write_bytes(raw)
    (root/(name+'.json.gz')).write_bytes(gz)
    (root/(name+'.json.br')).write_bytes(br)
    result={'json_bytes':len(raw),'gzip_bytes':len(gz),'brotli_q9_bytes':len(br)}
    print(name,result,flush=True)
    return result
report={'note':'Same nodes/edges as graph.json. Columnar arrays and deltas, OSM provenance IDs removed from delivery payload. Restriction references mapped to dense graph IDs; missing references explicitly retained for audit, not silently resolved. Restriction interpretation remains unimplemented.','unresolved_restriction_members':unresolved,'graph':save('runtime-graph',runtime),'geometry':{}}
for tolerance in [0,5,15]:
    file=root/f'geometry-{tolerance}m.json'
    if not file.exists(): raise SystemExit(f"Missing geometry export: {file}")
    geo=json.loads(file.read_bytes())
    offsets=geo.pop('offsets')
    geo['counts']=[b-a for a,b in zip(offsets,offsets[1:])]
    result=save(f'runtime-geometry-{tolerance}m',geo)
    result['combined_gzip_bytes']=result['gzip_bytes']+report['graph']['gzip_bytes']
    result['combined_brotli_bytes']=result['brotli_q9_bytes']+report['graph']['brotli_q9_bytes']
    report['geometry'][str(tolerance)]=result
(root/'compact-report.json').write_text(json.dumps(report,indent=2)+'\n')
