/*
 * Bóveda TCG · Consulta visual de listas de clientes.
 * Exclusivamente lectura: no autentica, vende, descuenta ni escribe a Supabase.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const catalog=window.BovedaOrderBridge;
const pricing=window.CardPrices;
const pictures=window.CardImages;
const stock=window.CardStock;
const localKey="boveda-visual-consulta-v1";
const excludedKey="boveda-visual-consulta-hidden-v1";
const dialog=$("orderDialog");
const cop=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
const normalize=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const number=s=>String(s??"").toUpperCase().replace(/\s+/g,"").split("/").map(a=>a.replace(/(^|[A-Z])0+(?=\d)/g,"$1")).join("/");
const identity=c=>[normalize(c.name),number(c.number),normalize(c.set),normalize(c.language)].join("|");
const cleanText=s=>String(s??"").trim();
const el=(tag,cls,content)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(content!=null)n.textContent=String(content);
 return n;
};
let rows=[];
let excluded=new Set();
function persistExcluded(){
 try{
  if(excluded.size)localStorage.setItem(excludedKey,JSON.stringify([...excluded]));
  else localStorage.removeItem(excludedKey);
 }catch(_){}
}
function info(s,wrong=false){const n=$("orderMessage");n.textContent=s;n.classList.toggle("error",wrong);}
function catalogCards(){return catalog.cards();}
function findCard(parts,code){
 const all=catalogCards();
 const target={name:parts[1],number:parts[2],set:parts[3],language:parts[4]};
 const found=all.filter(c=>identity(c)===identity(target));
 const codeHit=all.find(c=>catalog.code(c).toUpperCase()===code);
 if(found.length===1){
  const card=found[0];
  return {id:card.id,notice:codeHit&&codeHit.id!==card.id?
   "El código BTCG cambió; se verificó la carta por nombre, número, colección e idioma.":""};
 }
 if(found.length>1)return{id:null,notice:"Hay varias coincidencias iguales. Revisa la referencia manualmente."};
 if(codeHit){
  return{id:null,notice:"No coincide con la ficha actual del código "+code+
   ". Por seguridad no se mostró otra edición."};
 }
 return{id:null,notice:"No se encontró una coincidencia exacta en Bóveda TCG."};
}
function parse(text){
 const found=[],ignored=[];
 for(const lineRaw of text.split(/\r?\n/)){
  const line=lineRaw.trim();
  if(!line||/^CARTAS SELECCIONADAS\s*:?\s*$/i.test(line))continue;
  const segments=line.split("|").map(x=>x.trim());
  const code=(segments[0].match(/BTCG-\d{1,6}/i)||[])[0]?.toUpperCase()||"";
  if(!code&&segments.length<3){ignored.push(line.slice(0,70));continue}
  const complete=segments.length>=5;
  const match=complete?findCard(segments,code):{id:null,notice:"Faltan nombre, número, colección o idioma."};
  const priceMatch=line.match(/Referencia por carta:\s*\$?\s*([\d.,\s\u00a0]+)\s*COP/i);
  const unitPrice=priceMatch?Number(priceMatch[1].replace(/[^\d]/g,"")):null;
  const amountMatch=line.match(/Unidades solicitadas:\s*(\d+)/i);
  const quantity=amountMatch?Number(amountMatch[1]):1;
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100000){
   ignored.push("Cantidad inválida: "+line.slice(0,50));continue
  }
  const record={code,name:segments[1]||"Por identificar",
   number:segments[2]||"",set:segments[3]||"",language:segments[4]||"",
   id:match.id,notice:match.notice,price:Number.isFinite(unitPrice)?unitPrice:null,
   quantity,original:found.length};
  const duplicate=found.find(x=>x.id!=null&&x.id===record.id&&x.price===record.price);
  if(duplicate){duplicate.quantity+=quantity;continue}
  found.push(record);
 }
 return{found,ignored};
}
function resolved(row){return row.id==null?null:catalogCards().find(c=>Number(c.id)===Number(row.id))||null}
function marketData(card){
 if(!card)return null;
 try{return pricing.quote(card)}catch(_){return null}
}
function marketCop(quote){
 return quote?.status==="ready"&&Number.isFinite(quote.copMin)?Math.round(quote.copMin):null;
}
function totals(){
 let client=0,market=0,count=0,unpricedClient=0,unpricedMarket=0,found=0;
 for(const row of rows){
  const card=resolved(row);
  const quote=marketData(card);
  const marketUnit=marketCop(quote);
  if(card)found++;
  count+=row.quantity;
  if(row.price===null)unpricedClient++;else client+=row.quantity*row.price;
  if(marketUnit===null)unpricedMarket++;else market+=row.quantity*marketUnit;
 }
 return{client,market,count,found,unpricedClient,unpricedMarket};
}
function displayTotals(){
 const t=totals();
 $("orderMatched").textContent=t.found+" / "+rows.length;
 $("orderUnits").textContent=t.count.toLocaleString("es-CO");
 $("orderClientTotal").textContent=cop(t.client)+(t.unpricedClient?"*":"");
 $("orderMarketTotal").textContent=t.unpricedMarket===rows.length?"Por confirmar":cop(t.market)+(t.unpricedMarket?"*":"");
 $("orderMarketNote").textContent=t.unpricedMarket?
  t.unpricedMarket+" referencia(s) sin precio de mercado; total parcial.":"Según Market Price · valor mínimo por acabado";
 $("orderResultsDescription").textContent=rows.length+" referencias del cliente · "+t.count+
  " unidades · "+(rows.length-t.found)+" sin coincidencia.";
}
function appendArtwork(card,container){
 if(!card){container.append(el("span","order-no-art","Sin coincidencia"));return}
 const pic=el("img","order-image");
 pic.alt=card.name+" "+card.number;
 pic.loading="lazy";pic.referrerPolicy="no-referrer";pic.hidden=true;
 const placeholder=el("span","order-no-art","Buscando imagen…");
 container.append(pic,placeholder);
 async function show(match){
  const candidates=match?.images||[];
  if(!candidates.length)return false;
  return await new Promise(resolve=>{
   let n=0;
   const next=()=>{
    if(!pic.isConnected)return resolve(false);
    if(n>=candidates.length){pic.onerror=null;pic.onload=null;return resolve(false)}
    const candidate=candidates[n++];
    pic.onload=()=>{pic.hidden=false;placeholder.hidden=true;resolve(true)};
    pic.onerror=next;
    pic.src=candidate;
   };
   next();
  });
 }
 (async()=>{
  try{
   const main=await pictures.resolve(card);
   if(await show(main))return;
   if(main?.status==="shared"||main?.status==="local"){
    if(await show(await pictures.resolveCatalog(card)))return;
   }
   placeholder.textContent="Imagen no disponible";
  }catch(_){placeholder.textContent="Imagen no disponible"}
 })();
}
function line(tag,caption,value,more){
 const n=el(tag,"order-data-pair");
 n.append(el("span","order-data-label",caption),el("strong","order-data-value",value));
 if(more)n.append(el("small","order-data-detail",more));
 return n;
}
function cardItem(row,index){
 const card=resolved(row),quote=marketData(card),mkt=marketCop(quote);
 const stockInfo=card?catalog.availability(card):null;
 const wrap=el("article","order-list-row"+(card?"":" order-list-row-warning"));
 const art=el("div","order-list-art");appendArtwork(card,art);wrap.append(art);
 const content=el("div","order-list-identity");
 const label=el("div","order-number-label",card?catalog.code(card):(row.code||"No localizada"));
 const heading=el("h4","",card?.name||row.name);
 const subtitle=el("div","order-identity-sub",(card?.number||row.number)+" · "+
   (card?.set||row.set)+" · "+(card?.language||row.language));
 content.append(label,heading,subtitle);
 if(row.notice)content.append(el("p","order-catalog-note",row.notice));
 if(!card)content.append(el("p","order-catalog-note","Confirma los datos del cliente antes de localizar la carta."));
 wrap.append(content);
 const stockbox=el("div","order-list-stock");
 stockbox.append(el("span","order-data-label","Unidades"));
 stockbox.append(el("strong","order-list-qty","Solicita "+row.quantity));
 if(stockInfo){
  const amount=stockInfo.quantity;
  const text="Registradas: "+amount;
  const indicator=el("span","order-stock-badge"+(amount<row.quantity?" order-stock-low":""),text);
  stockbox.append(indicator);
  if(amount<row.quantity)stockbox.append(el("small","order-stock-caution","Revisar físicamente"));
 }else stockbox.append(el("small","order-stock-caution","Sin registro confirmado"));
 wrap.append(stockbox);
 const prices=el("div","order-list-prices");
 const msgPrice=row.price==null?"Por confirmar":cop(row.price);
 prices.append(line("div","Precio en mensaje",msgPrice,row.quantity>1&&row.price!=null?
  "Subtotal "+cop(row.price*row.quantity):""));
 let mktText="Precio por confirmar",hint="";
 if(mkt!=null){
  mktText=cop(mkt);
  if(quote.copMax!=null&&Math.round(quote.copMax)>mkt)mktText="Desde "+mktText;
  hint=quote.stale?"Última referencia disponible":"TCGplayer Market Price";
  if(quote.reference)hint+=" · edición en inglés";
 }else if(quote?.status==="ready"&&Number.isFinite(quote.min)){
  mktText="US$"+quote.min.toFixed(2);
  hint="Sin conversión COP disponible";
 }
 prices.append(line("div","Mercado TCGplayer",mktText,hint));
 wrap.append(prices);
 const actions=el("div","order-list-actions");
 if(card){
  const href=quote?.status==="ready"&&quote.url?quote.url:pricing.searchUrl(card);
  const link=el("a","order-tcg-link","Ver en TCGplayer");
  link.href=href;link.target="_blank";link.rel="noopener noreferrer";
  link.title=quote?.url?"Abrir el producto de TCGplayer":"Buscar la carta en TCGplayer";
  actions.append(link);
 }else actions.append(el("span","order-lookup-needed","Revisar identidad"));
 const remove=el("button","order-remove-local","Quitar de lista");
 remove.type="button";
 remove.title="Solo retira esta referencia del panel visual. No altera el inventario ni el Excel.";
 remove.addEventListener("click",()=>{
  excluded.add(row.original);
  rows=rows.filter(item=>item.original!==row.original);
  persistExcluded();
  render();
  info("Se quitó "+(card?.name||row.name)+" de este panel. El inventario no cambió.");
 });
 actions.append(remove);
 wrap.append(actions);
 return wrap;
}
function sortRows(){
 const sort=$("orderSort").value;
 const all=rows.slice();
 if(sort==="original")return all;
 return all.sort((a,b)=>{
  const A=resolved(a),B=resolved(b);
  const primary=sort==="collection"?(A?.set||a.set):(A?.name||a.name);
  const secondary=sort==="collection"?(B?.set||b.set):(B?.name||b.name);
  return primary.localeCompare(secondary,"es",{sensitivity:"base"})||
    (A?.name||a.name).localeCompare(B?.name||b.name,"es",{sensitivity:"base"})||
    a.original-b.original;
 });
}
function render(){
 const workspace=$("orderWorkspace");
 workspace.hidden=!rows.length;
 if(!rows.length)return;
 displayTotals();
 const container=$("orderCards");
 container.replaceChildren();
 for(const [i,row] of sortRows().entries())container.append(cardItem(row,i));
}
function consult(text,restore=false){
 const parsed=parse(text);
 if(!parsed.found.length){info("Pega una lista de cartas con los códigos y los detalles recibidos.",true);return}
 if(!restore){excluded.clear();persistExcluded()}
 rows=parsed.found.filter(row=>!excluded.has(row.original));
 try{localStorage.setItem(localKey,text)}catch(_){}
 render();
 const valid=rows.filter(r=>resolved(r)).length;
 info(valid+" de "+rows.length+" referencias identificadas. "+
  rows.reduce((n,r)=>n+r.quantity,0)+" unidades en la consulta."+
  (parsed.ignored.length?" Algunas líneas no se pudieron interpretar.":""),
  valid!==rows.length||parsed.ignored.length>0);
}
function newQuery(){
 rows=[];
 excluded.clear();
 persistExcluded();
 $("orderPaste").value="";
 $("orderWorkspace").hidden=true;
 info("Lista limpia. Puedes pegar un nuevo mensaje.");
 try{localStorage.removeItem(localKey)}catch(_){}
 $("orderPaste").focus();
}
$("orderOpen").addEventListener("click",()=>{
 if(!dialog.open)dialog.showModal();
 if(rows.length)render();
 void stock.refresh(true).then(()=>{if(dialog.open&&rows.length)render()}).catch(()=>{});
});
$("orderClose").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
$("orderImport").addEventListener("click",()=>consult($("orderPaste").value));
$("orderClear").addEventListener("click",newQuery);
$("orderSort").addEventListener("change",render);
pricing.subscribe(()=>{if(dialog.open&&rows.length)render()});
stock.listen(()=>{if(dialog.open&&rows.length)render()});
try{
 const hidden=JSON.parse(localStorage.getItem(excludedKey)||"[]");
 if(Array.isArray(hidden))excluded=new Set(hidden.filter(n=>Number.isSafeInteger(n)&&n>=0));
 const saved=localStorage.getItem(localKey);
 if(saved){$("orderPaste").value=saved;consult(saved,true);}
}catch(_){}
window.BovedaVisualOrder=Object.freeze({parse});
})();