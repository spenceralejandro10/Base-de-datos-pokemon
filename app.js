(function(){
"use strict";
let base=window.CARDS||[];
// Frozen display sequence. The immutable internal ID keeps photos, prices and stock attached to the right card.
const fixedDisplayOrder=new Map(base.map((card,index)=>[Number(card.id),index]));
const shared=window.SharedImages,meta=window.CatalogOverrides,stock=window.CardStock,market=window.CardPrices;
const el=id=>document.getElementById(id);
const q=el("q"),setFilter=el("set"),langFilter=el("lang"),availability=el("availability"),view=el("view"),results=el("results");
const info=el("editorMessage"),editor=el("editorDialog"),cartDialog=el("cartDialog");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Etiquetas públicas consecutivas según el orden de exhibición.
 // El ID interno queda intacto para proteger fotografías, existencias y carritos.
const publicCodes=new Map();
const cardCode=c=>publicCodes.get(Number(c.id))||
  "BTCG-"+String(c.id).padStart(4,"0");
// Estado de administración autorizado por el propietario.
const ADMIN_ENABLED=true;
let editingMode=true;
let records=base.map(x=>({...x})),editing=null,epoch=0,busy=false,initialized=false;
const CART_KEY="boveda-tcg-cart-v1";
const WHOLE_OFFER_KEY="boveda-tcg-whole-inventory-offer-v1";
let inventoryOffer=null;
try{
 const stored=JSON.parse(localStorage.getItem(WHOLE_OFFER_KEY)||"null");
 if(stored&&/^BOV-\d{6}-[A-F0-9]{8}$/.test(stored.code)&&Number.isSafeInteger(stored.amount)&&stored.amount>0&&
   Number.isFinite(stored.referenceTotal)&&Number.isInteger(stored.refs)&&Number.isInteger(stored.units)){
  inventoryOffer=stored;
 }
}catch(_){}

// Read-only bridge for customer-list preparation. It cannot enable administration
// and intentionally exposes no database write functions.
window.BovedaOrderBridge=Object.freeze({
 cards:()=>records.slice(),
 code:card=>cardCode(card),
 availability:card=>available(card),
 sold:card=>Boolean(window.BovedaSold?.isSold(card))
});
// Al consolidar el Alakazam repetido del Excel se retiró BTCG-0054.
// No perder su fotografía local: conservar la copia original y asociarla
// a BTCG-0037 cuando esta no tiene todavía una imagen propia.
try {
 const legacyAlakazam=localStorage.getItem("pokemon-image-54");
 if(legacyAlakazam && !localStorage.getItem("pokemon-image-37"))
  localStorage.setItem("pokemon-image-37",legacyAlakazam);
}catch(_){};
let cart=new Map();
try {cart=new Map(JSON.parse(localStorage.getItem(CART_KEY)||"[]").filter(x=>Array.isArray(x)&&x.length===2&&Number.isInteger(x[0])&&Number.isInteger(x[1])&&x[1]>0))}catch(_){}
// El carrito que contenía el Alakazam repetido ahora apunta a su fila consolidada.
if(cart.has(54)){
 cart.set(37,(cart.get(37)||0)+cart.get(54));
 cart.delete(54);
 try{localStorage.setItem(CART_KEY,JSON.stringify([...cart]))}catch(_){}
}
const saveCart=()=>{try{localStorage.setItem(CART_KEY,JSON.stringify([...cart]))}catch(_){}updateCartCount()};
function flash(text,error=false){info.textContent=text;info.className="editor-message"+(error?" error":"")}
function available(c){
 const current=stock.get(c);
 return window.BovedaSold?.isSold(c)?{...current,available:false,soldVisual:true}:current;
}
function findCard(id){return records.find(c=>Number(c.id)===Number(id))}
const tcgQuery=c=>market.searchUrl(c);
const moneyCOP=value=>"$"+Math.round(value).toLocaleString("es-CO")+" COP";
function inventorySnapshot(){
 let total=0,totalMax=0,units=0,refs=0,unpriced=0,ranges=0;
 for(const card of records){
  const current=available(card);
  if(!current.available||current.quantity<=0)continue;
  refs++;
  units+=current.quantity;
  const quote=market.quote(card);
  if(!quote.usable||!Number.isFinite(quote.copMin)){
   unpriced++;
   continue;
  }
  total+=quote.copMin*current.quantity;
  totalMax+=quote.copMax*current.quantity;
  if(quote.min!==quote.max)ranges++;
 }
 return {total:Math.round(total),totalMax:Math.round(totalMax),units,refs,unpriced,ranges};
}
function updateInventoryValue(){
 const amountEl=el("inventoryTotal"),detailEl=el("inventoryMeta");
 if(!amountEl||!detailEl)return;
 if(!initialized){
  amountEl.textContent="Calculando…";
  el("openInventoryOffer").disabled=true;
  return;
 }
 const summary=inventorySnapshot();
 amountEl.textContent=summary.unpriced===summary.refs?"Pendiente de cotización":moneyCOP(summary.total)+
  (summary.totalMax!==summary.total?" – "+moneyCOP(summary.totalMax):"");
 detailEl.textContent=summary.refs.toLocaleString("es-CO")+" referencias · "+
  summary.units.toLocaleString("es-CO")+" unidades disponibles · "+
  (summary.unpriced?summary.unpriced+" referencias sin precio vigente; total parcial":"Precios de referencia verificados")+
  (summary.ranges?" · "+summary.ranges+" referencias con rango según acabado":"");
 el("openInventoryOffer").disabled=summary.units<=0;
}
function updateStats(){
 el("total").textContent=records.length;
 el("copies").textContent=records.reduce((sum,c)=>{const stock=available(c);return sum+(stock.available?stock.quantity:0)},0).toLocaleString("es-CO");
 updateInventoryValue();
}
function updateCartCount(){el("cartCount").textContent=([...cart.values()].reduce((s,n)=>s+n,0)+(inventoryOffer?1:0))}
function cleanCart(){
 let changed=false;
 for(const [id,qty] of cart){
  const c=findCard(id);
  if(!c){cart.delete(id);changed=true;continue}
  const a=available(c);
  if(!a.available){cart.delete(id);changed=true}
  else if(qty>a.quantity){cart.set(id,a.quantity);changed=true}
 }
 if(changed)saveCart();else updateCartCount();
}
// Orden de lanzamiento de las expansiones. El año de cada carta siempre
// proviene del Excel; la prioridad dentro de un mismo año es la expansión.
const SET_MONTHS={
 "30th celebration":12,
 "journey together":3,"prismatic evolutions":1,
 "stellar crown":9,"twilight masquerade":5,"temporal forces":3,"paldean fates":1,
 "shiny treasure ex":12,"paradox rift":11,"special deck set ex (svg)":11,
 "151":9,"obsidian flames":8,"pokemon card 151":6,"paldea evolved":6,
 "scarlet & violet":3,"scarlet ex":1,"violet ex":1,
 "crown zenith":1,"lost origin":9,"astral radiance":5,
 "celebrations (classic collection)":10,"evolving skies":8,"darkness ablaze":8
};
const cleanSet=name=>String(name||"").normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();
function collectionScore(name){
 if(!name)return -1;
 const matching=records.filter(c=>c.set===name);
 const lastYear=matching.reduce((n,c)=>Math.max(n,Number(c.year)||0),0);
 return lastYear*100+(SET_MONTHS[cleanSet(name)]||0);
}
function orderCollections(names){
 return names.sort((a,b)=>collectionScore(b)-collectionScore(a)||
 a.localeCompare(b,"es"));
}
function orderedCards(list){
 // Never regroup or reorder when cards are removed or metadata changes.
 return list.sort((a,b)=>(fixedDisplayOrder.get(Number(a.id))??Number.MAX_SAFE_INTEGER)-
 (fixedDisplayOrder.get(Number(b.id))??Number.MAX_SAFE_INTEGER));
}
function rebuildPublicCodes(){
 publicCodes.clear();
 // Se numeran TODAS las cartas en el orden general, no solo las filtradas.
 orderedCards([...records]).forEach((card,index)=>
   publicCodes.set(Number(card.id),"BTCG-"+String(index+1).padStart(4,"0")));
}
function applyMeta(){
 records=meta.apply(base);
 rebuildPublicCodes();
 updateStats();
 refreshOptions();
 cleanCart();
 render();
}
function refreshOptions(){
 for(const [control,key] of [[setFilter,"set"],[langFilter,"language"]]){
  const old=control.value;
  control.replaceChildren();
  const option=document.createElement("option");
  option.value="";option.textContent=key==="set"?"Todas las colecciones":"Todos los idiomas";control.append(option);
  (key==="set" ? orderCollections([...new Set(records.map(c=>c.set).filter(Boolean))])
    : [...new Set(records.flatMap(c=>c.languageQuantities?Object.keys(c.languageQuantities):[c.language]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"))
  ).forEach(value=>{
   const opt=document.createElement("option");opt.value=value;opt.textContent=value;control.append(opt);
  });
  control.value=[...control.options].some(x=>x.value===old)?old:"";
 }
}
function filtering(){
 const search=q.value.trim().toLocaleLowerCase("es");
 return orderedCards(records.filter(c=>{
  const a=available(c);
  if(setFilter.value&&setFilter.value!==c.set)return false;
  if(langFilter.value&&langFilter.value!==c.language&&!Object.hasOwn(c.languageQuantities||{},langFilter.value))return false;
  if(availability.value==="available"&&!a.available)return false;
  if(availability.value==="soldout"&&a.available)return false;
  return !search||[cardCode(c),c.name,c.number,c.set,c.language,c.year,c.ordinal].join(" ").toLocaleLowerCase("es").includes(search);
 }));
}
function imageSearchUrl(card){
 const terms=[card.name,card.number,card.set,card.language,"Pokémon TCG"].map(v=>String(v||"").trim()).filter(Boolean);
 return "https://www.google.com/search?tbm=isch&q="+encodeURIComponent(terms.join(" "));
}
let suggestedImage="", suggestedCardId=null;
function resetImageSuggestion(){
 suggestedImage="";suggestedCardId=null;
 el("imageSearchResult").hidden=true;
 el("imageSearchPreview").removeAttribute("src");
 el("imageSearchInfo").textContent="";
 el("assignFoundImage").disabled=true;
}
async function findCatalogArtwork(){
 if(!editing||!editingMode)return;
 const selectedId=editing.id;
 resetImageSuggestion();
 const trigger=el("findCatalogImage");
 trigger.disabled=true;
 flash("Buscando imagen de "+editing.name+" según expansión, número e idioma…");
 try{
  const match=await window.CardImages.resolveCatalog(editing);
  if(!editingMode||!editing||editing.id!==selectedId||!editor.open)return;
  if(match.status==="verified"&&match.images?.length&&!match.catalog?.editionIsReference){
   // Evitar imágenes de otro idioma. Solo permitir las que correspondan a la edición buscada.
   let url="";
   for(const candidate of match.images){
    if(await loadImage(candidate)){url=candidate;break}
   }
   if(!editingMode||!editing||editing.id!==selectedId||!editor.open)return;
   if(!url){
    flash("Se encontró una coincidencia, pero no se pudo cargar la foto. Usa Google Imágenes.",true);
    return;
   }
   suggestedImage=url;
   suggestedCardId=selectedId;
   el("imageSearchPreview").src=url;
   el("imageSearchInfo").textContent="Encontrada en "+(match.source||"catálogo")+" · "+(match.info||"Coincidencia por número y colección")+". Confirma que corresponda a la edición exacta antes de asignarla.";
   el("imageSearchResult").hidden=false;
   el("assignFoundImage").disabled=false;
   flash("Imagen localizada. Comprueba la vista previa y pulsa «Asignar esta imagen».");
  }else if(match.catalog?.editionIsReference){
   flash("El catálogo solo encontró una imagen en otro idioma. Para no asignar la versión equivocada, utiliza «Buscar en Google Imágenes».",true);
  }else{
   flash("No se encontró una imagen verificable automáticamente. Usa «Buscar en Google Imágenes» para ver resultados de esta carta.",true);
  }
 }catch(e){if(editing?.id===selectedId)flash(e.message||"No fue posible buscar imágenes. Prueba Google Imágenes.",true)}
 finally{trigger.disabled=false}
}
function adminDisplay(){
 if(!ADMIN_ENABLED)editingMode=false;
 const button=el("managementEntry");
 button.hidden=!ADMIN_ENABLED;
 button.disabled=!ADMIN_ENABLED;
 button.textContent=editingMode?"Volver a cliente":"Modo administrador";
 button.setAttribute("aria-pressed",String(editingMode));
 button.setAttribute("aria-label",editingMode?"Desactivar herramientas de edición":"Activar herramientas de edición");
 el("editingBanner").hidden=!editingMode;
 document.body.classList.toggle("editing-mode",editingMode);
}
function showEditor(card){
 if(!editingMode||!card)return;
 editing=findCard(card.id)||card;
 flash("");
 const a=available(editing);
 el("adminQuantity").value=String(a.quantity);
 el("adminListed").checked=a.listed;
 el("adminLanguage").value=editing.language||"";
 el("imageUrl").value=shared.getShared(editing)||localStorage.getItem("pokemon-image-"+editing.id)||"";
 el("imageUpload").value="";
 resetImageSuggestion();
 el("searchCardImage").href=imageSearchUrl(editing);
 el("editingCard").textContent=cardCode(editing)+" · "+editing.name+" · "+editing.number;
 el("editorTitle").textContent="Editar "+editing.name;
 if(!editor.open)editor.showModal();
}
async function doAdmin(fn,message){
 if(busy)return;
 if(!editingMode){flash("Activa Modo administrador para editar.",true);return}
 busy=true;flash("Guardando cambios…");
 try{
  await fn();
  await Promise.all([stock.refresh(true),meta.fetchOverrides(true),shared.loadShared(true)]);
  applyMeta();
  if(editing)showEditor(editing);
  flash(message);
 }catch(e){flash(e.message||"No se pudo guardar el cambio.",true)}
 finally{busy=false}
}
let fillingImages=false;
async function completeCatalogImages(){
  if(!editingMode||fillingImages)return;
  fillingImages=true;
  const button=el("autoFillImages"),label=el("autoFillProgress");
  button.disabled=true;
  let processed=0,stored=0,unresolved=0,errors=0;
  try{
    label.textContent="Comprobando fotografías existentes…";
    await shared.loadShared(true);
    // Solo cartas que todavía no tienen fotografía personal del propietario.
    const todo=base.filter(c=>!shared.getShared(c)&&
      !/^https:\/\//i.test(localStorage.getItem("pokemon-image-"+c.id)||""));
    let position=0;
    async function worker(){
      while(position<todo.length&&editingMode){
        const card=todo[position++];
        try{
          const found=await window.CardImages.resolveCatalog(card);
          if(found.status==="verified"&&!found.catalog?.editionIsReference&&found.images?.length){
            let url="";
            for(const candidate of found.images){
              if(await loadImage(candidate)){url=candidate;break;}
            }
            if(url&&!shared.getShared(card)){
              if(await shared.saveCatalogImage(card,url))stored++;
            }else if(!url)unresolved++;
          }else unresolved++;
        }catch(_){errors++;}
        processed++;
        label.textContent="Verificadas "+processed+"/"+todo.length+
          " · fotos guardadas: "+stored;
      }
    }
    await Promise.all(Array.from({length:3},()=>worker()));
    await shared.loadShared(true);
    if(initialized)render();
    label.textContent="Completado: "+stored+" fotos verificadas añadidas; "+
      (unresolved+errors)+" sin imagen exacta confirmada. Las manuales están intactas.";
  }catch(e){
    label.textContent=e.message||"No fue posible completar la búsqueda automática.";
  }finally{
    button.disabled=false;
    fillingImages=false;
  }
}
el("autoFillImages").addEventListener("click",()=>{void completeCatalogImages()});

el("managementEntry").addEventListener("click",()=>{
 if(!ADMIN_ENABLED)return;
 editingMode=!editingMode;
 if(!editingMode&&editor.open)editor.close();
 if(!editingMode)editing=null;
 adminDisplay();
 render();
});
el("findCatalogImage").addEventListener("click",()=>{void findCatalogArtwork()});
el("assignFoundImage").addEventListener("click",()=>{
 if(!editing||suggestedCardId!==editing.id||!suggestedImage||!editingMode)return;
 const selected=suggestedImage;
 doAdmin(()=>shared.updateImage(editing,selected),"Imagen del catálogo asignada y guardada para todos.");
});
el("closeEditor").addEventListener("click",()=>editor.close());
editor.addEventListener("click",e=>{if(e.target===editor)editor.close()});
el("saveStock").addEventListener("click",()=>{if(editing)doAdmin(()=>stock.save(editing,el("adminQuantity").value,el("adminListed").checked),"Cantidad y estado publicados correctamente.")});
el("saveCardInfo").addEventListener("click",()=>{if(editing)doAdmin(()=>meta.save(editing,{set:editing.set||"",language:el("adminLanguage").value,validation_note:editing.adminNote||""}),"Idioma guardado correctamente.")});
el("saveImageUrl").addEventListener("click",()=>{if(editing)doAdmin(()=>shared.updateImage(editing,el("imageUrl").value),"Imagen guardada para todos los visitantes.")});
el("saveImageFile").addEventListener("click",()=>{if(editing)doAdmin(()=>shared.uploadImage(editing,el("imageUpload").files[0]),"Fotografía subida correctamente.")});
let syncingManualImages=false;
async function syncManualImages(silent=false){
 if(!editingMode||syncingManualImages)return;
 const list=base.filter(c=>/^https:\/\//i.test(localStorage.getItem("pokemon-image-"+c.id)||"")
  && !shared.getShared(c));
 if(!list.length){
  if(!silent)flash("Todas las imágenes manuales de este navegador ya están sincronizadas.");
  return;
 }
 syncingManualImages=true;
 let saved=0,failed=0;
 try{
  for(const c of list){
   try {
    // Subir el enlace de imagen a la base de datos, pero conservar la copia local.
    await shared.updateImage(c,localStorage.getItem("pokemon-image-"+c.id));
    saved++;
   }catch(_){failed++}
  }
  if(saved)await shared.loadShared(true);
  if(!silent)flash(saved+" imágenes sincronizadas"+(failed?" · "+failed+" pendientes.":"."),!!failed);
  if(initialized)render();
 }finally{syncingManualImages=false}
}


function addToCart(c){
 const a=available(c);
 if(!a.available)return;
 const qty=cart.get(c.id)||0;
 if(qty>=a.quantity)return;
 cart.set(c.id,qty+1);
 saveCart();
}
function removeFromCart(c){cart.delete(c.id);saveCart();drawCart();render()}
function updateCartQty(c,newQty){
 const a=available(c),n=Math.min(a.quantity,Math.max(0,Number(newQty)||0));
 if(!a.available||n===0)cart.delete(c.id);else cart.set(c.id,n);
 saveCart();drawCart();render();
}
const offerDialog=el("inventoryOfferDialog");
const offerForm=el("inventoryOfferForm");
const offerAmountInput=el("offerAmount");
function newOfferCode(){
 const now=new Date();
 const date=String(now.getFullYear()).slice(-2)+String(now.getMonth()+1).padStart(2,"0")+String(now.getDate()).padStart(2,"0");
 const bytes=new Uint8Array(4);
 crypto.getRandomValues(bytes);
 return "BOV-"+date+"-"+Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
}
function referenceText(offer){
 if(offer.unpriced===offer.refs)return "Sin cotización vigente";
 const max=Number.isSafeInteger(offer.referenceTotalMax)?offer.referenceTotalMax:offer.referenceTotal;
 return moneyCOP(offer.referenceTotal)+(max!==offer.referenceTotal?" – "+moneyCOP(max):"")+
  (offer.unpriced?" · subtotal parcial; "+offer.unpriced+" referencias sin precio":"");
}
function openOfferDialog(){
 if(!initialized)return;
 const summary=inventorySnapshot();
 if(summary.units===0)return;
 el("offerReferenceTotal").textContent=referenceText({referenceTotal:summary.total,referenceTotalMax:summary.totalMax,unpriced:summary.unpriced,refs:summary.refs});
 el("offerReferenceUnits").textContent=summary.refs+" referencias · "+summary.units+" unidades disponibles";
 offerAmountInput.value=inventoryOffer?inventoryOffer.amount:"";
 el("offerError").hidden=true;
 el("offerPreview").textContent=inventoryOffer?"Oferta anterior: "+moneyCOP(inventoryOffer.amount)+" · Al guardar se generará un nuevo código.":"";
 if(cartDialog.open)cartDialog.close();
 offerDialog.showModal();
 offerAmountInput.focus();
}
el("openInventoryOffer").addEventListener("click",openOfferDialog);
el("closeInventoryOffer").addEventListener("click",()=>offerDialog.close());
offerDialog.addEventListener("click",event=>{if(event.target===offerDialog)offerDialog.close()});
offerAmountInput.addEventListener("input",()=>{
 const amount=Number(offerAmountInput.value);
 el("offerPreview").textContent=offerAmountInput.value&&Number.isSafeInteger(amount)&&amount>0?
  "Tu propuesta: "+moneyCOP(amount):"";
 el("offerError").hidden=true;
});
offerForm.addEventListener("submit",event=>{
 event.preventDefault();
 const amount=Number(offerAmountInput.value),summary=inventorySnapshot();
 if(!Number.isSafeInteger(amount)||amount<=0||!offerAmountInput.value||summary.units<=0){
  el("offerError").textContent="Ingresa un valor válido para crear tu oferta.";
  el("offerError").hidden=false;
  return;
 }
 const proposal={
  code:newOfferCode(),amount,
  referenceTotal:summary.total,referenceTotalMax:summary.totalMax,unpriced:summary.unpriced,refs:summary.refs,units:summary.units,
  createdAt:new Date().toISOString()
 };
 try{
  localStorage.setItem(WHOLE_OFFER_KEY,JSON.stringify(proposal));
 }catch(_){
  el("offerError").textContent="No se pudo guardar la oferta en este navegador.";
  el("offerError").hidden=false;
  return;
 }
 inventoryOffer=proposal;
 updateCartCount();
 offerDialog.close();
 drawCart();
 cartDialog.showModal();
});
function listText(){
 const now=new Date();
 const lines=[
 "BÓVEDA TCG — PROPUESTA DE COMPRA",
 "Fecha de envío: "+now.toLocaleString("es-CO"),
 "Catálogo: https://spenceralejandro10.github.io/Base-de-datos-pokemon/",
 "Consulta de disponibilidad; NO representa pedido pagado ni reserva."
 ];
 if(inventoryOffer){
  lines.push("","OFERTA POR TODO EL INVENTARIO DISPONIBLE",
   "CÓDIGO DE OFERTA: "+inventoryOffer.code,
   "OFERTA TOTAL DEL COMPRADOR: "+moneyCOP(inventoryOffer.amount),
   "Valor de referencia al crear la oferta: "+referenceText(inventoryOffer),
   "Inventario ofertado: "+inventoryOffer.refs+" referencias · "+inventoryOffer.units+" unidades",
   "Fecha de creación: "+new Date(inventoryOffer.createdAt).toLocaleString("es-CO"),
   "Incluye todas las cartas disponibles al crear la oferta. Sujeto a revisión y confirmación de existencias.");
 }
 if(cart.size){
  lines.push("","CARTAS SELECCIONADAS","");let total=0;
  for(const [id,quantity] of cart){
   const c=findCard(id);if(!c)continue;total+=quantity;
   const quote=market.quote(c);
   lines.push(cardCode(c)+" | "+c.name+" | "+c.number+" | "+(c.set||"Sin colección")+
    " | "+(c.language||"Sin idioma")+" | Referencia por carta: "+market.amount(quote)+" | Unidades solicitadas: "+quantity);
  }
  lines.push("","REFERENCIAS DISTINTAS: "+cart.size,"UNIDADES SOLICITADAS: "+total);
 }
 lines.push("","Las propuestas están sujetas a confirmación del vendedor. Los precios de referencia pueden cambiar. Envío no incluido.");
 return lines.join("\r\n");
}
function drawCart(){
 const host=el("cartItems");host.replaceChildren();
 cleanCart();
 const hasContent=Boolean(cart.size||inventoryOffer);
 el("downloadCart").disabled=!hasContent;
 el("copyCart").disabled=!hasContent;
 el("shareCart").disabled=!hasContent;
 if(!hasContent){
  host.textContent="Todavía no has seleccionado cartas ni creado ofertas.";
  el("cartSummary").textContent="";
  return;
 }
 if(inventoryOffer){
  const box=document.createElement("section");box.className="cart-whole-offer";
  box.innerHTML='<span class="cart-offer-tag">Oferta por toda la colección</span>'+
   '<span class="cart-offer-code">Código: '+esc(inventoryOffer.code)+'</span>'+
   '<strong class="cart-offer-price">'+esc(moneyCOP(inventoryOffer.amount))+'</strong>'+
   '<small>Valor de referencia: '+esc(referenceText(inventoryOffer))+' · '+inventoryOffer.refs+' referencias · '+inventoryOffer.units+' unidades</small>'+
   '<p>Envía el código y el monto de tu propuesta para que podamos revisarla.</p>';
  const actions=document.createElement("div");actions.className="cart-offer-actions";
  const edit=document.createElement("button");edit.type="button";edit.textContent="Cambiar mi oferta";
  edit.addEventListener("click",openOfferDialog);
  const remove=document.createElement("button");remove.type="button";remove.textContent="Quitar oferta";
  remove.addEventListener("click",()=>{
   inventoryOffer=null;
   localStorage.removeItem(WHOLE_OFFER_KEY);
   updateCartCount();drawCart();
  });
  actions.append(edit,remove);box.append(actions);host.append(box);
 }
 for(const [id,qty] of cart){
  const c=findCard(id);if(!c)continue;
  const row=document.createElement("div");row.className="cart-row";
  row.innerHTML='<div><strong>'+esc(c.name)+'</strong><small>'+esc(cardCode(c))+' · '+esc(c.number)+' · '+esc(c.language)+'</small></div>';
  row.firstElementChild.append(market.element(c));
  const controls=document.createElement("div");controls.className="cart-row-controls";
  const minus=document.createElement("button");minus.textContent="−";minus.type="button";minus.addEventListener("click",()=>updateCartQty(c,qty-1));
  const count=document.createElement("span");count.textContent=qty;
  const plus=document.createElement("button");plus.textContent="+";plus.type="button";plus.disabled=qty>=available(c).quantity;plus.addEventListener("click",()=>updateCartQty(c,qty+1));
  const remove=document.createElement("button");remove.textContent="Quitar";remove.type="button";remove.addEventListener("click",()=>removeFromCart(c));
  controls.append(minus,count,plus,remove);row.append(controls);host.append(row);
 }
 const chosenUnits=[...cart.values()].reduce((s,v)=>s+v,0);
 el("cartSummary").textContent=(inventoryOffer?"1 oferta por todo el inventario":"")+
  (cart.size?(inventoryOffer?" · ":"")+cart.size+" referencias · "+chosenUnits+" unidades seleccionadas":"");
}
el("cartOpen").addEventListener("click",()=>{drawCart();cartDialog.showModal()});
el("closeCart").addEventListener("click",()=>cartDialog.close());
cartDialog.addEventListener("click",e=>{if(e.target===cartDialog)cartDialog.close()});
el("clearCart").addEventListener("click",()=>{
 if(!cart.size&&!inventoryOffer)return;
 if(!confirm("¿Vaciar tus cartas seleccionadas y ofertas?"))return;
 cart.clear();inventoryOffer=null;localStorage.removeItem(WHOLE_OFFER_KEY);
 saveCart();drawCart();render();
});
el("downloadCart").addEventListener("click",()=>{
 if(!cart.size&&!inventoryOffer)return;
 const blob=new Blob(["\uFEFF"+listText()],{type:"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="Boveda-TCG-propuesta.txt";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
});
el("copyCart").addEventListener("click",async()=>{
 if(!cart.size&&!inventoryOffer)return;
 try{
  await navigator.clipboard.writeText(listText());
  el("copyCart").textContent="Propuesta copiada";
  setTimeout(()=>el("copyCart").textContent="Copiar propuesta",2500);
 }catch(_){alert("No fue posible copiar. Utiliza el botón de descarga.")}
});
el("shareCart").addEventListener("click",()=>{
 if(!cart.size&&!inventoryOffer)return;
 window.open("https://wa.me/?text="+encodeURIComponent(listText()),"_blank","noopener,noreferrer");
});

async function loadImage(url){
  return new Promise(resolve=>{
    const image=new Image();
    let finished=false;
    const timeout=setTimeout(()=>finish(false),10000);
    function finish(success){
      if(finished)return;
      finished=true;
      clearTimeout(timeout);
      image.onload=null;
      image.onerror=null;
      resolve(success);
    }
    image.referrerPolicy="no-referrer";
    image.onload=()=>finish(true);
    image.onerror=()=>finish(false);
    image.src=url;
  });
}
async function imageFor(c,img,placeholder,status,token){
  try{
    const main=await window.CardImages.resolve(c);
    if(token!==epoch||!img.isConnected)return;
    async function display(match){
      for(const url of match.images||[]){
        if(token!==epoch||!img.isConnected)return false;
        if(await loadImage(url)){
          if(token!==epoch||!img.isConnected)return false;
          img.src=url;
          img.alt=c.name+" · "+c.number;
          img.title=match.catalog?.editionIsReference
            ? "Imagen de referencia en otro idioma; comprueba la edición"
            : c.name+" · "+c.number;
          img.hidden=false;
          if(placeholder)placeholder.hidden=true;
          if(status)status.textContent=match.status==="shared"?"Imagen de la bóveda":
            match.status==="local"?"Imagen local":
            match.catalog?.editionIsReference?"Referencia visual en inglés":"Imagen oficial de catálogo";
          return true;
        }
      }
      return false;
    }
    // Las imágenes manuales se respetan. Si una miniatura externa caduca,
    // intentamos recuperar la carta exacta del catálogo antes de mostrar vacío.
    if(await display(main))return;
    if(main.status==="shared"||main.status==="local"){
      const fallback=await window.CardImages.resolveCatalog(c);
      if(await display(fallback))return;
    }
    if(token!==epoch||!img.isConnected)return;
    if(status)status.textContent=main.reason||"Imagen no disponible";
    if(placeholder?.classList?.contains("placeholder"))placeholder.textContent="Imagen pendiente";
  }catch(_){
    if(status)status.textContent="Imagen no disponible";
    if(placeholder?.classList?.contains("placeholder"))placeholder.textContent="Imagen pendiente";
  }
}
function tcgLink(c) {
 const a=document.createElement("a");
 a.className="tcg-link";
 const quote=market.quote(c);
 const fromCollectr=quote.source==="collectr-search"||quote.source==="collectr";
 a.href=quote.url||market.searchUrl(c);
 a.target="_blank";
 a.rel="noopener noreferrer";
 a.textContent=fromCollectr?"Consultar en Collectr":"Ver en TCGplayer";
 a.title=fromCollectr?"Buscar la carta exacta en Collectr":"Consultar el precio de esta carta en TCGplayer";
 return a;
}

function editButton(c){
 if(!editingMode)return null;
 const button=document.createElement("button");button.type="button";button.className="image-button";
 button.textContent="Editar imagen, cantidad e idioma";button.addEventListener("click",()=>showEditor(c));return button;
}
function quickImageSearchButton(c){
 if(!editingMode)return null;
 const a=document.createElement("a");
 a.className="image-search-shortcut";
 a.href=imageSearchUrl(c);
 a.target="_blank";
 a.rel="noopener noreferrer";
 a.textContent="Buscar imagen";
 a.title="Buscar imágenes de esta versión exacta en Google Imágenes";
 return a;
}
function cartButton(c){
 const a=available(c);
 const button=document.createElement("button");button.type="button";
 button.className="add-cart";
 button.textContent=a.soldVisual?"Vendida":a.available?(cart.get(c.id)?"Agregar otra · "+cart.get(c.id):"Agregar a mi selección"):(a.override&&a.quantity===0?"Vendida":"No disponible");
 button.disabled=!a.available||(cart.get(c.id)||0)>=a.quantity;
 button.addEventListener("click",()=>{addToCart(c);render()});
 return button;
}
function languageStockLabel(c,a){
 if(!c.languageQuantities)return a.soldVisual?"Vendida":a.available?"Disponible · "+a.quantity+" ud.":a.override&&a.quantity===0?"Vendida":"No disponible";
 const entries=Object.entries(c.languageQuantities).filter(([,q])=>Number(q)>0);
 const baseTotal=entries.reduce((sum,[,q])=>sum+Number(q),0);
 if(a.quantity!==baseTotal)return (a.available?"Disponible · "+a.quantity+" ud.":"No disponible")+" · Revisar desglose por idioma";
 return (a.available?"Disponible · "+a.quantity+" ud.":"No disponible")+" · "+entries.map(([lang,q])=>q+" "+lang.toLowerCase()).join(" + ");
}
function languageQuantityBadges(c) {
 const quantities=c.languageQuantities;
 if(!quantities)return "";
 const entries=Object.entries(quantities).filter(([,quantity])=>Number(quantity)>0);
 if(!entries.length)return "";
 return '<div class="language-quantities" aria-label="Cantidad disponible por idioma">'+
  entries.map(([language,quantity])=>
   '<span class="language-quantity">'+esc(language)+': <strong>'+esc(quantity)+'</strong> ud.</span>'
  ).join("")+'</div>';
}
function galleryCard(c,token) {
 const a=available(c);
 const item=document.createElement("article");
 item.className="item"+(a.soldVisual?" is-marked-sold":"");
 const details=[c.set,c.languageQuantities?Object.keys(c.languageQuantities).join(" / "):c.language].filter(Boolean).join(" · ");
 item.innerHTML='<div class="art"><div class="placeholder"><span class="loader"></span><span>Cargando imagen…</span></div><img hidden loading="lazy" referrerpolicy="no-referrer"><span class="pill">'+esc(cardCode(c))+'</span></div>'+
 (a.soldVisual?'<div class="sold-image-stamp" aria-label="Carta vendida">VENDIDA</div>':'')+
 '<div class="details"><h3>'+esc(c.name)+'</h3><div class="num">'+esc(c.number)+'</div>'+
 (details?'<div class="meta">'+esc(details)+'</div>':'')+
 '<div class="stock-status '+(a.available?"is-available":"is-soldout")+'">'+esc(a.available?'Disponible · '+a.quantity+' ud.':a.soldVisual?'Vendida':'No disponible')+'</div>'+
 languageQuantityBadges(c)+
 '<div class="links"></div></div>';
 const actions=item.querySelector(".links");
 actions.before(market.element(c));
 actions.append(tcgLink(c),cartButton(c));
 const admin=editButton(c);if(admin)actions.append(admin);

 imageFor(c,item.querySelector(".art>img"),item.querySelector(".placeholder"),null,token);
 return item;
}

function tableCard(c,token) {
 const a=available(c);
 const tr=document.createElement("tr");
 if(a.soldVisual)tr.className="is-marked-sold";
 tr.innerHTML='<td class="thumbnail"><div class="mini-art"><img hidden loading="lazy" referrerpolicy="no-referrer"><span>—</span></div></td>'+
 [cardCode(c),c.name,c.number,c.set,c.languageQuantities?Object.entries(c.languageQuantities).map(([lang,qty])=>lang+": "+qty).join(" · "):c.language,a.quantity,languageStockLabel(c,a)]
 .map((x,i)=>'<td'+(i===2?' class="num-col"':"")+'>'+esc(x==null||x===""?"—":x)+'</td>').join("")+
 '<td class="table-market"></td><td class="table-action"></td>';
 tr.querySelector(".table-market").append(market.element(c),tcgLink(c));
 tr.querySelector(".table-action").append(cartButton(c));
 const admin=editButton(c);if(admin)tr.querySelector(".table-action").append(admin);

 imageFor(c,tr.querySelector(".mini-art img"),tr.querySelector(".mini-art span"),null,token);
 return tr;
}

function render(){
 epoch++;const token=epoch;
 if(el("exchangeRate"))el("exchangeRate").textContent=market.rateText();
 if(el("marketStatus"))el("marketStatus").textContent=market.statusText();
 const arr=filtering();
 el("shown").textContent=arr.length;
 results.replaceChildren();
 results.className=view.value==="table"?"table-container":"grid";
 if(!arr.length){const none=document.createElement("div");none.className="no-results";none.textContent="No encontramos cartas con esos filtros. Prueba «Limpiar filtros».";results.append(none);return}
 if(view.value==="table"){
  const scroller=document.createElement("div");scroller.className="table-scroll";
  const table=document.createElement("table");table.className="data-table";
  table.innerHTML="<thead><tr>"+["Imagen","ID","Carta","Número","Colección","Idioma","Unidades","Estado","Precio COP","Interés"].map(x=>"<th>"+x+"</th>").join("")+"</tr></thead>";
  const body=document.createElement("tbody");
  for(const c of arr)body.append(tableCard(c,token));
  table.append(body);scroller.append(table);results.append(scroller);
 }else{
  const frag=document.createDocumentFragment();
  arr.forEach(c=>frag.append(galleryCard(c,token)));
  results.append(frag);
 }
}
let searchTimer;
q.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(render,150)});
for(const item of [setFilter,langFilter,availability,view])item.addEventListener("input",render);
el("resetFilters").addEventListener("click",()=>{
 q.value="";setFilter.value="";langFilter.value="";availability.value="all";view.value="grid";
 render();window.scrollTo({top:0,behavior:"smooth"});
});
updateCartCount();
adminDisplay();
shared.subscribe(()=>{if(initialized){render();updatePhotoRecovery()}});
meta.listen(()=>{if(initialized){applyMeta();updatePhotoRecovery()}});

/* Recuperación no destructiva de fotos guardadas antes en este mismo navegador.
   Solo se habilita desde el enlace de recuperación y nunca reemplaza imágenes de Supabase. */
const recoverySection=el("photoRecovery");
const recoveryButton=el("photoRecoveryButton");
const recoveryStatus=el("photoRecoveryStatus");
let recoveringPhotos=false;
const recoveryMode=new URLSearchParams(location.search).has("recuperar-fotos") ||
  new URLSearchParams(location.search).get("admin")==="1";
if(recoveryMode)recoverySection.hidden=false;
function localPhoto(card){
 try{
  const url=String(localStorage.getItem("pokemon-image-"+card.id)||"").trim();
  return /^https:\/\//i.test(url)&&url.length<=2048?url:null;
 }catch(_){return null}
}
function localPhotosNotSynced(){
 return records.filter(card=>!shared.getShared(card)&&localPhoto(card));
}
function updatePhotoRecovery(){
 if(!recoveryMode||recoveringPhotos||!initialized)return;
 const unsynced=localPhotosNotSynced();
 recoveryButton.disabled=!unsynced.length;
 recoveryStatus.textContent=unsynced.length?
  "Encontramos "+unsynced.length+" fotografías antiguas en este navegador que todavía no están sincronizadas.":
  "No encontramos imágenes locales pendientes en este navegador. Las imágenes guardadas en la nube se mantienen intactas.";
}
async function restoreLocalPhotos(){
 if(recoveringPhotos||!initialized)return;
 recoveringPhotos=true;recoveryButton.disabled=true;
 let restored=0,failed=0,skipped=0;
 try{
  await shared.loadShared(true);
  const pending=localPhotosNotSynced();
  if(!pending.length){
   recoveryStatus.textContent="Este navegador no tiene fotografías locales pendientes de restauración.";
   return;
  }
  for(const card of pending){
   recoveryStatus.textContent="Recuperando fotografía "+(restored+failed+skipped+1)+" de "+pending.length+"…";
   const url=localPhoto(card);
   if(!url||shared.getShared(card)){skipped++;continue;}
   // Verificar que el enlace de la foto siga mostrando una imagen real.
   const working=await new Promise(resolve=>{
    const check=new Image();let done=false;
    const timeout=setTimeout(()=>finish(false),8500);
    const finish=ok=>{
     if(done)return;done=true;clearTimeout(timeout);
     check.onload=null;check.onerror=null;resolve(ok);
    };
    check.onload=()=>finish(true);check.onerror=()=>finish(false);check.src=url;
   });
   if(!working){failed++;continue;}
   try{
    if(!shared.getShared(card)){
     await shared.updateImage(card,url);
     restored++;
    }else skipped++;
   }catch(_){failed++;}
  }
  await shared.loadShared(true);
  applyMeta();
  recoveryStatus.textContent="Recuperadas "+restored+" fotografías en Supabase"+
   (failed?" · "+failed+" enlaces no se pudieron restaurar":"")+
   (skipped?" · "+skipped+" conservadas sin cambios":"")+".";
 }catch(_){recoveryStatus.textContent="No fue posible completar la sincronización. Las fotografías existentes permanecen intactas."}
 finally{
  recoveringPhotos=false;
  recoveryButton.disabled=!localPhotosNotSynced().length;
 }
}
recoveryButton.addEventListener("click",()=>void restoreLocalPhotos());

stock.listen(()=>{if(initialized){updateStats();cleanCart();render()}});
market.subscribe(()=>{updateInventoryValue();render();if(cartDialog.open)drawCart()});
void market.init();
rebuildPublicCodes();
refreshOptions();updateStats();render();
function refreshPublishedCatalog(){
 return shared.loadCatalog().then(catalog=>{
  // Los IDs están anclados a las cartas, nunca se renumeran por su orden visual.
  const published=new Map(catalog.map(card=>[Number(card.id),card]));
  base=base.map(card=>({...card,...published.get(Number(card.id))}));
  return true;
 }).catch(()=>false);
}
Promise.allSettled([shared.init(),meta.fetchOverrides(true),stock.refresh(true),refreshPublishedCatalog()]).then(()=>{
 initialized=true;applyMeta();adminDisplay();updatePhotoRecovery();
 
});
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")
  Promise.allSettled([shared.loadShared(true),meta.fetchOverrides(true),
    stock.refresh(true),refreshPublishedCatalog()]).then(applyMeta);
});
setInterval(()=>{
 if(document.visibilityState==="visible")void stock.refresh(true);
},15000);
setInterval(()=>{
 if(document.visibilityState==="visible")Promise.allSettled([shared.loadShared(true),meta.fetchOverrides(true),
  stock.refresh(true),refreshPublishedCatalog()]).then(applyMeta);
},90000);
})();
