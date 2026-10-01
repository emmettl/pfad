"""PFAD national download sizing experiment; not a production routing engine.

Keeps residential/service roads, directed connectivity, way IDs, routing tags,
restriction relations, and node controls. Geometry simplification never changes
the graph or measured edge lengths. Conditional/access/turn rules are retained
for size accounting but are NOT implemented by this experiment.
"""
import argparse
import array
import collections
import gzip
import hashlib
import json
import math
import pathlib
import time

import brotli
import osmium

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
parser.add_argument('--provenance', type=pathlib.Path, help='Explicit source URL, timestamp, bytes and SHA-256 for another dated experiment')
args = parser.parse_args()
OUT = args.output
OUT.mkdir(exist_ok=True)
SOURCE = args.source
with SOURCE.open('rb') as handle:
    source_sha = hashlib.file_digest(handle, 'sha256').hexdigest()
provenance = json.loads(args.provenance.read_text()) if args.provenance else {'url': 'https://download.geofabrik.de/europe/switzerland-260929.osm.pbf', 'data_timestamp': '2026-09-29T20:22:51Z', 'bytes': 547273092, 'sha256': '95e29e18873357b927d22daa0bfc08a35e8840079a591cd70ba24a4208b4a4dd'}
if SOURCE.stat().st_size != provenance['bytes'] or source_sha != provenance['sha256']:
    raise SystemExit('Source does not match the declared byte length and SHA-256; provide explicit provenance for another dated experiment')
CLASSES = 'motorway motorway_link trunk trunk_link primary primary_link secondary secondary_link tertiary tertiary_link unclassified residential living_street service road'.split()
DENY = {'no', 'private', 'agricultural', 'forestry'}
KEYS = {'highway', 'oneway', 'junction', 'access', 'vehicle', 'motor_vehicle', 'motorcar', 'maxspeed', 'maxheight', 'maxwidth', 'maxweight', 'toll', 'bridge', 'tunnel', 'surface', 'service', 'impassable', 'ford'}
started = time.perf_counter()

def log(*args):
    print(round(time.perf_counter()-started, 2), *args, flush=True)

class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways = []
        self.uses = collections.Counter()
        self.controls = {}
        self.restrictions = []
        self.classes = collections.Counter()
        self.profiles = []
        self.profile_ids = {}
        self.excluded = collections.Counter()

    def node(self, n):
        if 'barrier' in n.tags or n.tags.get('highway') in {'traffic_signals', 'stop', 'give_way', 'motorway_junction'}:
            self.controls[n.id] = {t.k: t.v for t in n.tags if t.k in KEYS or t.k in {'barrier', 'direction'} or ':' in t.k and t.k.split(':')[0] in KEYS}

    def way(self, w):
        kind = w.tags.get('highway')
        if kind not in CLASSES:
            return
        access = next((w.tags.get(k) for k in ('motorcar', 'motor_vehicle', 'vehicle', 'access') if w.tags.get(k) is not None), None)
        if access in DENY or w.tags.get('impassable') == 'yes':
            self.excluded[access or 'impassable'] += 1
            return
        if len(w.nodes) < 2 or any(not n.location.valid() for n in w.nodes):
            self.excluded['missing geometry'] += 1
            return
        tags = {t.k:t.v for t in w.tags if t.k in KEYS or ':' in t.k and t.k.split(':')[0] in KEYS}
        signature = tuple(sorted(tags.items()))
        pid = self.profile_ids.get(signature)
        if pid is None:
            pid = len(self.profiles)
            self.profile_ids[signature] = pid
            self.profiles.append(tags)
        ids = array.array('q', (n.ref for n in w.nodes))
        coords = array.array('d', (v for n in w.nodes for v in (n.lon, n.lat)))
        self.uses.update(ids)
        self.ways.append((w.id, pid, ids, coords))
        self.classes[kind] += 1

    def relation(self, r):
        if r.tags.get('type') == 'restriction':
            self.restrictions.append([r.id, dict(r.tags), [[m.type, m.ref, m.role] for m in r.members]])

e = Extract()
# Cache every node location before filtering callbacks. Every relevant node,
# way and restriction has one of these keys; empty/other-tagged objects were
# already ignored by Extract. This reduces Python work without removing roads.
e.apply_file(str(SOURCE), locations=True, idx='flex_mem', filters=[osmium.filter.KeyFilter('highway', 'barrier', 'type')])
log('extracted', len(e.ways), 'ways', len(e.uses), 'road shape nodes')
wayset = {w[0] for w in e.ways}
restrictions = [r for r in e.restrictions if any(m[0]=='w' and m[1] in wayset for m in r[2])]
via_nodes = {m[1] for r in restrictions for m in r[2] if m[0]=='n' and m[2]=='via'}
node_ids = {}
nodes = []
edges = []
shapes = []

def graph_node(osmid, x, y):
    found = node_ids.get(osmid)
    if found is None:
        found = len(nodes)//3
        node_ids[osmid] = found
        nodes.extend((round(x*100000), round(y*100000), osmid))
    return found

