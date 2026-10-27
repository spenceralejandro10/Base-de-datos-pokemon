/*
 * Referencias de mercado TCGplayer recopiladas por TCGdex (o Pokémon TCG API).
 * No son cotizaciones de venta instantáneas. Enlaces al producto exacto cuando
 * la fuente ofrece un productId; si no, búsqueda por nombre + expansión + número.
 */
(function(){
 "use strict";
 const cache=new Map();
 function format(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}
 function valid(n){return typeof n==="number"&&Number.isFinite(n)&&n>0}
 const searchUrl=card=>"https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q="+encodeURIComponent([card.name,card.number,card.set].filter(Boolean).join(" "))+"&view=grid";
 const safeUrl=(s)=>{try{const u=new URL(s);return u.protocol==="https:"&&/(^|\.)tcgplayer\.com$/i.test(u.hostname)?u.href:null;}catch(_){return null}};
 function ts(x){if(!x)return "";const d=new Date(typeof x==="number"?(x<1e10?x*1000:x):x);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"});}
 function collect(data,card){
  const tcg=data?.pricing?.tcgplayer||data?.tcgplayer;
  if(!tcg)return [];
  const vars=tcg.prices||tcg;
  const names={normal:"Normal",holofoil:"Holo","reverse-holofoil":"Reversa","1st-edition":"Primera edición","1st-edition-holofoil":"Primera edición holo",unlimited:"Ilimitada","unlimited-holofoil":"Ilimitada holo"};
  const arr=[];
  for(const [kind,price] of Object.entries(vars)){
    if(!price||typeof price!=="object"||Array.isArray(price))continue;
    const val=valid(price.marketPrice)?price.marketPrice:(valid(price.midPrice)?price.midPrice:null);
    if(!val)continue;
    const productId=price.productId??tcg.productId??null;
    const direct=productId&&/^\d+$/.test(String(productId))?"https://www.tcgplayer.com/product/"+productId:null;
    arr.push({market:"TCGplayer",variant:names[kind]||kind,price:val,unit:"USD",updated:ts(tcg.updated||tcg.updatedAt),url:direct||safeUrl(tcg.url)||searchUrl(card),exactLink:!!direct||!!safeUrl(tcg.url),source:"TCGdex / TCGplayer"});
  }
  return arr;
 }
 async function compute(card){
   const exact=await window.CardImages.resolveCatalog(card);
   const fallback=searchUrl(card);
   if(!exact?.catalog?.id)return {statuses:[],url:fallback,reason:"No hay coincidencia confirmada; consulta TCGplayer directamente."};
   const meta=exact.catalog;
   const endpoint=meta.kind==="tcgdex"?
     "https://api.tcgdex.net/v2/"+encodeURIComponent(meta.language)+"/cards/"+encodeURIComponent(meta.id):
     "https://api.pokemontcg.io/v2/cards/"+encodeURIComponent(meta.id);
   const doc=await window.CardImages.loadCardJSON(endpoint);
   const rows=collect(doc?.data||doc,card);
   return {statuses:rows,url:rows[0]?.url||fallback,reference:!!meta.editionIsReference,
     reason:rows.length?"":"TCGplayer aún no publica una referencia para esta carta o idioma."};
 }
 async function resolve(card){
   const k=[card.id,card.number,card.set,card.language].join("|");
   if(!cache.has(k))cache.set(k,compute(card).catch(()=>({statuses:[],url:searchUrl(card),reason:"No se pudo consultar TCGplayer por el momento."})));
   return cache.get(k);
 }
 function reset(){cache.clear()}
 window.CardPrices={resolve,display:row=>format(row.price),reset,searchUrl};
})();