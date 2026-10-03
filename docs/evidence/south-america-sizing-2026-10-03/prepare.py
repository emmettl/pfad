import hashlib, json, pathlib, subprocess
base = pathlib.Path('.cache/south-america-eleven')
inputs=[]
for f in sorted(base.glob('*-261002.osm.pbf')):
    if f.name.startswith('south-america-eleven'):continue
    with f.open('rb') as h: md5=hashlib.file_digest(h,'md5').hexdigest()
    assert md5==pathlib.Path(str(f)+'.md5').read_text().split()[0]
    info=json.loads(subprocess.check_output(['osmium','fileinfo','-j',str(f)]))
    with f.open('rb') as h: sha=hashlib.file_digest(h,'sha256').hexdigest()
    inputs.append(dict(country=f.name.split('-261002')[0],url='https://download.geofabrik.de/south-america/'+f.name,bytes=f.stat().st_size,sha256=sha,md5=md5,dataTimestamp=info['header']['option']['osmosis_replication_timestamp']))
assert len(inputs)==11 and len(set(x['dataTimestamp'] for x in inputs))==1
(base/'inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
timestamp = inputs[0]['dataTimestamp']
target = base/'south-america-eleven-261002.osm.pbf'
if not target.exists():
    subprocess.run(['osmium','merge',*[str(base/x['url'].rsplit('/',1)[-1]) for x in inputs],'--generator=pfad-south-america-eleven-feasibility/1','--output-header=osmosis_replication_timestamp='+timestamp,'--no-progress','-o',str(target)],check=True)
subprocess.run(['osmium','check-refs',str(target)],check=True)
with target.open('rb') as f: sha = hashlib.file_digest(f,'sha256').hexdigest()
source = {'provider':'OpenStreetMap via Geofabrik','dataTimestamp':timestamp,'data_timestamp':timestamp,'url':'https://download.geofabrik.de/south-america.html','filename':target.name,'bytes':target.stat().st_size,'sha256':sha,'inputs':inputs,'attribution':'© OpenStreetMap contributors','licence':'ODbL-1.0','licenceUrl':'https://www.openstreetmap.org/copyright','composition':{'version':'pfad-south-america-eleven-feasibility/1','tool':'osmium-tool/1.19.1','libosmium':'2.23.1','operation':'merge-same-snapshot','deduplication':'OSM object type, ID and version','clipping':False}}
(base/'source.json').write_text(json.dumps(source,indent=2)+'\n')
config = {'id':'south-america-eleven','name':'South America eleven','datasetPrefix':'south-america-eleven-20261002','source':source,'projection':{'centre':[-60,-20],'referenceLatitude':-20,'scaleMetres':6000000,'quantisationMetres':1.111950802,'drawingPrecision':'float32-normalised/1'},'coverage':'Eleven complete country extracts: Argentina, Bolivia, Chile, Colombia, Ecuador, Guyana, Paraguay, Peru, Suriname, Uruguay and Venezuela; Brazil excluded. No clipping, tracks or ferry edges.'}
(base/'country.json').write_text(json.dumps(config,indent=2)+'\n')