for wid, pid, ids, xy in e.ways:
    begin = 0
    u = graph_node(ids[0], xy[0], xy[1])
    tags = e.profiles[pid]
    one = tags.get('oneway')
    direction = 2 if one == '-1' else 1 if one in ('yes','1','true') or one is None and (tags.get('junction')=='roundabout' or tags.get('highway')=='motorway') else 0
    for i in range(1, len(ids)):
        if i == len(ids)-1 or e.uses[ids[i]] > 1 or ids[i] in e.controls or ids[i] in via_nodes:
            v = graph_node(ids[i], xy[2*i], xy[2*i+1])
            shape = [(xy[2*j], xy[2*j+1]) for j in range(begin, i+1)]
            length = sum(math.hypot((b[0]-a[0])*math.cos(math.radians((a[1]+b[1])/2)), b[1]-a[1])*111195.0802 for a,b in zip(shape,shape[1:]))
            edges.append([u,v,round(length*100),direction,pid,wid])
            shapes.append(shape)
            u, begin = v, i
controls = [[node_ids[n], tags] for n,tags in e.controls.items() if n in node_ids]
log('graph',len(nodes)//3,'nodes',len(edges),'edges',len(restrictions),'restriction relations')

def simplify(points, tolerance):
    if tolerance == 0 or len(points) <= 2:
        return points
    sx = 111195.0802*math.cos(math.radians(sum(p[1] for p in points)/len(points)))
    sy = 111195.0802
    keep = {0,len(points)-1}
    stack = [(0,len(points)-1)]
    while stack:
        first,last = stack.pop()
        ax,ay = points[first]
        bx,by = points[last]
        dx,dy = (bx-ax)*sx,(by-ay)*sy
        denominator = dx*dx+dy*dy
        best,at = tolerance*tolerance,-1
        for i in range(first+1,last):
            px,py = (points[i][0]-ax)*sx,(points[i][1]-ay)*sy
            t = max(0,min(1,(px*dx+py*dy)/denominator)) if denominator else 0
            distance = (px-t*dx)**2+(py-t*dy)**2
            if distance > best:
                best,at = distance,i
        if at >= 0:
            keep.add(at)
            stack.extend(((first,at),(at,last)))
    return [points[i] for i in sorted(keep)]

def save(name, obj):
    raw=json.dumps(obj,separators=(',',':'),ensure_ascii=False).encode()
    path=OUT/(name+'.json')
    path.write_bytes(raw)
    gz=gzip.compress(raw,compresslevel=9,mtime=0)
    (OUT/(name+'.json.gz')).write_bytes(gz)
    br=brotli.compress(raw,quality=9)
    (OUT/(name+'.json.br')).write_bytes(br)
    result={'json_bytes':len(raw),'gzip_bytes':len(gz),'brotli_q9_bytes':len(br),'sha256':hashlib.sha256(raw).hexdigest()}
    log(name,result)
    return result

graph={'coordinateScale':100000,'nodeStride':3,'nodeFields':['lon','lat','osmId'],'nodes':nodes,'edgeFields':['from','to','lengthCentimetres','direction_0both_1forward_2reverse','profile','osmWayId'],'edges':edges,'profiles':e.profiles,'controls':controls,'restrictions':restrictions}
report={'source':provenance,'scope':'Country extract, selected motor-road classes including residential/service; basic access filter. Not a validated routing profile. No ferries. Turn/conditional/barrier tags retained, not enforced. Original OSM way endpoints retained.','road_classes':dict(e.classes),'excluded':dict(e.excluded),'road_shape_nodes':len(e.uses),'graph_nodes':len(nodes)//3,'physical_edges':len(edges),'directed_arcs':sum(2 if x[3]==0 else 1 for x in edges),'profiles':len(e.profiles),'restrictions':len(restrictions),'controls':len(controls),'graph':save('graph',graph),'variants':{}}
for tolerance in (0,5,15):
    geometry=[]
    offsets=[0]
    for shape in shapes:
        simplified=simplify(shape,tolerance)
        x,y=round(simplified[0][0]*100000),round(simplified[0][1]*100000)
        for point in simplified[1:-1]:
            nx,ny=round(point[0]*100000),round(point[1]*100000)
            geometry.extend((nx-x,ny-y))
            x,y=nx,ny
        offsets.append(len(geometry)//2)
    result=save(f'geometry-{tolerance}m',{'toleranceMetres':tolerance,'coordinateScale':100000,'offsets':offsets,'deltas':geometry})
    result['interior_vertices']=len(geometry)//2
    result['combined_gzip_bytes']=result['gzip_bytes']+report['graph']['gzip_bytes']
    result['combined_brotli_bytes']=result['brotli_q9_bytes']+report['graph']['brotli_q9_bytes']
    report['variants'][str(tolerance)]=result
report['elapsed_seconds']=time.perf_counter()-started
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
log('complete',str(OUT/'report.json'))
