"""Verify and publish one immutable country release to R2, manifest last.

Requires Python >=3.11. No source acquisition, mutable aliases, or app deployment.
Use --dry-run first. Credentials come from CLOUDFLARE_API_TOKEN, or explicitly
select --wrangler-auth to reuse this host's Wrangler OAuth login.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ACCOUNT = '8cac82a07417990e553f88793670f361'

def verify(directory):
    raw = (directory / 'manifest.json').read_bytes()
    m = json.loads(raw)
    assert re.fullmatch(r'[a-z]{2,8}-\d{8}-[a-f0-9]{12}', m['id']) and directory.name == m['id'], 'Invalid release directory'
    identity = hashlib.sha256(json.dumps({'chunks': m['chunks'], 'projection': m['projection'], 'profile': m['profile']}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert identity == m['identity'] and m['id'].endswith(identity[:12]), 'Release identity mismatch'
    assert m['schema'] == 'pfad-road-study/1' and m['encoding'] == 'le-columnar-deltas/1'
    assert re.fullmatch(r'[a-f0-9]{64}', m['source']['sha256']) and m['source']['licence'] == 'ODbL-1.0'
    files = []
    covered = dict(nodes=0, edges=0, geometry=0)
    phase = 0
    for entry in m['chunks'] + [m['evidence']]:
        name = entry['path']
        assert re.fullmatch(r'(?:nodes|edges|geometry)-\d{3}-[a-f0-9]{12}\.bin\.gz\.bin|evidence-[a-f0-9]{12}\.json\.gz\.bin', name), 'Unsafe object path'
        assert name not in [p.name for p in files], 'Duplicate object'
        path = directory / name
        assert not path.is_symlink(), 'Symlinks are not release objects'
        data = path.read_bytes()
        assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], f'Checksum mismatch: {name}'
        if 'kind' in entry:
            kind = entry['kind']; next_phase = ['nodes', 'edges', 'geometry'].index(kind)
            assert next_phase >= phase and entry['start'] == covered[kind] and entry['count'] > 0, 'Incomplete chunk coverage'
            phase = next_phase; covered[kind] += entry['count']
            assert len(gzip.decompress(data)) == entry['decodedBytes'], 'Decoded layout mismatch'
        files.append(path)
    assert covered == dict(nodes=m['counts']['nodes'], edges=m['counts']['edges'], geometry=m['counts']['edges']), 'Incomplete release'
    assert sum(c['bytes'] for c in m['chunks']) == m['downloadBytes']
    assert set(p.name for p in directory.iterdir()) == set(p.name for p in files) | {'manifest.json'}, 'Unexpected release files'
    assert not (directory / 'manifest.json').is_symlink()
    return m, files

def publish(directory, bucket, account, token):
    m, files = verify(directory)
    base = f'https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{bucket}/objects/'
    def transfer(path):
        data = path.read_bytes()
        url = base + urllib.parse.quote(m['id'] + '/' + path.name, safe='/')
        h = {'Authorization': 'Bearer ' + token}
        # Existing immutable keys are checked byte-for-byte, never overwritten.
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=90) as r:
                existing = r.read()
            if existing != data: raise RuntimeError('Refusing to overwrite immutable object: ' + path.name)
            return
        except urllib.error.HTTPError as e:
            if e.code != 404: raise RuntimeError(f'R2 read failed ({e.code}); no object changed') from None
        h.update({'Content-Type': 'application/json' if path.name == 'manifest.json' else 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method='PUT'), timeout=180) as r:
                    result = json.load(r)
                if result.get('success') is not True: raise RuntimeError('R2 did not confirm upload')
                return
            except (urllib.error.URLError, TimeoutError):
                if attempt == 3: raise RuntimeError('R2 upload failed: ' + path.name) from None
                time.sleep(2 ** attempt)
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(transfer, files))
    # A failed transfer leaves no discoverable manifest for a partial release.
    transfer(directory / 'manifest.json')
    return {'dataset': m['id'], 'identity': m['identity'], 'objects': len(files) + 1, 'downloadBytes': m['downloadBytes'], 'manifestSha256': hashlib.sha256((directory / 'manifest.json').read_bytes()).hexdigest()}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--bucket', default='pfad-data')
    parser.add_argument('--account', default=ACCOUNT)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--verify-url', help='Check every published object against this local verified release')
    parser.add_argument('--wrangler-auth', action='store_true')
    args = parser.parse_args()
    m, files = verify(args.directory)
    if args.verify_url:
        base = args.verify_url.rstrip('/') + '/' + m['id'] + '/'
        def check_remote(path):
            with urllib.request.urlopen(urllib.request.Request(base + path.name, headers={'User-Agent': 'PFAD-release-verifier/1'}), timeout=180) as r:
                assert r.status == 200 and r.headers.get('Access-Control-Allow-Origin') == '*', 'Invalid delivery headers'
                assert not r.headers.get('Content-Encoding') and 'immutable' in r.headers.get('Cache-Control', ''), 'Container or caching changed'
                digest = hashlib.sha256(); size = 0
                while chunk := r.read(1024 * 1024): digest.update(chunk); size += len(chunk)
            expected = path.read_bytes()
            assert size == len(expected) and digest.hexdigest() == hashlib.sha256(expected).hexdigest(), 'Published checksum mismatch: ' + path.name
        with ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(check_remote, files + [args.directory / 'manifest.json']))
        print(json.dumps({'verifiedUrl': base, 'objects': len(files) + 1, 'identity': m['identity']}, indent=2))
    elif args.dry_run:
        print(json.dumps({'verified': m['id'], 'objects': len(files) + 1, 'downloadBytes': m['downloadBytes']}, indent=2))
    else:
        token = os.environ.get('CLOUDFLARE_API_TOKEN')
        if args.wrangler_auth:
            import tomllib
            config = Path.home() / 'Library/Preferences/.wrangler/config/default.toml'
            if not config.exists(): config = Path.home() / '.config/.wrangler/config/default.toml'
            token = tomllib.loads(config.read_text())['oauth_token']
        if not token: raise SystemExit('Provide CLOUDFLARE_API_TOKEN or explicitly use --wrangler-auth')
        print(json.dumps(publish(args.directory, args.bucket, args.account, token), indent=2))
