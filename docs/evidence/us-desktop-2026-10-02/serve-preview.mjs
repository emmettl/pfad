import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { dirname, resolve, basename } from 'node:path'
const manifestPath=await readFile('../manifest-path.txt','utf8'), directory=dirname(manifestPath), manifest=JSON.parse(await readFile(manifestPath,'utf8'))
const country=JSON.parse(await readFile('../us-country-entry.json','utf8'))
const allowed=new Set(['manifest.json',...manifest.chunks.map(chunk=>chunk.path)])
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:4216,strictPort:true,fs:{allow:[resolve('.'),resolve('../../../node_modules/@motionstudies/web/fonts')]}},plugins:[{name:'us-local-data',enforce:'pre',transform(code,id){if(!id.endsWith('/src/countries.ts'))return;const position=code.lastIndexOf('\n]');if(position<0)throw Error('Missing country array');return {code:code.slice(0,position)+'\n  '+JSON.stringify(country)+','+code.slice(position),map:null}},configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(!req.url?.startsWith('/experimental-us/'))return next()
 const name=req.url.slice('/experimental-us/'.length)
 if(basename(name)!==name||!allowed.has(name)){res.statusCode=404;return res.end()}
 try{res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'application/octet-stream');res.end(await readFile(resolve(directory,name)))}catch(error){res.statusCode=500;res.end(String(error))}
})}}]})
await server.listen();console.log('Local US experiment: http://127.0.0.1:4216/?country=us&from=san-francisco&to=new-york&algorithm=bidirectional&duration=15')
