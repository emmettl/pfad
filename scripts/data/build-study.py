"""Package the verified national sizing graph as bounded browser study chunks.

This first connectivity profile preserves the sizing graph exactly. Direction
and original edge length are enforced; turn/time-dependent restrictions remain
evidence, not applied navigation rules. This limitation is part of the manifest.
"""
import argparse
import array
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--sizing', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--country', type=Path, help='Pinned country release configuration; does not replace the bundled edition')
parser.add_argument('--experiment', action='store_true', help='Package without selecting the dataset for publication')
parser.add_argument('--dataset-prefix', default='ch-20260929')
parser.add_argument('--projection', type=Path, help='Explicit drawing projection for another national extent')
args = parser.parse_args()
country = json.loads(args.country.read_text()) if args.country else None
if country:
    args.dataset_prefix = country['datasetPrefix']
    args.experiment = True
report = json.loads((args.sizing / 'report.json').read_text())
source = report['source']
SOURCE_HASH = source.get('sha256', '95e29e18873357b927d22daa0bfc08a35e8840079a591cd70ba24a4208b4a4dd')
if not args.experiment:
    assert SOURCE_HASH == '95e29e18873357b927d22daa0bfc08a35e8840079a591cd70ba24a4208b4a4dd' and args.dataset_prefix == 'ch-20260929' and args.projection is None, 'Another national dataset must be packaged as an experiment until explicitly selected for publication'
if country:
    assert SOURCE_HASH == country['source']['sha256'] and source['url'] == country['source']['url'], 'Country source differs from the pinned release'
with args.source.open('rb') as handle:
    assert hashlib.file_digest(handle, 'sha256').hexdigest() == SOURCE_HASH, 'Wrong source snapshot'
