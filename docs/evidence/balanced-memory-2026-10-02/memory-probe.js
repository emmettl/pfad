globalThis.__pfadScratch={loadBytes:0,searchBytes:0,calls:0,searching:false};
const __pfadTransfer=ArrayBuffer.prototype.transfer;
if(__pfadTransfer)ArrayBuffer.prototype.transfer=function(length){if(length===0){const s=globalThis.__pfadScratch;s[s.searching?'searchBytes':'loadBytes']+=this.byteLength;s.calls++}return __pfadTransfer.call(this,length)};
self.addEventListener('message',({data})=>{if(data.type==='search'){globalThis.__pfadScratch.searching=true;globalThis.__pfadScratch.searchBytes=0}});
const __pfadSend=self.postMessage.bind(self);self.postMessage=(message,options)=>{if(message.type==='result')message.result.memoryProof={...globalThis.__pfadScratch};return __pfadSend(message,options)};
