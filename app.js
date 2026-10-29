(function(){
"use strict";
let base=window.CARDS||[];
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
// Desactivado por solicitud del propietario; se restaura solo cuando lo solicite.
const ADMIN_ENABLED=false;
let editingMode=false;
let records=base.map(x=>({...x})),editing=null,epoch=0,busy=false,initialized=false;
const CART_KEY="boveda-tcg-cart-v1";
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
const saveCart=()=>{localStorage.setItem(CART_KEY,JSON.stringify([...cart]));updateCartCount()};
function flash(text,error=false){info.textContent=text;info.className="editor-message"+(error?" error":"")}
function available(c){
 const current=stock.get(c);
 return window.BovedaSold?.isSold(c)?{...current,available:false,soldVisual:true}:current;
}
function findCard(id){return records.find(c=>Number(c.id)===Number(id))}
const tcgQuery=c=>market.searchUrl(c);
function updateStats(){
 el("total").textContent=records.length;
 el("copies").textContent=records.reduce((sum,c)=>sum+available(c).quantity,0).toLocaleString("es-CO");
}
function updateCartCount(){el("cartCount").textContent=[...cart.values()].reduce((s,n)=>s+n,0)}
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
 const groups=orderCollections([...new Set(records.map(c=>c.set).filter(Boolean))]);
 const positions=new Map(groups.map((name,i)=>[name,i]));
 return list.sort((a,b)=>(positions.get(a.set)??999)-(positions.get(b.set)??999)||
 (Number(b.year)||0)-(Number(a.year)||0)||
 (Number(a.ordinal)||0)-(Number(b.ordinal)||0));
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
    : [...new Set(records.map(c=>c[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"))
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
  if(langFilter.value&&langFilter.value!==c.language)return false;
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
 el("adminSet").value=editing.set||"";
 el("adminLanguage").value=editing.language||"";
 el("adminNote").value=editing.adminNote||"";
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
el("saveCardInfo").addEventListener("click",()=>{if(editing)doAdmin(()=>meta.save(editing,{set:el("adminSet").value,language:el("adminLanguage").value,validation_note:el("adminNote").value}),"Colección e idioma publicados correctamente.")});
el("resetCardInfo").addEventListener("click",()=>{
 if(editing&&confirm("¿Restaurar colección e idioma originales de esta ficha?"))doAdmin(()=>meta.remove(editing),"Ficha restaurada desde la copia del inventario.");
});
el("saveImageUrl").addEventListener("click",()=>{if(editing)doAdmin(()=>shared.updateImage(editing,el("imageUrl").value),"Imagen guardada para todos los visitantes.")});
el("saveImageFile").addEventListener("click",()=>{if(editing)doAdmin(()=>shared.uploadImage(editing,el("imageUpload").files[0]),"Fotografía subida correctamente.")});
el("removeImageShared").addEventListener("click",()=>{
 if(editing&&confirm("¿Eliminar la imagen personalizada de "+editing.name+"?"))doAdmin(()=>shared.removeImage(editing),"Imagen personalizada eliminada.");
});
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
el("migrateOldImages").addEventListener("click",()=>{void syncManualImages(false).catch(e=>flash(e.message,true))});

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
function listText(){
 const now=new Date();
 const lines=[
 "BÓVEDA TCG — LISTA DE INTERÉS",
 "Fecha: "+now.toLocaleString("es-CO"),
 "Catálogo: https://spenceralejandro10.github.io/Base-de-datos-pokemon/",
 "Consulta de disponibilidad; NO representa pedido pagado ni reserva.",
 "","CARTAS SELECCIONADAS",""
 ];
 let total=0;
 for(const [id,quantity] of cart){
  const c=findCard(id);if(!c)continue;total+=quantity;
  const quote=market.quote(c);
  lines.push(cardCode(c)+" | "+c.name+" | "+c.number+" | "+(c.set||"Sin colección")+" | "+(c.language||"Sin idioma")+" | Referencia por carta: "+market.amount(quote)+" | Unidades solicitadas: "+quantity);
 }
 lines.push("","REFERENCIAS DISTINTAS: "+cart.size,"UNIDADES SOLICITADAS: "+total,"",market.rateText(),"TCGplayer Market Price convertido a COP, sin envío. Estado declarado de la colección: cartas sin jugar, recién sacadas de sobre y protegidas en toploader. El precio final se confirma antes de la compra.");
 return lines.join("\r\n");
}
function drawCart(){
 const host=el("cartItems");host.replaceChildren();
 cleanCart();
 if(!cart.size){
  host.textContent="Todavía no has seleccionado cartas.";
  el("cartSummary").textContent="";
  el("downloadCart").disabled=true;
  el("copyCart").disabled=true;
  return;
 }
 el("downloadCart").disabled=false;el("copyCart").disabled=false;
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
 el("cartSummary").textContent=cart.size+" referencias · "+[...cart.values()].reduce((s,v)=>s+v,0)+" unidades solicitadas";
}
el("cartOpen").addEventListener("click",()=>{drawCart();cartDialog.showModal()});
el("closeCart").addEventListener("click",()=>cartDialog.close());
cartDialog.addEventListener("click",e=>{if(e.target===cartDialog)cartDialog.close()});
el("clearCart").addEventListener("click",()=>{if(!cart.size)return;if(!confirm("¿Vaciar tu lista de interés?"))return;cart.clear();saveCart();drawCart();render()});
el("downloadCart").addEventListener("click",()=>{
 if(!cart.size)return;
 const blob=new Blob(["\uFEFF"+listText()],{type:"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="Boveda-TCG-seleccion.txt";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
});
el("copyCart").addEventListener("click",async()=>{
 if(!cart.size)return;
 try{await navigator.clipboard.writeText(listText());el("copyCart").textContent="Copiado";setTimeout(()=>el("copyCart").textContent="Copiar lista",2500)}
 catch(_){alert("No fue posible copiar. Utiliza el botón de descarga.")}
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
 a.href=market.quote(c).url||market.searchUrl(c);
 a.target="_blank";
 a.rel="noopener noreferrer";
 a.textContent="Ver en TCGplayer";
 a.title="Consultar el precio de esta carta en TCGplayer";
 return a;
}

function editButton(c){
 if(!editingMode)return null;
 const button=document.createElement("button");button.type="button";button.className="image-button";
 button.textContent="Editar carta";button.addEventListener("click",()=>showEditor(c));return button;
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
function galleryCard(c,token) {
 const a=available(c);
 const item=document.createElement("article");
 item.className="item"+(a.soldVisual?" is-marked-sold":"");
 const details=[c.set,c.language].filter(Boolean).join(" · ");
 item.innerHTML='<div class="art"><div class="placeholder"><span class="loader"></span><span>Cargando imagen…</span></div><img hidden loading="lazy" referrerpolicy="no-referrer"><span class="pill">'+esc(cardCode(c))+'</span></div>'+
 (a.soldVisual?'<div class="sold-image-stamp" aria-label="Carta vendida">VENDIDA</div>':'')+
 '<div class="details"><h3>'+esc(c.name)+'</h3><div class="num">'+esc(c.number)+'</div>'+
 (details?'<div class="meta">'+esc(details)+'</div>':'')+
 '<div class="stock-status '+(a.available?"is-available":"is-soldout")+'">'+(a.soldVisual?"Vendida":a.available?"Disponible · "+a.quantity+" ud.":a.override&&a.quantity===0?"Vendida":"No disponible")+'</div>'+
 '<div class="links"></div></div>';
 const actions=item.querySelector(".links");
 actions.before(market.element(c));
 actions.append(tcgLink(c),cartButton(c));
 const admin=editButton(c);if(admin)actions.append(admin);
 const search=quickImageSearchButton(c);if(search)actions.append(search);
 imageFor(c,item.querySelector(".art>img"),item.querySelector(".placeholder"),null,token);
 return item;
}

function tableCard(c,token) {
 const a=available(c);
 const tr=document.createElement("tr");
 if(a.soldVisual)tr.className="is-marked-sold";
 tr.innerHTML='<td class="thumbnail"><div class="mini-art"><img hidden loading="lazy" referrerpolicy="no-referrer"><span>—</span></div></td>'+
 [cardCode(c),c.name,c.number,c.set,c.language,a.quantity,a.soldVisual?"Vendida":a.available?"Disponible":a.override&&a.quantity===0?"Vendida":"No disponible"]
 .map((x,i)=>'<td'+(i===2?' class="num-col"':"")+'>'+esc(x==null||x===""?"—":x)+'</td>').join("")+
 '<td class="table-market"></td><td class="table-action"></td>';
 tr.querySelector(".table-market").append(market.element(c),tcgLink(c));
 tr.querySelector(".table-action").append(cartButton(c));
 const admin=editButton(c);if(admin)tr.querySelector(".table-action").append(admin);
 const search=quickImageSearchButton(c);if(search)tr.querySelector(".table-action").append(search);
 imageFor(c,tr.querySelector(".mini-art img"),tr.querySelector(".mini-art span"),null,token);
 return tr;
}

function render(){
 epoch++;const token=epoch;
 if(el("exchangeRate"))el("exchangeRate").textContent=market.rateText();
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
for(const item of [q,setFilter,langFilter,availability,view])item.addEventListener("input",render);
el("resetFilters").addEventListener("click",()=>{
 q.value="";setFilter.value="";langFilter.value="";availability.value="all";view.value="grid";
 render();window.scrollTo({top:0,behavior:"smooth"});
});
updateCartCount();
adminDisplay();
shared.subscribe(()=>{if(initialized)render()});
meta.listen(()=>{if(initialized)applyMeta()});
stock.listen(()=>{if(initialized){updateStats();cleanCart();render()}});
market.subscribe(()=>{render();if(cartDialog.open)drawCart()});
void market.init();
rebuildPublicCodes();
refreshOptions();updateStats();render();
function refreshPublishedCatalog(){
 return shared.loadCatalog().then(catalog=>{
  // Los IDs están anclados a las cartas, nunca se renumeran por su orden visual.
  if(catalog.length>=base.length)base=catalog;
  return true;
 }).catch(()=>false);
}
Promise.allSettled([shared.init(),meta.fetchOverrides(true),stock.refresh(true),refreshPublishedCatalog()]).then(()=>{
 initialized=true;applyMeta();adminDisplay();
 
});
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")
  Promise.allSettled([shared.loadShared(true),meta.fetchOverrides(true),
    stock.refresh(true),refreshPublishedCatalog()]).then(applyMeta);
});
setInterval(()=>Promise.allSettled([shared.loadShared(true),meta.fetchOverrides(true),
 stock.refresh(true),refreshPublishedCatalog()]).then(applyMeta),90000);
})();
