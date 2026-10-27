/*
 * Bóveda TCG — precios de referencia: TCGplayer primero, Cardmarket únicamente
 * cuando no existe Market Price reciente y trazable en TCGplayer.
 * Fuentes: TCGdex o Pokemon TCG API. NO equivalen a oferta en tiempo real.
 */
(function(){
"use strict";
const memory=new Map();
const MAX_AGE_MS=7*24*60*60*1000;
const numberOK=n=>typeof n==="number"&&Number.isFinite(n)&&n>0&&n<1_000_000;
const money=(value,currency)=>new Intl.NumberFormat("es-CO",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const kinds={"normal":"Normal","holofoil":"Holo","reverse-holofoil":"Reversa","reverse":"Reversa","1st-edition":"1.ª edición","1st-edition-holofoil":"1.ª edición holo","unlimited":"Ilimitada","unlimited-holofoil":"Ilimitada holo"};
function dateMS(value){
 if(!value)return null;
 const date=typeof value==="number"?new Date(value<1e10?value*1000:value):new Date(value);
 const ms=date.getTime();
 return Number.isFinite(ms)?ms:null;
}
function recent(source){
 const ms=dateMS(source?.updated??source?.updatedAt);
 if(ms===null)return null;
 if(Date.now()-ms>MAX_AGE_MS||ms>Date.now()+86_400_000)return null;
 return ms;
}
function dateLabel(ms){return new Date(ms).toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})}
function searchUrl(card){
 return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q="+
  encodeURIComponent([card.name,card.number,card.set].filter(Boolean).join(" "))+"&view=grid";
}
function cardmarketSearch(card){
 return "https://www.cardmarket.com/en/Pokemon/Products/Search?searchString="+
  encodeURIComponent([card.name,card.number,card.set].filter(Boolean).join(" "));
}
function productLink(id){
 return /^\d{4,12}$/.test(String(id||""))?"https://www.tcgplayer.com/product/"+id:null;
}
function tcgRows(data,card){
 // Referencias de precios americanas en inglés. No atribuirlas a una impresión japonesa/española.
 if(card.language!=="Inglés")return [];
 const source=data?.pricing?.tcgplayer??data?.tcgplayer;
 const updated=recent(source);
 if(!updated)return [];
 const prices=source.prices||source;
 const rows=[];
 for(const [variant,values] of Object.entries(prices)){
  if(!values||typeof values!=="object"||Array.isArray(values)||!numberOK(values.marketPrice))continue;
  const direct=productLink(values.productId??source.productId);
  // No publicamos un precio que no puede contrastarse con un producto concreto.
  if(!direct)continue;
  rows.push({
   market:"TCGplayer",variant:kinds[variant]||variant,
   price:values.marketPrice,unit:"USD",
   updated:dateLabel(updated),updatedAt:updated,
   url:direct,exactLink:true,priceType:"Market Price"
  });
 }
 return rows;
}
function cardmarketRows(data,card){
 const source=data?.pricing?.cardmarket??data?.cardmarket;
 const updated=recent(source);
 if(!updated)return [];
 // Cardmarket indica tendencias, no el precio exacto de un ejemplar concreto.
 const result=[];
 const pairs=[["Normal / tendencia",source.trend],["Holo / tendencia",source["trend-holo"]]];
 for(const [variant,price] of pairs){
  if(!numberOK(price))continue;
  result.push({
   market:"Cardmarket",variant,price,unit:"EUR",
   updated:dateLabel(updated),updatedAt:updated,
   url:cardmarketSearch(card),exactLink:false,priceType:"Tendencia"
  });
 }
 return result;
}
async function compute(card){
 const tcgURL=searchUrl(card);
 const cmURL=cardmarketSearch(card);
 const reference=await window.CardImages.resolveCatalog(card);
 if(!reference?.catalog?.id){
  return {statuses:[],market:"none",url:tcgURL,secondaryUrl:cmURL,reason:"Colección o número sin coincidencia confirmada."};
 }
 const meta=reference.catalog;
 const address=meta.kind==="tcgdex"
  ?"https://api.tcgdex.net/v2/"+encodeURIComponent(meta.language)+"/cards/"+encodeURIComponent(meta.id)
  :"https://api.pokemontcg.io/v2/cards/"+encodeURIComponent(meta.id);
 const raw=await window.CardImages.loadCardJSON(address);
 if(!raw)return {statuses:[],market:"none",url:tcgURL,secondaryUrl:cmURL,reason:"No se pudo consultar una referencia actualizada."};
 const data=raw.data||raw;
 // 1. Solo TCGplayer si es edición inglesa verificable.
 if(meta.language==="en"&&!meta.editionIsReference){
  const tcg=tcgRows(data,card);
  if(tcg.length)return {statuses:tcg,market:"TCGplayer",url:tcg[0].url,secondaryUrl:cmURL,reason:""};
 }
 // 2. Cardmarket exclusivamente cuando no hay precio TCGplayer fiable.
 const cm=cardmarketRows(data,card);
 if(cm.length)return {statuses:cm,market:"Cardmarket",url:cmURL,secondaryUrl:tcgURL,reason:"Sin Market Price verificable en TCGplayer; se muestra la tendencia de Cardmarket."};
 return {statuses:[],market:"none",url:tcgURL,secondaryUrl:cmURL,reason:"Ninguna de las fuentes ofrece un precio reciente y contrastable para esta impresión."};
}
function resolve(card){
 const cacheKey=[card.id,card.name,card.number,card.set,card.language].join("|");
 if(!memory.has(cacheKey))memory.set(cacheKey,compute(card).catch(()=>({statuses:[],market:"none",url:searchUrl(card),secondaryUrl:cardmarketSearch(card),reason:"La fuente de precios no respondió."})));
 return memory.get(cacheKey);
}
window.CardPrices={resolve,display:row=>money(row.price,row.unit),reset:()=>memory.clear(),searchUrl,cardmarketSearch};
})();