/*
 * Bóveda TCG — TCGplayer (USD).
 * Precio orientativo de mercado, no precio instantáneo de venta.
 * No sustituir marketPrice por midPrice, lowestListing ni lowPrice.
 * No mezclar precios del mercado inglés con versiones en español/japonés.
 */
(function(){
"use strict";
const cache=new Map();
const MAX_AGE=7*24*60*60*1000; // más antiguo = mejor no mostrarlo
const format=number=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(number);
const safeNumber=value=>typeof value==="number"&&Number.isFinite(value)&&value>0&&value<1000000;
const norm=text=>String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const variants={"normal":"Normal","holofoil":"Holo","reverse-holofoil":"Reversa","1st-edition":"1.ª edición","1st-edition-holofoil":"1.ª edición holo","unlimited":"Ilimitada","unlimited-holofoil":"Ilimitada holo"};
function searchUrl(card){
 const query=[card.name,card.number,card.set].filter(Boolean).join(" ");
 return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q="+encodeURIComponent(query)+"&view=grid";
}
function parseTime(input){
 if(!input)return null;
 const date=new Date(typeof input==="number"?(input<1e10?input*1000:input):input);
 const n=date.getTime();
 return Number.isFinite(n)?n:null;
}
function directProduct(id){
 return /^\d{4,12}$/.test(String(id||""))?"https://www.tcgplayer.com/product/"+id:null;
}
function inspect(data,card){
 const source=data?.pricing?.tcgplayer??data?.tcgplayer;
 if(!source||typeof source!=="object")return {rows:[],why:"TCGplayer no publica datos para esta edición."};
 const ms=parseTime(source.updated??source.updatedAt);
 if(ms===null)return {rows:[],why:"Precio sin fecha de actualización verificable; se omite para evitar cifras desactualizadas."};
 const age=Date.now()-ms;
 if(age>MAX_AGE||age<-(24*60*60*1000))return {rows:[],why:"Último precio recibido hace más de 7 días; consulta el valor actual en TCGplayer."};
 const options=source.prices||source;
 const rows=[];
 for(const [name,detail] of Object.entries(options)){
  if(!detail||typeof detail!=="object"||Array.isArray(detail))continue;
  // Únicamente el precio marketPrice, nunca midPrice / lowPrice.
  if(!safeNumber(detail.marketPrice))continue;
  const link=directProduct(detail.productId??source.productId);
  // Sin productId no podemos comprobar que la cotización se corresponda con la ficha enlazada.
  if(!link)continue;
  rows.push({
   market:"TCGplayer",
   variant:variants[norm(name)]||name,
   price:detail.marketPrice,
   unit:"USD",
   updatedAt:ms,
   updated:new Date(ms).toLocaleDateString("es-CO",{year:"numeric",month:"short",day:"numeric"}),
   url:link,
   exactLink:true,
   source:"TCGdex / TCGplayer",
   priceType:"Market Price"
  });
 }
 return {rows,why:rows.length?"":"No hay Market Price reciente con enlace verificable para esta carta."};
}
async function compute(card){
 const fallback=searchUrl(card);
 // TCGplayer ofrece principalmente la impresión inglesa. No usar su precio para la versión japonesa o española.
 if(card.language!=="Inglés")return {statuses:[],url:fallback,reason:"No hay precio TCGplayer fiable para el idioma de esta carta. Revisa el mercado directamente.",reference:false};
 const match=await window.CardImages.resolveCatalog(card);
 if(!match?.catalog?.id)return {statuses:[],url:fallback,reason:"No se ha confirmado la colección y numeración exactas.",reference:false};
 const meta=match.catalog;
 if(meta.language!=="en"||meta.editionIsReference)return {statuses:[],url:fallback,reason:"La referencia encontrada no coincide con el idioma de esta edición.",reference:true};
 const url=meta.kind==="tcgdex"?
   "https://api.tcgdex.net/v2/en/cards/"+encodeURIComponent(meta.id):
   "https://api.pokemontcg.io/v2/cards/"+encodeURIComponent(meta.id);
 const doc=await window.CardImages.loadCardJSON(url);
 if(!doc)return {statuses:[],url:fallback,reason:"No se pudo verificar el precio en la fuente.",reference:false};
 const price=inspect(doc.data||doc,card);
 return {statuses:price.rows,url:price.rows[0]?.url||fallback,reference:false,reason:price.why};
}
function resolve(card){
 const k=[card.id,card.name,card.number,card.set,card.language].join("|");
 if(!cache.has(k))cache.set(k,compute(card).catch(()=>({statuses:[],url:searchUrl(card),reason:"La consulta de TCGplayer no respondió."})));
 return cache.get(k);
}
window.CardPrices={resolve,display:p=>format(p.price),reset:()=>cache.clear(),searchUrl};
})();