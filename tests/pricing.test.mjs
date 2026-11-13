import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../pricing-core.js';
const core=globalThis.BovedaPricingCore;
const now=Date.parse('2026-11-13T16:00:00Z');
const fx={cop:3301.91,source:'TRM',updatedAt:'2026-11-13T00:00:00-05:00',validFrom:'2026-11-13',validTo:'2026-11-13'};
const card={id:100,name:'Gengar ex',number:'090/128',set:'30th Celebration',language:'Inglés'};
const product={id:696677,name:'Gengar ex',number:'090/128',prices:[{usd:0.7,finish:'Holofoil'}]};
const snapshot=(products=[product])=>({groups:{'3-24722':{updatedAt:'2026-11-12T20:03:11Z',products}},fx,collectr:{cards:{}}});
test('Market Price uses the matching product, whole-peso conversion and source timestamp',()=>{
 const q=core.quote(card,snapshot(),fx,now);
 assert.equal(q.status,'ready');assert.equal(q.min,0.7);assert.equal(q.copMin,2311);
 assert.equal(q.url,'https://www.tcgplayer.com/product/696677');assert.equal(q.updatedAt,'2026-11-12T20:03:11Z');assert.equal(q.usable,true);
});
test('missing products never receive an invented estimate or a free price',()=>{
 const q=core.quote({...card,number:'999/128'},snapshot(),fx,now);
 assert.equal(q.status,'unavailable');assert.equal(q.min,null);assert.equal(q.copMin,null);assert.equal(q.usable,false);
});
test('name and full collection number both have to match',()=>{
 assert.equal(core.quote({...card,name:'Umbreon ex'},snapshot(),fx,now).status,'unavailable');
 assert.equal(core.quote({...card,number:'090/131'},snapshot(),fx,now).status,'unavailable');
 assert.equal(core.quote({...card,number:'90/128'},snapshot(),fx,now).min,0.7);
});
test('Japanese and unknown languages never inherit an English price',()=>{
 for(const language of ['Japonés','JP','Português',''])assert.equal(core.quote({...card,language},snapshot(),fx,now).status,'unavailable');
 const q=core.quote({...card,language:'Español'},snapshot(),fx,now);assert.equal(q.reference,true);
});
test('ambiguous products, stamped editions and invalid prices are rejected',()=>{
 assert.equal(core.quote(card,snapshot([product,{...product,id:2}]),fx,now).status,'unavailable');
 assert.equal(core.quote(card,snapshot([{...product,name:'Gengar ex (Stamped)'}]),fx,now).status,'unavailable');
 for(const usd of [null,0,-1,NaN,Infinity,'5',true])assert.equal(core.quote(card,snapshot([{...product,prices:[{usd,finish:'Normal'}]}]),fx,now).status,'unavailable');
});
test('one unit price uses the standard finish, with exact explicit finish selection',()=>{
 const data=snapshot([{...product,prices:[{usd:1.25,finish:'Normal'},{usd:2.55,finish:'Reverse Holofoil'}]}]);
 const q=core.quote(card,data,fx,now);assert.equal(q.min,1.25);assert.equal(q.max,1.25);assert.equal(q.copMin,4127);assert.equal(q.copMax,4127);assert.equal(q.variants.length,1);
 assert.equal(core.quote({...card,finish:'Reverse Holofoil'},data,fx,now).min,2.55);
 assert.equal(core.quote({...card,finish:'Master Ball'},data,fx,now).status,'unavailable');
});
test('expired and future prices cannot enter financial totals',()=>{
 for(const updatedAt of ['2026-11-01T20:00:00Z','2030-01-01T00:00:00Z','invalid']){
  const data=snapshot();data.groups['3-24722'].updatedAt=updatedAt;
  const q=core.quote(card,data,fx,now);assert.equal(q.status,'stale');assert.equal(q.usable,false);
 }
});
test('TRM validity uses Bogota dates and includes weekends and holidays',()=>{
 const weekend={...fx,validFrom:'2026-11-13',validTo:'2026-11-16'};
 assert.equal(core.validFX(weekend,Date.parse('2026-11-17T04:59:59Z')),true);
 assert.equal(core.validFX(weekend,Date.parse('2026-11-17T05:00:00Z')),false);
 assert.equal(core.validFX(fx,Date.parse('2026-11-14T04:59:59Z')),true);
 assert.equal(core.validFX(fx,Date.parse('2026-11-14T05:00:00Z')),false);
 const q=core.quote(card,snapshot(),{...fx,validTo:'2026-11-12'},now);
 assert.equal(q.copMin,null);assert.equal(q.usable,false);
});
test('Collectr is second choice only for a verified identity, currency, condition and fresh date',()=>{
 const row={...card,usd:1.37,currency:'USD',condition:'ungraded',updatedAt:'2026-11-13T10:00:00Z',url:'https://app.getcollectr.com/explore/product/716485'};
 const data=snapshot([]);data.collectr.cards[card.id]=row;
 assert.equal(core.quote(card,data,fx,now).source,'collectr');
 assert.equal(core.quote(card,{...data,groups:snapshot().groups},fx,now).source,'tcgplayer');
 for(const patch of [{language:'Japonés'},{number:'090/131'},{set:'151'},{currency:'COP'},{condition:'PSA 10'},{updatedAt:'2020-01-01'},{url:'https://example.com'},{usd:'5'}]){
  data.collectr.cards[card.id]={...row,...patch};assert.equal(core.quote(card,data,fx,now).status,'unavailable');
 }
});
test('fresh Collectr replaces an expired TCGplayer reference',()=>{
 const data=snapshot();data.groups['3-24722'].updatedAt='2020-01-01T00:00:00Z';
 data.collectr.cards[card.id]={...card,usd:1.5,currency:'USD',condition:'ungraded',updatedAt:'2026-11-13T10:00:00Z',url:'https://app.getcollectr.com/explore/product/716485'};
 assert.equal(core.quote(card,data,fx,now).source,'collectr');
});
test('owner prices remain explicit and cannot migrate to a different card',()=>{
 const owner={id:55,name:'Estudiante de Paldea',number:'065/165',set:'Paldean Fates',language:'Español'};
 const q=core.quote(owner,{groups:{}},fx,now);assert.equal(q.manual,true);assert.equal(q.min,4);
 assert.equal(core.quote({...owner,set:'151'},{groups:{}},fx,now).status,'unavailable');
});
test('loading and pricing never modify published identities or sequence',async()=>{
 const context={window:{}};vm.runInNewContext(await readFile(new URL('../cards.js',import.meta.url),'utf8'),context);
 const cards=context.window.CARDS,before=JSON.stringify(cards);
 const data=JSON.parse(await readFile(new URL('../market-snapshot.json',import.meta.url),'utf8'));
 for(const c of cards)core.quote(c,data,fx,now);
 assert.equal(JSON.stringify(cards),before);
});
test('a verified English/Spanish stock breakdown retains its English market reference',()=>{
 const mixed={...card,language:'Inglés / Español',quantity:10,languageQuantities:{'Inglés':9,'Español':1}};
 const q=core.quote(mixed,snapshot(),fx,now);assert.equal(q.status,'ready');assert.equal(q.reference,true);
 assert.equal(core.quote({...mixed,languageQuantities:{'Inglés':9,'Japonés':1}},snapshot(),fx,now).status,'unavailable');
});

