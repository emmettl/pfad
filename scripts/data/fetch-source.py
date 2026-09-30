"""Acquire and verify the pinned sizing source; never called by build or CI."""
import hashlib
import json
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parents[2]
source = json.loads((root / 'public/data/pfad-manifest.json').read_text())['source']
target = root / '.cache/osm' / source['url'].rsplit('/', 1)[-1]
target.parent.mkdir(parents=True, exist_ok=True)
if not target.exists():
    temporary = target.with_suffix('.partial')
    with urllib.request.urlopen(source['url'], timeout=180) as response, temporary.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    with temporary.open('rb') as handle:
        digest = hashlib.file_digest(handle, 'sha256').hexdigest()
    if digest != source['sha256']:
        temporary.unlink()
        raise SystemExit('Source checksum mismatch; refusing to accept the snapshot')
    temporary.replace(target)
with target.open('rb') as handle:
    digest = hashlib.file_digest(handle, 'sha256').hexdigest()
if digest != source['sha256']:
    raise SystemExit('Cached source checksum mismatch')
print('Verified source:', target.name)
