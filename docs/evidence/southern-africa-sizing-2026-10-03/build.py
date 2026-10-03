import hashlib, json, pathlib, subprocess
base = pathlib.Path('.cache/southern-africa')
inputs = json.loads((base/'inputs.json').read_text())
timestamp = inputs[0]['dataTimestamp']
target = base/'southern-africa-261002.osm.pbf'
if not target.exists():
    subprocess.run(['osmium','merge',*[str(base/x['url'].rsplit('/',1)[-1]) for x in inputs],'--generator=pfad-southern-africa-feasibility/1','--output-header=osmosis_replication_timestamp='+timestamp,'--no-progress','-o',str(target)],check=True)
subprocess.run(['osmium','check-refs',str(target)],check=True)
with target.open('rb') as f: sha = hashlib.file_digest(f,'sha256').hexdigest()
source = {'provider':'OpenStreetMap via Geofabrik','dataTimestamp':timestamp,'data_timestamp':timestamp,'url':'https://download.geofabrik.de/africa.html','filename':target.name,'bytes':target.stat().st_size,'sha256':sha,'inputs':inputs,'attribution':'© OpenStreetMap contributors','licence':'ODbL-1.0','licenceUrl':'https://www.openstreetmap.org/copyright','composition':{'version':'pfad-southern-africa-feasibility/1','tool':'osmium-tool/1.19.1','libosmium':'2.23.1','operation':'merge-same-snapshot','deduplication':'OSM object type, ID and version','clipping':False}}
(base/'source.json').write_text(json.dumps(source,indent=2)+'\n')
config = {'id':'southern-africa','name':'Southern Africa','datasetPrefix':'southern-africa-20261002','source':source,'projection':{'centre':[25,-22],'referenceLatitude':-22,'scaleMetres':3000000,'quantisationMetres':1.111950802,'drawingPrecision':'float32-normalised/1'},'coverage':'Ten complete country extracts: South Africa, Namibia, Botswana, Lesotho, Eswatini, Zimbabwe, Zambia, Mozambique, Malawi and Angola. No clipping, tracks or ferry edges.'}
(base/'country.json').write_text(json.dumps(config,indent=2)+'\n')
subprocess.run(['.cache/uk-python/bin/python','scripts/data/build-streamed-study.py','--source',str(target),'--country',str(base/'country.json'),'--output',str(base/'packaged')],check=True)
