"""Manual preparation from pinned Natural Earth GeoJSON in ignored .cache/."""
import argparse
import hashlib
import json
import math
from pathlib import Path

REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19'
SOURCES = {
    'ne_10m_admin_0_countries': '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255',
    'ne_10m_lakes': '2d036f53dedec578001c5c30c2959ee7d4eebc1306900fa4367c49929ec8f2d9',
    'ne_10m_lakes_europe': 'b4dd9e7a5edd0d07b54768b5404d1ebe77f80b9d579c85fff65f90cf50369769',
}
def read(name):
    raw = Path(f'.cache/{name}.geojson').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SOURCES[name], 'Source checksum mismatch'
    return json.loads(raw)['features']

def polygons(geometry):
    return geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]

def inside(point, ring):
    x, y = point; result = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0]) * (y-a[1]) / (b[1]-a[1]) + a[0]:
            result = not result
    return result

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('country')
args = parser.parse_args()
config = json.loads(Path('data/geography-countries.json').read_text())[args.country]
SX = 111195.0802 * math.cos(math.radians(config['referenceLatitude'])); SY = 111195.0802
def longitude(x):
    centre = config.get('longitudeCentre')
    if centre is None: return x
    delta = x-centre
    return x-360 if delta > 180 else x+360 if delta < -180 else x
def covered(point):
    x, y = point; west, south, east, north = config['bounds']
    return west <= longitude(x) <= east and south <= y <= north
def unwrap(shape):
    return [[[longitude(x), y] for x, y in r] for r in shape]
def simplify(points, tolerance):
    a, b = points[0], points[-1]; dx = (b[0]-a[0])*SX; dy = (b[1]-a[1])*SY
    maximum, index = 0, 0
    for i, p in enumerate(points[1:-1], 1):
        px, py = (p[0]-a[0])*SX, (p[1]-a[1])*SY
        t = max(0, min(1, (px*dx+py*dy)/(dx*dx+dy*dy))) if dx or dy else 0
        distance = math.hypot(px-t*dx, py-t*dy)
        if distance > maximum: maximum, index = distance, i
    if maximum > tolerance:
        return simplify(points[:index+1], tolerance)[:-1] + simplify(points[index:], tolerance)
    return [a, b]

def ring(points, tolerance):
    result = simplify(points, tolerance)
    if len(result) < 4: result = points
    return [[round(x-360 if x > 180 else x+360 if x < -180 else x, 5), round(y, 5)] for x, y in result]

def metadata(name, tolerance):
    return dict(source='Natural Earth 1:10m ' + name, edition=REVISION,
                sourceUrl=f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{REVISION}/geojson/{name}.geojson',
                sourceSha256=SOURCES[name], productUrl='https://www.naturalearthdata.com/',
                attribution='Natural Earth · public domain', sourceCrs='EPSG:4326', outputCrs='EPSG:4326',
                simplificationToleranceMetres=tolerance, preparation='pfad-country-geography/1')

features = read('ne_10m_admin_0_countries')
components = [{'admin': config['admin'], 'bounds': config['bounds']}] + config.get('additionalComponents', [])
land = []
for component in components:
    country = next(f for f in features if f['properties']['ADMIN'] == component['admin'])
    west, south, east, north = component['bounds']
    for polygon in polygons(country['geometry']):
        points = polygon[0]
        included = [west <= longitude(x) <= east and south <= y <= north for x, y in points]
        if (all(included) if component.get('completePolygons') else any(included)):
            land.append(unwrap(polygon))
if config.get('dissolve'):
    import shapely
    from shapely.geometry import Polygon, mapping
    from shapely.ops import unary_union
    assert shapely.__version__ == '2.1.2', 'Use the pinned geographic preparation dependency'
    union = unary_union([Polygon(p[0], p[1:]) for p in land])
    assert union.is_valid and not union.is_empty
    land = polygons(mapping(union))
assert land, 'No country polygons within coverage'
tolerance = config.get('borderToleranceMetres', 300)
border = dict(metadata=metadata('ne_10m_admin_0_countries', tolerance), rings=[ring(p[0], tolerance) for p in land])
if config.get('dissolve'):
    border['metadata'].update(components=components, operation='polygon-union-before-simplification', shapelyVersion=shapely.__version__, geosVersion=shapely.geos_version_string)
lakes = []; seen = set()
for feature in read('ne_10m_lakes') + read('ne_10m_lakes_europe'):
    shapes = [unwrap(s) for s in polygons(feature['geometry'])]
    points = [p for shape in shapes for p in shape[0]]
    if not any(covered(p) for p in points): continue
    if not any(any(inside(point, p[0]) and not any(inside(point, hole) for hole in p[1:]) for p in land) for point in points): continue
    properties = feature['properties']; identifier = str(properties['ne_id'])
    if identifier in seen: continue
    seen.add(identifier)
    area = sum(abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(s[0],s[0][1:]))) * SX * SY / 2e6 for s in shapes)
    lakes.append(dict(id=identifier, name=properties['name'], areaSquareKilometres=round(area, 2),
                      polygons=[[ring(r, 60) for r in shape] for shape in shapes]))
water = dict(metadata=metadata('ne_10m_lakes', 60), lakes=lakes)
water['metadata']['additionalSource'] = metadata('ne_10m_lakes_europe', 60)
registry = json.loads(Path('data/geography-sources.json').read_text())
for suffix, data in [('border', border), ('lakes', water)]:
    path = Path(f'src/map/data/{args.country}-{suffix}.json')
    data['metadata']['coverageBounds'] = config['bounds']
    raw = (json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n').encode()
    path.write_bytes(raw)
    asset = dict(path=str(path), bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
                 source=data['metadata']['source'], attribution=data['metadata']['attribution'],
                 simplificationToleranceMetres=data['metadata']['simplificationToleranceMetres'],
                 preparation=f'python3 scripts/data/prepare-country-geography.py {args.country}', bounds=config['bounds'])
    registry['assets'] = [a for a in registry['assets'] if a['path'] != str(path)] + [asset]
    print(path, len(raw), asset['sha256'])
Path('data/geography-sources.json').write_text(json.dumps(registry, indent=2)+'\n')
print('Border rings:', len(border['rings']), 'Lakes:', [lake['name'] for lake in lakes])
