"""Experimental bounded-memory packaging; preserves the existing connectivity profile.

Two source passes share a disk-backed location index. No national edge/shape JSON
copies are assembled. Prove chunk parity against an existing release before use.
"""
import argparse
import array
import collections
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--country', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--location-index', type=Path, help='Reuse a complete node index from this exact checksum-verified source')
args = parser.parse_args()
import osmium
country = json.loads(args.country.read_text())
source = country['source']
assert args.source.stat().st_size == source['bytes'], 'Source size mismatch'
with args.source.open('rb') as handle:
    assert hashlib.file_digest(handle, 'sha256').hexdigest() == source['sha256'], 'Source checksum mismatch'
projection = country['projection']
out = args.output / ('.building-' + country['datasetPrefix'])
out.mkdir(parents=True, exist_ok=True)
started = time.perf_counter()
def log(*values):
    print(round(time.perf_counter() - started, 2), *values, flush=True)
CLASSES = 'motorway motorway_link trunk trunk_link primary primary_link secondary secondary_link tertiary tertiary_link unclassified residential living_street service road'.split()
DENY = {'no', 'private', 'agricultural', 'forestry'}
KEYS = {'highway', 'oneway', 'junction', 'access', 'vehicle', 'motor_vehicle', 'motorcar', 'maxspeed', 'maxheight', 'maxwidth', 'maxweight', 'toll', 'bridge', 'tunnel', 'surface', 'service', 'impassable', 'ford'}
def eligible(w):
    kind = w.tags.get('highway')
    if kind not in CLASSES: return None
    access = next((w.tags.get(k) for k in ('motorcar', 'motor_vehicle', 'vehicle', 'access') if w.tags.get(k) is not None), None)
    if access in DENY or w.tags.get('impassable') == 'yes': return None
    if len(w.nodes) < 2 or any(not n.location.valid() for n in w.nodes): return None
    return {t.k: t.v for t in w.tags if t.k in KEYS or ':' in t.k and t.k.split(':')[0] in KEYS}

