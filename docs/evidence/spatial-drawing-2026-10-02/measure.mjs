import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const paths = ['.cache/countries/de-20260929-083582060611/manifest.json', (await readFile('.cache/replay-optimization/manifest-path.txt','utf8')).trim()]
const results=[]
for(const path of paths){
 const m=JSON.parse(await readFile(path,'utf8')),base=dirname(path)
 const decode=async c=>{const b=await readFile(join(base,c.path));if(createHash('sha256').update(b).digest('hex')!==c.sha256)throw Error('Checksum');const d=gunzipSync(b);if(d.length!==c.decodedBytes)throw Error('Size');return d}
 const geometry=m.chunks.filter(c=>c.kind==='geometry'), edges=m.chunks.filter(c=>c.kind==='edges'),nodes=m.chunks.filter(c=>c.kind==='nodes')
 const selected=Array.from({length:8},(_,i)=>geometry[Math.floor((i+.5)*geometry.length/8)])
 const samples=[]
 for(const g of selected){
  const endpoints=new Map(),needed=new Set()
  for(const e of edges.filter(e=>e.start<g.start+g.count&&e.start+e.count>g.start)){
   const b=await decode(e);let u=0
   for(let i=0;i<e.count;i++){u+=b.readInt32LE(i*4);if(e.start+i<g.start||e.start+i>=g.start+g.count)continue;const v=u+b.readInt32LE(e.count*4+i*4);endpoints.set(e.start+i,[u,v]);needed.add(u);needed.add(v)}
  }
  const coordinates=new Map()
  for(const n of nodes.filter(n=>Array.from(needed).some(id=>id>=n.start&&id<n.start+n.count))){
   const b=await decode(n);let x=0,y=0
   for(let i=0;i<n.count;i++){x+=b.readInt32LE(i*8);y+=b.readInt32LE(i*8+4);if(needed.has(n.start+i))coordinates.set(n.start+i,[x,y])}
  }
  const b=await decode(g),segments=[];let cursor=g.count*2
  for(let i=0;i<g.count;i++){
   const [u,v]=endpoints.get(g.start+i);let [x,y]=coordinates.get(u);const count=b.readUInt16LE(i*2)
   for(let j=0;j<count;j++){const nx=x+b.readInt32LE(cursor),ny=y+b.readInt32LE(cursor+4);cursor+=8;segments.push([x,y,nx,ny]);x=nx;y=ny}
   const [nx,ny]=coordinates.get(v);segments.push([x,y,nx,ny])
  }
  if(cursor!==b.length)throw Error('Geometry layout')
  const bounds=s=>{let l=Infinity,r=-Infinity,d=Infinity,t=-Infinity;for(const a of s){l=Math.min(l,a[0],a[2]);r=Math.max(r,a[0],a[2]);d=Math.min(d,a[1],a[3]);t=Math.max(t,a[1],a[3])}return [l,d,r,t]}
  const original=bounds(segments)
  const split=(s,limit)=>{const b=bounds(s);if(s.length<=limit)return [{b,count:s.length}];const axis=b[2]-b[0]>=b[3]-b[1]?0:1;s.sort((a,c)=>(a[axis]+a[axis+2])-(c[axis]+c[axis+2]));const mid=s.length>>1;return [...split(s.slice(0,mid),limit),...split(s.slice(mid),limit)]}
  const batches={};for(const limit of [4096,16384,65536])batches[limit]=split(segments.slice(),limit)
  const views=[]
  for(const fraction of [.25,.0625])for(const fx of [.25,.5,.75])for(const fy of [.25,.5,.75]){
   const w=(original[2]-original[0])*fraction,h=(original[3]-original[1])*fraction,cx=original[0]+fx*(original[2]-original[0]),cy=original[1]+fy*(original[3]-original[1]);const v=[cx-w/2,cy-h/2,cx+w/2,cy+h/2]
   const intersects=a=>a[0]<=v[2]&&a[2]>=v[0]&&a[1]<=v[3]&&a[3]>=v[1]
   const sphere=a=>{const x=(a[0]+a[2])/2,y=(a[1]+a[3])/2,r=Math.hypot(a[2]-a[0],a[3]-a[1])/2;return intersects([x-r,y-r,x+r,y+r])}
   const exact=segments.filter(s=>intersects([Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])])).length
   views.push({fraction,exact,baseline:segments.length,spatial:Object.fromEntries(Object.entries(batches).map(([k,a])=>[k,{aabb:a.filter(c=>intersects(c.b)).reduce((n,c)=>n+c.count,0),sphere:a.filter(c=>sphere(c.b)).reduce((n,c)=>n+c.count,0)}]))})
  }
  samples.push({start:g.start,segments:segments.length,bounds:original,batches:Object.fromEntries(Object.entries(batches).map(([k,a])=>[k,a.length])),views});console.log(path,g.start,segments.length)
 }
 results.push({path,identity:m.identity,samples})
 await writeFile('.cache/spatial-drawing/results.json',JSON.stringify(results,null,2))
}
