"""Manually build a country from its pinned config into ignored .cache/.

Install scripts/data/requirements.txt in Python >=3.11. Existing sizing proofs
may be reused with --reuse-sizing; the packager still checks all hashes.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('country', help='Configuration ID under data/countries')
parser.add_argument('--reuse-sizing', type=Path)
args = parser.parse_args()
config = root / 'data/countries' / (args.country + '.json')
assert config.parent == root / 'data/countries' and config.exists(), 'Unknown country'
country = json.loads(config.read_text())
source = root / '.cache/osm' / country['source'].get('filename', country['source']['url'].rsplit('/', 1)[-1])
sizing = args.reuse_sizing or root / '.cache/countries-sizing' / country['datasetPrefix']
def run(script, *arguments):
    subprocess.run([sys.executable, str(root / 'scripts/data' / script), *map(str, arguments)], check=True, cwd=root)
run('fetch-source.py', '--country', config)
if not args.reuse_sizing:
    sizing.mkdir(parents=True, exist_ok=True)
    provenance = sizing / 'source.json'
    provenance.write_text(json.dumps(country['source']))
    run('size-proof.py', '--source', source, '--output', sizing, '--provenance', provenance)
run('build-study.py', '--country', config, '--source', source, '--sizing', sizing, '--output', root / '.cache/countries')
