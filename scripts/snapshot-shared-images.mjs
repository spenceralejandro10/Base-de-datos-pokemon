#!/usr/bin/env node
/* Export only public image references. Never writes inventory, stock, or prices. */
import {readFile,writeFile,rename} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('shared-images.js',root),'utf8');
const base=source.match(/const URL_BASE\s*=\s*"([^"]+)"/)?.[1];
const key=source.match(/const KEY\s*=\s*"([^"]+)"/)?.[1];
if(!base||!key)throw Error('Missing public image service configuration');
const response=await fetch(base+'/rest/v1/pokemon_image_overrides?select=card_key,image_url,image_source,updated_at&order=updated_at.desc',{headers:{apikey:key,Accept:'application/json'},signal:AbortSignal.timeout(25000)});
if(!response.ok)throw Error('Public image catalog HTTP '+response.status);
const rows=await response.json();
if(!Array.isArray(rows)||!rows.length||rows.some(r=>typeof r.card_key!=='string'||!/^https:\/\//.test(r.image_url||'')))throw Error('Invalid public image snapshot');
const snapshot={schemaVersion:1,updatedAt:new Date().toISOString(),rows};
const text='/* Public shared image fallback. Generated without changing catalog order. */\nwindow.SHARED_IMAGE_SNAPSHOT='+JSON.stringify(snapshot)+';\n';
const target=new URL('shared-images-snapshot.js',root),temporary=new URL('shared-images-snapshot.js.tmp',root);
await writeFile(temporary,text);await rename(temporary,target);
console.log(rows.length+' public image references backed up; catalog, stock and prices unchanged.');