class Survey(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.uses = collections.Counter(); self.controls = {}; self.restrictions = []
        self.ways = set(); self.profiles = []; self.profile_ids = {}; self.classes = collections.Counter()
    def node(self, n):
        if 'barrier' in n.tags or n.tags.get('highway') in {'traffic_signals', 'stop', 'give_way', 'motorway_junction'}:
            self.controls[n.id] = {t.k: t.v for t in n.tags if t.k in KEYS or t.k in {'barrier', 'direction'} or ':' in t.k and t.k.split(':')[0] in KEYS}
    def way(self, w):
        tags = eligible(w)
        if tags is None: return
        signature = tuple(sorted(tags.items()))
        if signature not in self.profile_ids:
            self.profile_ids[signature] = len(self.profiles); self.profiles.append(tags)
        self.uses.update(n.ref for n in w.nodes); self.ways.add(w.id); self.classes[tags['highway']] += 1
        if len(self.ways) % 1000000 == 0: log('survey', len(self.ways), 'selected ways', len(self.uses), 'shape nodes')
    def relation(self, r):
        if r.tags.get('type') == 'restriction': self.restrictions.append([r.id, dict(r.tags), [[m.type, m.ref, m.role] for m in r.members]])

# Keep the same location index alive for the ways-only second source pass.
index_path = args.location_index or out / 'locations.idx'
if args.location_index:
    assert index_path.is_file(), 'Missing reusable location index'
else:
    if index_path.exists(): index_path.unlink()
locations = osmium.index.create_map('sparse_file_array,' + str(index_path))
locator = osmium.NodeLocationsForWays(locations); locator.ignore_errors()
survey = Survey()
if args.location_index:
    # Controls need node tags, but the reusable map must not receive nodes twice.
    with osmium.io.Reader(str(args.source), osmium.osm.osm_entity_bits.NODE) as reader:
        assert reader.header().get('osmosis_replication_timestamp') == source['dataTimestamp']
        osmium.apply(reader, osmium.filter.KeyFilter('highway', 'barrier'), survey)
    entities = osmium.osm.osm_entity_bits.WAY | osmium.osm.osm_entity_bits.RELATION
    with osmium.io.Reader(str(args.source), entities) as reader:
        osmium.apply(reader, osmium.filter.KeyFilter('highway', 'type'), locator, survey)
else:
    with osmium.io.Reader(str(args.source)) as reader:
        stamp = reader.header().get('osmosis_replication_timestamp')
        assert stamp == source['dataTimestamp'], 'Source timestamp mismatch'
        # All nodes reach the index; non-road ways never trigger coordinate lookup.
        road_ways = osmium.filter.KeyFilter('highway').enable_for(osmium.osm.osm_entity_bits.WAY)
        osmium.apply(reader, road_ways, locator, osmium.filter.KeyFilter('highway', 'barrier', 'type'), survey)
restrictions = [r for r in survey.restrictions if any(m[0] == 'w' and m[1] in survey.ways for m in r[2])]
via_nodes = {m[1] for r in restrictions for m in r[2] if m[0] == 'n' and m[2] == 'via'}
log('survey complete', len(survey.ways), 'ways', len(survey.uses), 'shape nodes')
chunks = []; nodes = array.array('i'); node_osm = array.array('Q'); edge_osm = array.array('Q'); node_ids = {}
bounds = [math.inf, math.inf, -math.inf, -math.inf]
def save(kind, index, start, count, payload, stride):
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    sha = hashlib.sha256(compressed).hexdigest()
    name = f'{kind}-{index:03d}-{sha[:12]}.bin.gz.bin'
    path = out / name
    if path.exists(): assert path.read_bytes() == compressed, 'Immutable chunk differs'
    else: path.write_bytes(compressed)
    chunks.append(dict(kind=kind, path=name, start=start, count=count, stride=stride, bytes=len(compressed), decodedBytes=len(payload), sha256=sha))
def graph_node(n):
    found = node_ids.get(n.ref)
    if found is not None: return found
    found = len(node_osm); node_ids[n.ref] = found; node_osm.append(n.ref)
    x, y = round(n.lon * 100000), round(n.lat * 100000); nodes.extend((x, y))
    longitude = x / 100000 - projection['centre'][0]
    if projection.get('longitudeWrapping') == 'centre/1':
        if longitude > 180: longitude -= 360
        if longitude < -180: longitude += 360
    px = longitude * math.cos(math.radians(projection['referenceLatitude'])) * 111195.0802 / projection['scaleMetres']
    py = (y / 100000 - projection['centre'][1]) * 111195.0802 / projection['scaleMetres']
    assert abs(px) <= 1 and abs(py) <= 1, 'Projection outside extent'
    bounds[0] = min(bounds[0], px); bounds[1] = min(bounds[1], py); bounds[2] = max(bounds[2], px); bounds[3] = max(bounds[3], py)
    return found
# The exact existing Douglas–Peucker implementation, loaded without its CLI.
import ast
sizing_path = Path(__file__).with_name('size-proof.py')
module = ast.parse(sizing_path.read_text())
function = next(item for item in module.body if isinstance(item, ast.FunctionDef) and item.name == 'simplify')
exec(compile(ast.Module(body=[function], type_ignores=[]), str(sizing_path), 'exec'))

class Package(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.edges = []; self.counts = array.array('H'); self.deltas = array.array('i')
        self.edge_count = 0; self.directed = 0; self.vertices = 0; self.way_count = 0
    def flush_edges(self):
        if not self.edges: return
        count = len(self.edges); start = self.edge_count - count; payload = bytearray(count * 14); previous = 0
        for i, (u, v, length, direction, category) in enumerate(self.edges):
            struct.pack_into('<i', payload, i * 4, u - previous)
            struct.pack_into('<i', payload, count * 4 + i * 4, v - u)
            struct.pack_into('<I', payload, count * 8 + i * 4, length)
            payload[count * 12 + i] = direction; payload[count * 13 + i] = category; previous = u
        save('edges', start // 200000, start, count, payload, 14); self.edges = []
    def flush_geometry(self):
        if not self.counts: return
        count = len(self.counts); start = self.edge_count - count
        if sys.byteorder != 'little': self.counts.byteswap(); self.deltas.byteswap()
        save('geometry', start // 100000, start, count, self.counts.tobytes() + self.deltas.tobytes(), 0)
        self.counts = array.array('H'); self.deltas = array.array('i')
    def way(self, w):
        if w.id not in survey.ways: return
        tags = eligible(w)
        assert tags is not None, 'Source geometry changed between passes'
        one = tags.get('oneway')
        direction = 2 if one == '-1' else 1 if one in ('yes', '1', 'true') or one is None and (tags.get('junction') == 'roundabout' or tags.get('highway') == 'motorway') else 0
        begin = 0; u = graph_node(w.nodes[0]); self.way_count += 1
        for i in range(1, len(w.nodes)):
            n = w.nodes[i]
            if i == len(w.nodes) - 1 or survey.uses[n.ref] > 1 or n.ref in survey.controls or n.ref in via_nodes:
                v = graph_node(n); shape = [(w.nodes[j].lon, w.nodes[j].lat) for j in range(begin, i + 1)]
                length = sum(math.hypot((b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2)), b[1] - a[1]) * 111195.0802 for a, b in zip(shape, shape[1:]))
                self.edges.append((u, v, round(length * 100), direction, CLASSES.index(tags['highway'])))
                edge_osm.append(w.id); self.edge_count += 1; self.directed += 2 if direction == 0 else 1
                simplified = simplify(shape, 5); interior = len(simplified) - 2
                assert interior < 65536, 'Road shape exceeds encoding'
                self.counts.append(interior); self.vertices += (interior + 1) * 2
                x, y = round(simplified[0][0] * 100000), round(simplified[0][1] * 100000)
                for point in simplified[1:-1]:
                    nx, ny = round(point[0] * 100000), round(point[1] * 100000)
                    self.deltas.extend((nx - x, ny - y)); x, y = nx, ny
                if len(self.counts) == 100000: self.flush_geometry()
                if len(self.edges) == 200000: self.flush_edges()
                u, begin = v, i
        if self.way_count % 1000000 == 0: log('packaged', self.way_count, 'ways', self.edge_count, 'edges', len(node_osm), 'nodes')

package = Package()
with osmium.io.Reader(str(args.source), osmium.osm.osm_entity_bits.WAY) as reader:
    osmium.apply(reader, osmium.filter.KeyFilter('highway'), locator, package)
assert package.way_count == len(survey.ways), 'Incomplete source-way coverage'
package.flush_edges(); package.flush_geometry()
for index, start in enumerate(range(0, len(node_osm), 250000)):
    count = min(250000, len(node_osm) - start); values = array.array('i'); x = y = 0
    for n in range(start, start + count):
        nx, ny = nodes[n * 2:n * 2 + 2]; values.extend((nx - x, ny - y)); x, y = nx, ny
    if sys.byteorder != 'little': values.byteswap()
    save('nodes', index, start, count, values.tobytes(), 8)
controls = [[node_ids[n], tags] for n, tags in survey.controls.items() if n in node_ids]
# Stream ODbL/source evidence rather than assembling another national JSON copy.
evidence_path = out / 'evidence.partial'
with evidence_path.open('wb') as raw:
    with gzip.GzipFile(filename='', mode='wb', fileobj=raw, compresslevel=9, mtime=0) as compressed:
        def write(value): compressed.write(value.encode())
        def field(name, value, comma=True):
            write((',' if comma else '') + json.dumps(name) + ':'); write(json.dumps(value, separators=(',', ':')))
        write('{'); field('licence', 'ODbL-1.0', False); field('profiles', survey.profiles); field('controls', controls); field('restrictions', restrictions)
        for name, values in [('nodeOsmIds', node_osm), ('edgeOsmWayIds', edge_osm)]:
            write(',' + json.dumps(name) + ':[')
            for start in range(0, len(values), 100000):
                write((',' if start else '') + ','.join(map(str, values[start:start + 100000])))
            write(']')
        write('}')
with evidence_path.open('rb') as f: evidence_sha = hashlib.file_digest(f, 'sha256').hexdigest()
evidence_name = f'evidence-{evidence_sha[:12]}.json.gz.bin'; evidence_bytes = evidence_path.stat().st_size
evidence_path.replace(out / evidence_name)
chunks.sort(key=lambda c: (['nodes', 'edges', 'geometry'].index(c['kind']), c['start']))
payload = dict(chunks=chunks, projection=projection, profile='road-connectivity-distance-v1')
identity = subprocess.run(['node', str(Path(__file__).with_name('manifest-identity.mjs'))], input=json.dumps(payload).encode(), stdout=subprocess.PIPE, check=True).stdout.decode()
dataset = country['datasetPrefix'] + '-' + identity[:12]
manifest = dict(schema='pfad-road-study/1', encoding='le-columnar-deltas/1', id=dataset, identity=identity, compiler='pfad-study-streaming-compiler/1', profile='road-connectivity-distance-v1', source={k: source[k] for k in ['provider','dataTimestamp','url','sha256','attribution','licence','licenceUrl','inputs','composition'] if k in source}, cost='Original road length in integer centimetres; shortest distance, not estimated travel time.', limitations=['Turn restrictions, barriers and conditional access are retained as source evidence but are not applied.', 'Ferries and non-motor-road classes are excluded. Experimental desktop feasibility study.'], counts=dict(nodes=len(node_osm), edges=package.edge_count, directedArcs=package.directed, vertices=package.vertices), coordinateScale=100000, projection=projection, bounds=bounds, classes=CLASSES, geometryToleranceMetres=5, chunks=chunks, evidence=dict(path=evidence_name, bytes=evidence_bytes, sha256=evidence_sha), downloadBytes=sum(c['bytes'] for c in chunks))
manifest['coverage'] = country['coverage']
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
(out / 'build-report.json').write_text(json.dumps(dict(elapsedSeconds=time.perf_counter()-started, selectedWays=package.way_count, roadShapeNodes=len(survey.uses), roadClasses=dict(survey.classes), counts=manifest['counts'], downloadBytes=manifest['downloadBytes']), indent=2) + '\n')
# Release the mapping before removing its ignored temporary index.
del locator; del locations
local_index = out / 'locations.idx'
if local_index.exists(): local_index.unlink()
final = args.output / dataset
assert not final.exists(), 'Refusing to replace an existing release'
out.rename(final)
log('complete', str(final / 'manifest.json'), manifest['counts'], manifest['downloadBytes'])
