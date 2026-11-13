import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const sharedSource=await readFile(new URL('../shared-images.js',import.meta.url),'utf8');
const imageSource=await readFile(new URL('../card-images.js',import.meta.url),'utf8');
const photo='https://cnivcnexsqobipvqxero.supabase.co/storage/v1/object/public/pokemon-gallery-overrides/test/photo.jpg';
const card={id:47,name:'Mewtwo',number:'052',set:'Scarlet & Violet Promo',language:'Inglés'};
const row={card_key:'47|mewtwo|052|scarlet & violet promo|ingles',image_url:photo,updated_at:'2026-11-13T20:00:00Z'};
const response=body=>({ok:true,json:async()=>structuredClone(body)});
function context(fetcher){
 const ctx={SHARED_IMAGE_SNAPSHOT:{schemaVersion:1,rows:[row]},fetch:fetcher,AbortSignal,URL,URLSearchParams,Intl,setTimeout,clearTimeout,AbortController,localStorage:{getItem(){throw Error('Storage disabled')},setItem(){throw Error('Storage disabled')},removeItem(){throw Error('Storage disabled')}},CARDS:[card]};ctx.window=ctx;return ctx;
}
test('shared photographs load on a clean browser with all local storage disabled',async()=>{
 const ctx=context(async url=>response(String(url).startsWith('./')?{schemaVersion:1,rows:[row]}:[row]));
 vm.runInNewContext(sharedSource,ctx);await ctx.SharedImages.init();
 vm.runInNewContext(imageSource,ctx);const found=await ctx.CardImages.resolve(card);
 assert.equal(found.status,'shared');assert.equal(found.images[0],photo);
 assert.equal(ctx.SharedImages.getShared({...card,name:'Corrected name',language:'Japonés'}),photo);
});
test('published backup preserves photographs when the database is unavailable',async()=>{
 const ctx=context(async url=>{if(String(url).startsWith('./'))return response({schemaVersion:1,rows:[row]});throw Error('Database offline');});
 vm.runInNewContext(sharedSource,ctx);await ctx.SharedImages.init();assert.equal(ctx.SharedImages.getShared(card),photo);
});
test('a newer live manual photograph wins over the published backup',async()=>{
 const latest=photo.replace('photo.jpg','new-photo.jpg');
 const ctx=context(async url=>response(String(url).startsWith('./')?{schemaVersion:1,rows:[row]}:[{...row,image_url:latest}]));
 vm.runInNewContext(sharedSource,ctx);await ctx.SharedImages.init();assert.equal(ctx.SharedImages.getShared(card),latest);
});
test('a failed shared save cannot falsely save a manual image only on this device',async()=>{
 let cached=false;
 const ctx=context(async()=>{});ctx.localStorage.setItem=()=>{cached=true;};ctx.SharedImages={updateImage:async()=>{throw Error('Save rejected')},getShared:()=>null};
 vm.runInNewContext(imageSource,ctx);
 await assert.rejects(ctx.CardImages.setManual(card,photo),/Save rejected/);assert.equal(cached,false);
});
test('manual image saving confirms cloud persistence before its optional local cache',async()=>{
 const steps=[];const ctx=context(async()=>{});ctx.SharedImages={updateImage:async()=>{steps.push('cloud')},getShared:()=>null};ctx.localStorage.setItem=()=>steps.push('cache');
 vm.runInNewContext(imageSource,ctx);await ctx.CardImages.setManual(card,photo);assert.deepEqual(steps,['cloud','cache']);
});
test('every published card has an image in the durable snapshot without browser data',async()=>{
 const ctx=context(async()=>{throw Error('Cloud unavailable');});
 vm.runInNewContext(await readFile(new URL('../cards.js',import.meta.url),'utf8'),ctx);
 const before=JSON.stringify(ctx.CARDS);
 vm.runInNewContext(await readFile(new URL('../shared-images-snapshot.js',import.meta.url),'utf8'),ctx);
 vm.runInNewContext(sharedSource,ctx);
 for(const card of ctx.CARDS){
  assert.match(ctx.SharedImages.getShared(card)||'',/^https:\/\/cnivcnexsqobipvqxero\.supabase\.co\/storage\/v1\/object\/public\/pokemon-gallery-overrides\//,'Missing durable image for '+card.id);
 }
 assert.equal(JSON.stringify(ctx.CARDS),before);
});
