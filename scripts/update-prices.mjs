#!/usr/bin/env node
/* Public price-data refresh. Never writes catalog, order, stock or images. */
import {readFile,writeFile,rename} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import vm from "node:vm";
import {createHash} from "node:crypto";
import "../pricing-core.js";
const core=globalThis.BovedaPricingCore;
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target=path.join(ROOT,"market-snapshot.json");
const NOW=Date.now(), USER_AGENT="BovedaTCG/2.0 (+https://spenceralejandro10.github.io/Base-de-datos-pokemon/)";
const warnings=[];
const readJSON=async file=>JSON.parse(await readFile(file,"utf8"));
async function request(url,{text=false,headers={}}={}) {
  let error;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const r=await fetch(url,{headers:{"User-Agent":USER_AGENT,...headers},signal:AbortSignal.timeout(25000)});
      if(!r.ok)throw Error("HTTP "+r.status+" from "+new URL(url).hostname);
      return {body:text?await r.text():await r.json(),modified:r.headers.get("last-modified")};
    } catch(e) {error=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
  }
  throw error;
}
async function loadCards() {
  const context={window:{}};
  vm.runInNewContext(await readFile(path.join(ROOT,"cards.js"),"utf8"),context,{timeout:1000});
  const cards=JSON.parse(JSON.stringify(context.window.CARDS));
  if(!Array.isArray(cards)||!cards.length||new Set(cards.map(c=>c.id)).size!==cards.length)throw Error("Invalid catalog");
  // Only read metadata for the published IDs. Never resurrect removed cards.
  const shared=await readFile(path.join(ROOT,"shared-images.js"),"utf8");
  const key=shared.match(/const KEY\s*=\s*"([^"]+)"/)?.[1];
  if(!key)throw Error("Missing public catalog key");
  try {
    const {body:rows}=await request("https://cnivcnexsqobipvqxero.supabase.co/rest/v1/pokemon_card_overrides?select=card_id,set_name,language",{headers:{apikey:key}});
    if(!Array.isArray(rows))throw Error("Invalid metadata response");
    const byId=new Map(rows.map(row=>[Number(row.card_id),row]));
    for(const card of cards) {
      const row=byId.get(card.id);
      if(row?.set_name)card.set=row.set_name;
      if(row?.language)card.language=row.language;
    }
  } catch(e) {warnings.push("Metadata unavailable; preserved published identity: "+e.message);}
  return cards;
}
async function exchange(previous) {
  const day=core.bogotaDay(NOW), query=new URLSearchParams({
    $where:`vigenciadesde <= '${day}T00:00:00.000' AND vigenciahasta >= '${day}T00:00:00.000'`,
    $order:"vigenciadesde DESC",$limit:"1"
  });
  try {
    const {body:rows}=await request("https://www.datos.gov.co/resource/32sa-8pi3.json?"+query);
    const row=rows?.[0], fx={cop:Number(row?.valor),source:"TRM",updatedAt:row?.vigenciadesde,
      validFrom:String(row?.vigenciadesde||"").slice(0,10),validTo:String(row?.vigenciahasta||"").slice(0,10)};
    if(row?.unidad!=="COP"||!core.validFX(fx,NOW))throw Error("Invalid TRM validity");
    return fx;
  } catch(e) {
    warnings.push("Official TRM unavailable: "+e.message);
    if(core.validFX(previous,NOW)&&previous.source==="TRM")return previous;
  }
  try {
    const {body:d}=await request("https://open.er-api.com/v6/latest/USD");
    const fx={cop:d.rates?.COP,source:"ExchangeRate-API",updatedAt:new Date(d.time_last_update_unix*1000).toISOString()};
    if(d.result!=="success"||d.base_code!=="USD"||!core.validFX(fx,NOW))throw Error("Invalid FX");
    return fx;
  } catch(e) {
    warnings.push("FX unavailable: "+e.message);
    return previous||null; // Preserve the date; the client excludes expired conversions.
  }
}
async function groupData(key,sourceUpdatedAt,previous,cards) {
  // Reuse a successful daily ingest, unless the catalog's pricing identities changed.
  const identities=cards.map(c=>[c.id,c.name,c.number,c.set,c.language,c.finish||""]);
  const signature=createHash("sha256").update(JSON.stringify(identities)).digest("hex");
  if(previous?.sourceUpdatedAt===sourceUpdatedAt&&previous.signature===signature)return previous;
  const prefix="https://tcgcsv.com/tcgplayer/"+key.replace("-","/")+"/";
  // Sequential, bounded requests follow the source's published rate guidance.
  const products=await request(prefix+"products");
  await new Promise(resolve=>setTimeout(resolve,150));
  const prices=await request(prefix+"prices");
  for(const response of [products,prices]) {
    if(response.body?.success!==true||!Array.isArray(response.body.results))throw Error("Invalid TCGCSV response for "+key);
  }
  if(!products.body.results.length)throw Error("Empty product catalog for "+key);
  const byId=new Map();
  for(const row of prices.body.results) {
    if(!Number.isSafeInteger(row.productId)||!core.positive(row.marketPrice)||typeof row.subTypeName!=="string")continue;
    if(!byId.has(row.productId))byId.set(row.productId,[]);
    byId.get(row.productId).push({usd:row.marketPrice,finish:row.subTypeName});
  }
  const all=products.body.results.flatMap(product=>{
    const number=product.extendedData?.find(e=>e.name==="Number")?.value;
    return number&&Number.isSafeInteger(product.productId)?[{id:product.productId,name:product.name,number,prices:byId.get(product.productId)||[]}]:[];
  });
  const wanted=new Set(cards.flatMap(card=>core.match(card,{products:all})).map(p=>p.id));
  const modified=Date.parse(prices.modified);
  const updatedAt=Number.isFinite(modified)&&modified<=NOW+300000?new Date(modified).toISOString():sourceUpdatedAt;
  return {updatedAt,sourceUpdatedAt,signature,products:all.filter(p=>wanted.has(p.id))};
}
async function main() {
  let previous={groups:{},collectr:{cards:{},status:"not_configured"}};
  try{previous=await readJSON(target);}catch(e){if(e.code!=="ENOENT")throw e;}
  const cards=await loadCards(), active=new Map();
  for(const card of cards) {
    const key=core.groupFor(card);
    if(key){if(!active.has(key))active.set(key,[]);active.get(key).push(card);}
  }
  const fxJob=exchange(previous.fx);
  let sourceUpdatedAt=null;
  try {
    const {body:stamp}=await request("https://tcgcsv.com/last-updated.txt",{text:true});
    const t=Date.parse(stamp.trim());
    if(!Number.isFinite(t)||t>NOW+300000)throw Error("Invalid source timestamp");
    sourceUpdatedAt=new Date(t).toISOString();
  } catch(e){warnings.push("Source timestamp unavailable: "+e.message);}
  const groups={};let refreshed=0;
  for(const [key,groupCards] of active) {
    try {
      if(!sourceUpdatedAt)throw Error("No verified source timestamp");
      groups[key]=await groupData(key,sourceUpdatedAt,previous.groups?.[key],groupCards);
      refreshed++;
    } catch(e) {
      warnings.push("Group "+key+": "+e.message);
      if(previous.groups?.[key])groups[key]=previous.groups[key];
    }
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  let collectr=previous.collectr||{cards:{},status:"not_configured"};
  try {collectr=await readJSON(path.join(ROOT,"collectr-snapshot.json"));}
  catch(e){if(e.code!=="ENOENT")warnings.push("Collectr snapshot invalid; previous data kept");}
  if(!collectr?.cards||Array.isArray(collectr.cards))throw Error("Invalid Collectr snapshot");
  const result={schemaVersion:1,generatedAt:new Date(NOW).toISOString(),sourceUpdatedAt,groups,fx:await fxJob,collectr,warnings};
  if(!Object.keys(groups).length)throw Error("No market data; previous snapshot was not overwritten");
  const bySource={},missing=[];
  for(const card of cards) {
    const q=core.quote(card,result,result.fx,NOW);
    bySource[q.source]=(bySource[q.source]||0)+1;
    if(!q.usable)missing.push({id:card.id,name:card.name,number:card.number,set:card.set,language:card.language,status:q.status});
  }
  result.coverage={references:cards.length,bySource,unverified:missing};
  const temporary=target+".tmp";
  await writeFile(temporary,JSON.stringify(result)+"\n");await rename(temporary,target);
  console.log(JSON.stringify({collections:active.size,refreshed,references:cards.length,bySource,unverified:missing.length,fx:result.fx,warnings},null,2));
  // Publish partial successes, but make a failed ingestion visible in Actions.
  if(warnings.some(s=>s.startsWith("Group ")||s.startsWith("Source timestamp")))process.exitCode=2;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
