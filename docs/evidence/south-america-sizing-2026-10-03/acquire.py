import concurrent.futures,urllib.request,pathlib
base=pathlib.Path('.cache/south-america-eleven')
names='argentina bolivia chile colombia ecuador guyana paraguay peru suriname uruguay venezuela'.split()
def get(name):
 for ext in ['osm.pbf','osm.pbf.md5']:
  filename=f'{name}-261002.{ext}'
  urllib.request.urlretrieve('https://download.geofabrik.de/south-america/'+filename,base/filename)
 print(name,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(get,names))