assert args.source.stat().st_size == source['bytes'], 'Wrong source byte length'
raw = (args.sizing / 'graph.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == report['graph']['sha256'], 'Sizing graph checksum mismatch'
graph = json.loads(raw)
del raw
runtime_geometry = args.sizing / 'runtime-geometry-5m.json'
if runtime_geometry.exists():
    geometry = json.loads(runtime_geometry.read_bytes())
else:
    # The columnar packaging does not need the separate compact-JSON proof.
    geometry_raw = (args.sizing / 'geometry-5m.json').read_bytes()
    assert hashlib.sha256(geometry_raw).hexdigest() == report['variants']['5']['sha256'], 'Drawing geometry checksum mismatch'
    geometry = json.loads(geometry_raw)
    del geometry_raw
    source_offsets = geometry.pop('offsets')
    geometry['counts'] = [b - a for a, b in zip(source_offsets, source_offsets[1:])]
    del source_offsets
offsets = [0]
for count in geometry['counts']: offsets.append(offsets[-1] + count)
original_geometry = {'toleranceMetres': 5, 'coordinateScale': 100000, 'offsets': offsets, 'deltas': geometry['deltas']}
original_bytes = json.dumps(original_geometry, separators=(',', ':'), ensure_ascii=False).encode()
assert hashlib.sha256(original_bytes).hexdigest() == report['variants']['5']['sha256'], 'Drawing geometry checksum mismatch'
del offsets, original_geometry, original_bytes
classes = 'motorway motorway_link trunk trunk_link primary primary_link secondary secondary_link tertiary tertiary_link unclassified residential living_street service road'.split()
node_count = len(graph['nodes']) // 3
edge_count = len(graph['edges'])
assert len(geometry['counts']) == edge_count
projection = country['projection'] if country else json.loads(args.projection.read_text()) if args.projection else {'centre': [8.23, 46.82], 'referenceLatitude': 46.82, 'scaleMetres': 200000, 'quantisationMetres': 200000 / 32767}
chunks = []
files = {}

def save(kind, index, start, count, payload, stride):
    if stride: assert len(payload) == count * stride
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    checksum = hashlib.sha256(compressed).hexdigest()
    # A terminal .gz is interpreted as HTTP Content-Encoding by some static
    # servers. Keep the gzip container opaque so fetch verifies stored bytes.
    filename = f'{kind}-{index:03d}-{checksum[:12]}.bin.gz.bin'
    files[filename] = compressed
    chunks.append({'kind': kind, 'path': filename, 'start': start, 'count': count, 'stride': stride, 'bytes': len(compressed), 'decodedBytes': len(payload), 'sha256': checksum})

for index, start in enumerate(range(0, node_count, 250000)):
    count = min(250000, node_count - start)
    values = array.array('i')
    px = py = 0
    for n in range(start, start + count):
        x, y = graph['nodes'][3 * n:3 * n + 2]
        values.extend((x - px, y - py)); px, py = x, y
    if sys.byteorder != 'little': values.byteswap()
    save('nodes', index, start, count, values.tobytes(), 8)
for index, start in enumerate(range(0, edge_count, 200000)):
    count = min(200000, edge_count - start)
    payload = bytearray(count * 14)
    previous_from = 0
    for offset, edge in enumerate(graph['edges'][start:start + count]):
        u, v, length, direction, profile, _ = edge
        assert 0 <= u < node_count and 0 <= v < node_count and 0 <= direction <= 2 and length >= 0
        struct.pack_into('<i', payload, offset * 4, u - previous_from)
        struct.pack_into('<i', payload, count * 4 + offset * 4, v - u)
        struct.pack_into('<I', payload, count * 8 + offset * 4, length)
        payload[count * 12 + offset] = direction
        payload[count * 13 + offset] = classes.index(graph['profiles'][profile]['highway'])
        previous_from = u
    save('edges', index, start, count, payload, 14)

bounds = [math.inf, math.inf, -math.inf, -math.inf]
def project(x, y):
    px = (x / 100000 - projection['centre'][0]) * math.cos(math.radians(projection['referenceLatitude'])) * 111195.0802 / projection['scaleMetres']
    py = (y / 100000 - projection['centre'][1]) * 111195.0802 / projection['scaleMetres']
    assert abs(px) <= 1 and abs(py) <= 1, 'Projection outside quantised extent'
    bounds[0] = min(bounds[0], px); bounds[1] = min(bounds[1], py)
    bounds[2] = max(bounds[2], px); bounds[3] = max(bounds[3], py)
    return round(px * 32767), round(py * 32767)

delta_cursor = 0
vertex_count = 0
for index, start in enumerate(range(0, edge_count, 100000)):
    count = min(edge_count - start, 100000)
    counts = array.array('H', geometry['counts'][start:start + count])
    assert all(x < 65536 for x in counts)
    point_count = sum(counts)
    deltas = array.array('i', geometry['deltas'][delta_cursor:delta_cursor + point_count * 2])
    delta_cursor += point_count * 2
    if sys.byteorder != 'little': counts.byteswap(); deltas.byteswap()
    payload = counts.tobytes() + deltas.tobytes()
    save('geometry', index, start, count, payload, 0)
    vertex_count += (point_count + count) * 2
    for eid in range(start, start + count):
        for n in graph['edges'][eid][:2]: project(*graph['nodes'][3 * n:3 * n + 2])
assert delta_cursor == len(geometry['deltas'])

evidence = json.dumps({'licence': 'ODbL-1.0', 'profiles': graph['profiles'], 'controls': graph['controls'], 'restrictions': graph['restrictions'], 'nodeOsmIds': graph['nodes'][2::3], 'edgeOsmWayIds': [e[5] for e in graph['edges']]}, separators=(',', ':')).encode()
evidence_gz = gzip.compress(evidence, compresslevel=9, mtime=0)
evidence_sha = hashlib.sha256(evidence_gz).hexdigest()
evidence_name = f'evidence-{evidence_sha[:12]}.json.gz.bin'
files[evidence_name] = evidence_gz
identity_payload = {'chunks': chunks, 'projection': projection, 'profile': 'road-connectivity-distance-v1'}
identity = (subprocess.run(['node', str(Path(__file__).with_name('manifest-identity.mjs'))], input=json.dumps(identity_payload).encode(), stdout=subprocess.PIPE, check=True).stdout.decode() if country else hashlib.sha256(json.dumps(identity_payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest())
dataset = f'{args.dataset_prefix}-{identity[:12]}'
manifest = {
    'schema': 'pfad-road-study/1', 'encoding': 'le-columnar-deltas/1', 'id': dataset, 'identity': identity,
    'compiler': 'pfad-study-compiler/2' if country else 'pfad-study-compiler/1', 'profile': 'road-connectivity-distance-v1',
    'source': {'provider': 'OpenStreetMap via Geofabrik', 'dataTimestamp': source['data_timestamp'], 'url': source['url'], 'sha256': SOURCE_HASH, 'attribution': '© OpenStreetMap contributors', 'licence': 'ODbL-1.0', 'licenceUrl': 'https://www.openstreetmap.org/copyright'},
    'cost': 'Original road length in integer centimetres; shortest distance, not estimated travel time.',
    'limitations': ['Turn restrictions, barriers and conditional access are retained as source evidence but are not applied by this first connectivity profile.', 'Ferries and non-motor-road classes are excluded. This is a computation study, not navigation advice.'],
    'counts': {'nodes': node_count, 'edges': edge_count, 'directedArcs': report['directed_arcs'], 'vertices': vertex_count},
    'coordinateScale': 100000, 'projection': projection, 'bounds': bounds, 'classes': classes,
    'geometryToleranceMetres': 5, 'chunks': chunks,
    'evidence': {'path': evidence_name, 'bytes': len(evidence_gz), 'sha256': evidence_sha},
    'downloadBytes': sum(c['bytes'] for c in chunks),
}
out = args.output / dataset
out.mkdir(parents=True, exist_ok=True)
for name, data in files.items():
    target = out / name
    if target.exists(): assert target.read_bytes() == data, 'Refusing to change immutable data'
    else: target.write_bytes(data)
manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode()
target = out / 'manifest.json'
if target.exists(): assert target.read_bytes() == manifest_bytes, 'Refusing to change immutable manifest'
else: target.write_bytes(manifest_bytes)
if not args.experiment:
    edition_path = args.output.parents[0] / 'pfad-manifest.json'
    edition = json.loads(edition_path.read_text())
    edition['status'] = 'study'
    edition['graph'] = {'manifest': f'./pfad/{dataset}/manifest.json', 'identity': identity, 'profile': manifest['profile']}
    edition['evidence']['productionRoutingValidated'] = False
    edition_path.write_text(json.dumps(edition, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'dataset': dataset, 'downloadBytes': manifest['downloadBytes'], 'sourceEvidenceBytes': len(evidence_gz), 'chunks': len(chunks), 'nodes': node_count, 'edges': edge_count, 'vertices': vertex_count}, indent=2))