test('3000 COP per card times 6 units is exactly 18000 COP',()=>{
 const cards=[{id:1,quantity:6}];
 const result=core.inventoryTotal(cards,c=>({available:true,quantity:c.quantity}),()=>({usable:true,copMin:3000}));
 assert.equal(result.total,18000);assert.equal(result.units,6);assert.equal(result.refs,1);assert.equal(result.complete,true);
});
test('the total sums every published quantity independently and never reorders the catalog',()=>{
 const cards=[{id:97,quantity:6},{id:4,quantity:3},{id:108,quantity:10}];
 const before=JSON.stringify(cards),prices={97:3000,4:2500,108:2311};
 const result=core.inventoryTotal(cards,c=>({available:true,quantity:c.quantity}),c=>({usable:true,copMin:prices[c.id]}));
 assert.equal(result.total,18000+7500+23110);assert.equal(result.units,19);assert.equal(result.refs,3);
 assert.equal(JSON.stringify(cards),before);
});
test('stock overrides and published availability control the units included in the total',()=>{
 const cards=[{id:1,quantity:99},{id:2,quantity:20},{id:3,quantity:5}];
 const stock={1:{available:true,quantity:6},2:{available:false,quantity:20},3:{available:false,quantity:0}};
 const result=core.inventoryTotal(cards,c=>stock[c.id],()=>({usable:true,copMin:3000}));
 assert.equal(result.total,18000);assert.equal(result.units,6);assert.equal(result.refs,1);
});
test('missing prices are counted explicitly and can never be presented as a complete total',()=>{
 const cards=[{id:1,quantity:6},{id:2,quantity:3}];
 const result=core.inventoryTotal(cards,c=>({available:true,quantity:c.quantity}),c=>c.id===1?{usable:true,copMin:3000}:{usable:false,copMin:null});
 assert.equal(result.total,18000);assert.equal(result.units,9);assert.equal(result.unpriced,1);assert.equal(result.unpricedUnits,3);assert.equal(result.complete,false);
});
test('unsafe monetary totals or fractional quantities fail instead of rounding silently',()=>{
 assert.throws(()=>core.inventoryTotal([{id:1}],()=>({available:true,quantity:2}),()=>({usable:true,copMin:Number.MAX_SAFE_INTEGER})),RangeError);
 assert.throws(()=>core.inventoryTotal([{id:1}],()=>({available:true,quantity:1.5}),()=>({usable:true,copMin:3000})),RangeError);
});
