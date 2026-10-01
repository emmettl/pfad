"""Reproduce an explicitly pinned regional union in ignored .cache/.

Requires osmium-tool 1.19.1. Inputs must already be acquired from their exact
snapshot URLs; this command never follows latest or changes a selected release.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('country', help='Configuration ID under data/countries')
parser.add_argument('--osmium', default='osmium')
args = parser.parse_args()
config = root / 'data/countries' / (args.country + '.json')
assert config.parent == root / 'data/countries', 'Invalid country ID'
source = json.loads(config.read_text())['source']
composition = source['composition']
version = subprocess.check_output([args.osmium, '--version'], text=True)
assert 'osmium version 1.19.1\n' in version and 'libosmium version 2.23.1\n' in version, 'Use pinned merge tooling'
paths = []
for item in source['inputs']:
    path = root / '.cache/osm' / item['url'].rsplit('/', 1)[-1]
    assert item['dataTimestamp'] == source['dataTimestamp'], 'Inputs must share a snapshot timestamp'
    assert path.stat().st_size == item['bytes'], 'Input byte length mismatch'
    with path.open('rb') as handle:
        assert hashlib.file_digest(handle, 'sha256').hexdigest() == item['sha256'], 'Input checksum mismatch'
    paths.append(path)
target = root / '.cache/osm' / source['filename']
assert target.parent == root / '.cache/osm', 'Invalid output filename'
if not target.exists():
    with tempfile.TemporaryDirectory(prefix='pfad-union-', dir=target.parent) as temporary:
        merged = Path(temporary) / 'union.osm.pbf'
        output = Path(temporary) / 'selected.osm.pbf'
        options = ['--generator', composition['generator'], '--output-header', 'osmosis_replication_timestamp=' + source['dataTimestamp'], '--no-progress']
        result = subprocess.run([args.osmium, 'merge', *map(str, paths), *options, '-o', str(merged)], capture_output=True, text=True, check=True)
        assert not result.stderr.strip(), 'Merge reported inconsistent object versions: ' + result.stderr
        subprocess.run([args.osmium, 'extract', str(merged), '--bbox=' + ','.join(map(str, composition['bounds'])), '--strategy=complete_ways', *options, '-o', str(output)], check=True)
        subprocess.run([args.osmium, 'check-refs', str(output)], check=True)
        with output.open('rb') as handle:
            assert hashlib.file_digest(handle, 'sha256').hexdigest() == source['sha256'], 'Reproduced source differs from pinned release'
        assert output.stat().st_size == source['bytes']
        output.replace(target)
with target.open('rb') as handle:
    assert hashlib.file_digest(handle, 'sha256').hexdigest() == source['sha256'], 'Composite checksum mismatch'
assert target.stat().st_size == source['bytes']
print('Verified composite:', target.name)
