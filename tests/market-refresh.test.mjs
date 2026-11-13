import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../pricing-core.js';
const core=globalThis.BovedaPricingCore;
const stamp=new Date().toISOString(),day=core.bogotaDay();
const card={id:100,name:'Gengar ex',number:'090/128',set:'30th Celebration',language:'Inglés'};
const fx={cop:3301.91,source:'TRM',updatedAt:stamp,validFrom:day,validTo:day};
const data={schemaVersion:1,generatedAt:stamp,groups:{'3-24722':{updatedAt:stamp,products:[{id:716485,name:'Gengar ex',number:'090/128',prices:[{usd:1.08,finish:'Holofoil'}]}]}},fx,collectr:{cards:{}}};
const source=await readFile(new URL('../market-prices.js',import.meta.url),'utf8');
function app(fetcher,saved=null) {
 const calls=[],values=new Map(saved?[['boveda-market-v7',JSON.stringify({snapshot:saved,fx:saved.fx})]]:[]),events=new Map();
 const context={BovedaPricingCore:core,Intl,URLSearchParams,AbortSignal,console,Date,
  document:{visibilityState:'visible',addEventListener(name,fn){events.set(name,fn);}},
  localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},
  setInterval(){return 0;},addEventListener(name,fn){events.set(name,fn);},
  fetch:async(url,options)=>{calls.push({url,options});return fetcher(url,options);}};
 context.window=context;vm.runInNewContext(source,context,{timeout:2000});
 return{prices:context.CardPrices,calls,values,events};
}
function response(body){return{ok:true,status:200,json:async()=>structuredClone(body)};}
const trm=[{valor:'3301.91',unidad:'COP',vigenciadesde:day+'T00:00:00.000',vigenciahasta:day+'T00:00:00.000'}];
test('every new visit revalidates even a current saved snapshot; in-flight calls are shared',async()=>{
 const instance=app(url=>response(url.includes('datos.gov.co')?trm:data),data);
 const first=instance.prices.init(),second=instance.prices.init();assert.equal(first,second);await first;
 assert.equal(instance.calls.length,2);assert.equal(instance.prices.quote(card).copMin,3566);
 assert.equal(instance.calls[0].options.cache,'no-store');assert.equal(instance.calls[1].options.cache,'no-store');
 assert.match(instance.prices.rateText(),/3\.301,91/);assert.doesNotMatch(instance.prices.statusText(),/Actualizando/);
});
test('a broken remote snapshot falls back to the local copy, keeping original market timestamps',async()=>{
 const instance=app(url=>{if(url.includes('raw.githubusercontent'))throw Error('offline');return response(url.includes('datos.gov.co')?trm:data);});
 await instance.prices.init();assert.equal(instance.calls.length,3);
 assert.equal(instance.prices.quote(card).updatedAt,stamp);assert.equal(instance.prices.quote(card).source,'tcgplayer');
});
test('malformed remote data is rejected before it can break the gallery',async()=>{
 const invalid=structuredClone(data);invalid.groups['3-24722'].products=[null];
 const instance=app(url=>response(url.includes('datos.gov.co')?trm:url.includes('raw.githubusercontent')?invalid:data));
 await instance.prices.init();assert.equal(instance.prices.quote(card).copMin,3566);assert.equal(instance.calls.length,3);
});
test('total network failure keeps dates and excludes expired saved prices',async()=>{
 const expired=structuredClone(data);expired.groups['3-24722'].updatedAt='2020-01-01T00:00:00Z';expired.fx.validTo='2020-01-01';
 const instance=app(()=>{throw Error('offline');},expired);await instance.prices.init();
 const q=instance.prices.quote(card);assert.equal(q.status,'stale');assert.equal(q.usable,false);assert.equal(q.copMin,null);
 assert.match(instance.prices.statusText(),/No se pudo/);
});
test('TRM outage uses an explicitly labeled dated market exchange rate',async()=>{
 const instance=app(url=>{
  if(url.includes('datos.gov.co'))throw Error('TRM offline');
  if(url.includes('open.er-api.com'))return response({result:'success',base_code:'USD',rates:{COP:3300.75},time_last_update_unix:Math.floor(Date.now()/1000)});
  return response({...data,fx:null});
 });
 await instance.prices.init();assert.match(instance.prices.rateText(),/Cambio de mercado/);
 assert.doesNotMatch(instance.prices.rateText(),/TRM vigente/);assert.equal(instance.prices.quote(card).copMin,3565);
});
