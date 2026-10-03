import concurrent.futures, hashlib, json, pathlib, subprocess
base = pathlib.Path('.cache/southern-africa')
names = 'south-africa namibia botswana lesotho swaziland zimbabwe zambia mozambique malawi angola'.split()
def acquire(name):
    url = f'https://download.geofabrik.de/africa/{name}-261002.osm.pbf'
    path = base / url.rsplit('/',1)[-1]
    subprocess.run(['curl','--fail','--location','--retry','3','--continue-at','-','--silent','--show-error',url,'-o',str(path)],check=True)
    md5 = subprocess.check_output(['curl','--fail','--silent','--show-error',url+'.md5'],text=True).split()[0]
    with path.open('rb') as f: actual = hashlib.file_digest(f,'md5').hexdigest()
    assert actual == md5, name
    header = json.loads(subprocess.check_output(['osmium','fileinfo','-j',str(path)],text=True))
    timestamp = header['header']['option']['osmosis_replication_timestamp']
    with path.open('rb') as f: sha = hashlib.file_digest(f,'sha256').hexdigest()
    record = {'country':name,'url':url,'bytes':path.stat().st_size,'sha256':sha,'md5':md5,'dataTimestamp':timestamp}
    (base/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n')
    print(name, record['bytes'], timestamp,flush=True)
    return record
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: records = list(pool.map(acquire,names))
assert len({x['dataTimestamp'] for x in records}) == 1
(base/'inputs.json').write_text(json.dumps(records,indent=2)+'\n')
print('All ten sources verified',flush=True)
