"""Manual preparation from pinned Natural Earth GeoJSON in ignored .cache/."""
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

SX = 111195.0802 * math.cos(math.radians(55)); SY = 111195.0802
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
    return [[round(x, 5), round(y, 5)] for x, y in result]

def metadata(name, tolerance):
    return dict(source='Natural Earth 1:10m ' + name, edition=REVISION,
                sourceUrl=f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{REVISION}/geojson/{name}.geojson',
                sourceSha256=SOURCES[name], productUrl='https://www.naturalearthdata.com/',
                attribution='Natural Earth · public domain', sourceCrs='EPSG:4326', outputCrs='EPSG:4326',
                simplificationToleranceMetres=tolerance, preparation='pfad-uk-geography/1')

country = next(f for f in read('ne_10m_admin_0_countries') if f['properties']['ADMIN'] == 'United Kingdom')
land = polygons(country['geometry'])
border = dict(metadata=metadata('ne_10m_admin_0_countries', 300), rings=[ring(p[0], 300) for p in land])
lakes = []
for feature in read('ne_10m_lakes') + read('ne_10m_lakes_europe'):
    shapes = polygons(feature['geometry'])
    points = [p for shape in shapes for p in shape[0]]
    if not any(-9 < x < 2 and 49 < y < 62 for x, y in points): continue
    if not any(any(inside(point, p[0]) and not any(inside(point, hole) for hole in p[1:]) for p in land) for point in points): continue
    properties = feature['properties']
    area = sum(abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(s[0],s[0][1:]))) * SX * SY / 2e6 for s in shapes)
    lakes.append(dict(id=str(properties['ne_id']), name=properties['name'], areaSquareKilometres=round(area, 2),
                      polygons=[[ring(r, 60) for r in shape] for shape in shapes]))
water = dict(metadata=metadata('ne_10m_lakes', 60), lakes=lakes)
water['metadata']['additionalSource'] = metadata('ne_10m_lakes_europe', 60)
for name, data in [('uk-border', border), ('uk-lakes', water)]:
    path = Path(f'src/map/data/{name}.json')
    raw = (json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n').encode()
    path.write_bytes(raw)
    print(path, len(raw), hashlib.sha256(raw).hexdigest())
print('Border rings:', len(border['rings']), 'Lakes:', [lake['name'] for lake in lakes])
