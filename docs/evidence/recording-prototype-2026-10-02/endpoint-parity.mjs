import assert from 'node:assert/strict';import {compileGraph} from './snapshot/src/search/engine.ts';import {endpointIndexAudit} from './snapshot/src/search/endpoints.ts';
let seed=12345;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};let checked=0;
for(const lat of [-89.99,-70,-.02,0,.02,48,89.99]){
 const n=4000,e=3996,xy=new Int32Array(n*2),from=new Uint32Array(e),to=new Uint32Array(e),length=new Uint32Array(e).fill(100),direction=new Uint8Array(e).fill(3),category=new Uint8Array(e).fill(5);
 for(let i=0;i<n;i++){xy[i*2]=Math.round((10+(i%1000%25)*.001)*100000);xy[i*2+1]=Math.round(Math.max(-90,Math.min(90,lat+Math.floor((i%1000)/25)*.001-.02))*100000);}
 // Duplicated coordinates across disconnected components exercise deterministic ties.
 let edge=0;for(let group=0;group<4;group++)for(let i=1;i<1000;i++){from[edge]=group*1000+i-1;to[edge++]=group*1000+i;}
 const graph=compileGraph({xy,from,to,length,direction,category});
 for(let k=0;k<100;k++){const i=Math.floor(random()*n),j=Math.floor(random()*n),point=(id,name)=>({name,lon:xy[id*2]/100000+(random()-.5)*.005,lat:Math.max(-90,Math.min(90,xy[id*2+1]/100000+(random()-.5)*.005))});const audit=endpointIndexAudit(graph,point(i,'start'),point(j,'goal'));assert.equal(audit.exact,true);checked++;}
}
console.log(JSON.stringify({checked,exact:true,seed:12345,cases:'disconnected duplicated coordinates, latitude bucket boundaries, equator and poles'}));
