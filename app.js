(function(){
"use strict";
const base=window.CARDS||[];
const shared=window.SharedImages,meta=window.CatalogOverrides,stock=window.CardStock,market=window.CardPrices;
const el=id=>document.getElementById(id);
const q=el("q"),setFilter=el("set"),langFilter=el("lang"),availability=el("availability"),view=el("view"),results=el("results");
const info=el("editorMessage"),editor=el("editorDialog"),cartDialog=el("cartDialog");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cardCode=c=>"BTCG-"+String(c.id).padStart(4,"0");
const OWNER="spenceralejandro10@gmail.com";
const adminMode=new URLSearchParams(location.search).get("admin")==="1";
const owner=()=>{const user=shared.getSession()?.user;return shared.isLoggedIn()&&String(user?.email||"").toLowerCase()===OWNER&&!!user?.email_confirmed_at};
let records=base.map(x=>({...x})),editing=null,epoch=0,busy=false,initialized=false;
const CART_KEY="boveda-tcg-cart-v1";
let cart=new Map();
try {cart=new Map(JSON.parse(localStorage.getItem(CART_KEY)||"[]").filter(x=>Array.isArray(x)&&x.length===2&&Number.isInteger(x[0])&&Number.isInteger(x[1])&&x[1]>0))}catch(_){}
const saveCart=()=>{localStorage.setItem(CART_KEY,JSON.stringify([...cart]));updateCartCount()};
function flash(text,error=false){info.textContent=text;info.className="editor-message"+(error?" error":"")}
function available(c){return stock.get(c)}
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
function applyMeta(){
 records=meta.apply(base);
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
  [...new Set(records.map(c=>c[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")).forEach(value=>{
   const opt=document.createElement("option");opt.value=value;opt.textContent=value;control.append(opt);
  });
  control.value=[...control.options].some(x=>x.value===old)?old:"";
 }
}
function filtering(){
 const search=q.value.trim().toLocaleLowerCase("es");
 return records.filter(c=>{
  const a=available(c);
  if(setFilter.value&&setFilter.value!==c.set)return false;
  if(langFilter.value&&langFilter.value!==c.language)return false;
  if(availability.value==="available"&&!a.available)return false;
  if(availability.value==="soldout"&&a.available)return false;
  return !search||[cardCode(c),c.name,c.number,c.set,c.language,c.year,c.ordinal].join(" ").toLocaleLowerCase("es").includes(search);
 });
}
function adminDisplay(){
 const access=el("ownerAccess");
 access.hidden=!(adminMode||owner());
 access.textContent=owner()?"Panel de administración":"Acceso del administrador";
 el("loginPanel").hidden=owner();
 el("editPanel").hidden=!owner();
 el("logoutUnauthorized").hidden=!shared.isLoggedIn()||owner();
 el("adminCardFields").hidden=!owner()||!editing;
 el("editingCard").textContent=editing?"Carta "+cardCode(editing)+" · "+editing.name+" · "+editing.number:"Selecciona «Editar» en una carta para modificar su ficha.";
 el("editorOwner").textContent=owner()?"Cuenta autorizada: "+(shared.getSession()?.user?.email||""):"";
 el("editorTitle").textContent=editing?"Administrar "+editing.name:"Administración de Bóveda TCG";
}
function showEditor(card){
 if(!owner()&&!adminMode)return;
 editing=card||null;flash("");
 if(shared.isLoggedIn()&&!owner())flash("Esta cuenta no es administradora. Cierra sesión y utiliza el correo autorizado.",true);
 adminDisplay();
 if(editing&&owner()){
  const a=available(editing);
  el("adminQuantity").value=String(a.quantity);
  el("adminListed").checked=a.listed;
  el("adminSet").value=editing.set||"";
  el("adminLanguage").value=editing.language||"";
  el("adminNote").value=editing.adminNote||"";
  el("imageUrl").value=shared.getShared(editing)||"";
  el("imageUpload").value="";
 }
 if(!editor.open)editor.showModal();
}
async function doAdmin(fn,message){
 if(busy)return;
 if(!owner()){flash("Sin autorización para modificar la bóveda.",true);return}
 busy=true;flash("Guardando cambios…");
 try{
  await fn();
  await Promise.all([stock.refresh(true),meta.fetchOverrides(true),shared.loadShared(true)]);
  applyMeta();
  if(editing)showEditor(findCard(editing.id));
  flash(message);
 }catch(e){flash(e.message||"No se pudo guardar el cambio.",true)}
 finally{busy=false}
}
el("ownerAccess").addEventListener("click",()=>showEditor());
el("closeEditor").addEventListener("click",()=>editor.close());
editor.addEventListener("click",e=>{if(e.target===editor)editor.close()});
el("sendOwnerLink").addEventListener("click",async()=>{
 flash("Enviando acceso…");
 try{await shared.requestLogin(el("ownerEmail").value);flash("Consulta tu correo. Entra con el enlace o usa el código que recibas.")}
 catch(e){flash(e.message,true)}
});
el("verifyOwnerCode").addEventListener("click",async()=>{
 flash("Verificando acceso…");
 try{
  await shared.verifyCode(el("ownerEmail").value,el("ownerCode").value);
  adminDisplay();
  if(!owner())flash("La cuenta autenticada no tiene privilegios de administrador.",true);
  else flash("Acceso administrativo confirmado. Tus cambios serán visibles para todos.");
  render();
 }catch(e){flash(e.message,true)}
});
for(const id of ["logoutEditor","logoutUnauthorized"]){
 el(id).addEventListener("click",async()=>{
  try{await shared.logout();adminDisplay();render();flash("Sesión cerrada.")}
  catch(e){flash(e.message,true)}
 });
}
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
el("migrateOldImages").addEventListener("click",()=>{
 if(!owner())return;
 const list=base.filter(c=>/^https:\/\//.test(localStorage.getItem("pokemon-image-"+c.id)||"")&&!shared.getShared(c));
 if(!list.length){flash("No hay imágenes antiguas pendientes.");return}
 if(!confirm("¿Compartir "+list.length+" imágenes antiguas guardadas en este navegador?"))return;
 doAdmin(async()=>{
  let failed=0;
  for(const c of list){
   try{await shared.updateImage(c,localStorage.getItem("pokemon-image-"+c.id));localStorage.removeItem("pokemon-image-"+c.id)}
   catch(_){failed++}
  }
  if(failed)throw Error(failed+" imágenes no se pudieron sincronizar; las demás están guardadas.");
 },"Imágenes antiguas sincronizadas.");
});

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
  lines.push(cardCode(c)+" | "+c.name+" | "+c.number+" | "+(c.set||"Sin colección")+" | "+(c.language||"Sin idioma")+" | Unidades solicitadas: "+quantity);
 }
 lines.push("","REFERENCIAS DISTINTAS: "+cart.size,"UNIDADES SOLICITADAS: "+total,"","Los precios de TCGplayer son de referencia y deben confirmarse; no son el precio acordado de venta.");
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
 return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=url});
}
async function imageFor(c,img,placeholder,status,token){
 try{
  const match=await window.CardImages.resolve(c);
  if(token!==epoch||!img.isConnected)return;
  for(const url of match.images||[]){
   if(await loadImage(url)){
    if(token!==epoch||!img.isConnected)return;
    img.src=url;img.alt=c.name+" · "+c.number;img.hidden=false;
    if(placeholder)placeholder.hidden=true;
    if(status)status.textContent=match.status==="shared"?"Imagen de la bóveda":match.status==="local"?"Imagen local pendiente de sincronizar":"Imagen de catálogo";
    return;
   }
  }
  if(status)status.textContent=match.reason||"Imagen no disponible";
  if(placeholder?.classList?.contains("placeholder"))placeholder.textContent="Imagen pendiente";
 }catch(_){if(status)status.textContent="Imagen no disponible";}
}
async function showPrice(c,container,token){
 try{
  const prices=await market.resolve(c);
  if(token!==epoch||!container.isConnected)return;
  container.replaceChildren();
  if(!prices.statuses?.length){
   const text=document.createElement("span");text.className="no-price";text.textContent="Sin precio de referencia.";
   container.append(text);
  }else{
   const sorted=[...prices.statuses].sort((a,b)=>a.price-b.price);
   for(const p of sorted){
    const line=document.createElement("div");line.className="price-line";
    const label=document.createElement("span");label.textContent=p.variant;
    const value=document.createElement("b");value.textContent=market.display(p);
    line.append(label,value);container.append(line);
   }
   const withDate=sorted.find(x=>x.updated);
   if(withDate){const small=document.createElement("small");small.textContent="Fuente actualizada: "+withDate.updated;container.append(small)}
   if(prices.reference){const note=document.createElement("small");note.textContent="Referencia en inglés; la edición de tu carta puede valer distinto.";container.append(note)}
  }
  const link=document.createElement("a");link.className="tcg-link";
  link.href=prices.url||tcgQuery(c);link.target="_blank";link.rel="noopener noreferrer";
  link.textContent=prices.statuses?.some(x=>x.exactLink)?"Ver carta en TCGplayer":"Buscar en TCGplayer";
  container.append(link);
 }catch(_){
  container.replaceChildren();
  const a=document.createElement("a");a.href=tcgQuery(c);a.target="_blank";a.rel="noopener noreferrer";a.textContent="Consultar en TCGplayer";
  container.append(a);
 }
}
function editButton(c){
 if(!owner())return null;
 const button=document.createElement("button");button.type="button";button.className="image-button";
 button.textContent="Editar carta";button.addEventListener("click",()=>showEditor(c));return button;
}
function cartButton(c){
 const a=available(c);
 const button=document.createElement("button");button.type="button";
 button.className="add-cart";
 button.textContent=a.available?(cart.get(c.id)?"Agregar otra · "+cart.get(c.id):"Agregar a mi selección"):"No disponible";
 button.disabled=!a.available||(cart.get(c.id)||0)>=a.quantity;
 button.addEventListener("click",()=>{addToCart(c);render()});
 return button;
}
function galleryCard(c,token){
 const a=available(c);
 const item=document.createElement("article");item.className="item";
 item.innerHTML='<div class="art"><div class="placeholder"><span class="loader"></span><span>Buscando carta…</span></div><img hidden loading="lazy"><span class="pill">'+esc(cardCode(c))+'</span></div>'+
 '<div class="details"><h3>'+esc(c.name)+'</h3><div class="num">'+esc(c.number)+'</div><div class="meta">'+esc(c.set||"Colección por confirmar")+' · '+esc(c.language||"Idioma por confirmar")+'</div>'+
 '<div class="stock-status '+(a.available?"is-available":"is-soldout")+'">'+(a.available?"Disponible · "+a.quantity+" ud.":"No disponible")+'</div>'+
 '<div class="image-status">Buscando imagen…</div><div class="price-section"><div class="price-title">Referencia TCGplayer · USD</div><div class="pricing">Consultando mercado…</div></div><div class="links"></div></div>';
 item.querySelector(".links").append(cartButton(c));
 const admin=editButton(c);if(admin)item.querySelector(".links").append(admin);
 imageFor(c,item.querySelector(".art>img"),item.querySelector(".placeholder"),item.querySelector(".image-status"),token);
 showPrice(c,item.querySelector(".pricing"),token);
 return item;
}
function tableCard(c,token){
 const a=available(c);const tr=document.createElement("tr");
 tr.innerHTML='<td class="thumbnail"><div class="mini-art"><img hidden loading="lazy"><span>—</span></div></td>'+
 [cardCode(c),c.name,c.number,c.set,c.language,a.quantity,a.available?"Disponible":"No disponible"].map((x,i)=>'<td'+(i===2?' class="num-col"':"")+'>'+esc(x)+'</td>').join("")+
 '<td class="table-market"></td><td class="table-action"></td>';
 const admin=editButton(c);tr.querySelector(".table-action").append(cartButton(c));if(admin)tr.querySelector(".table-action").append(admin);
 imageFor(c,tr.querySelector(".mini-art img"),tr.querySelector(".mini-art span"),null,token);
 showPrice(c,tr.querySelector(".table-market"),token);
 return tr;
}
function render(){
 epoch++;const token=epoch;
 const arr=filtering();
 el("shown").textContent=arr.length;
 results.replaceChildren();
 results.className=view.value==="table"?"table-container":"grid";
 if(!arr.length){const none=document.createElement("div");none.className="no-results";none.textContent="No encontramos cartas con esos filtros. Prueba «Limpiar filtros».";results.append(none);return}
 if(view.value==="table"){
  const scroller=document.createElement("div");scroller.className="table-scroll";
  const table=document.createElement("table");table.className="data-table";
  table.innerHTML="<thead><tr>"+["Imagen","ID","Carta","Número","Colección","Idioma","Unidades","Estado","TCGplayer USD","Interés"].map(x=>"<th>"+x+"</th>").join("")+"</tr></thead>";
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
shared.subscribe(()=>{adminDisplay();if(initialized)render()});
meta.listen(()=>{if(initialized)applyMeta()});
stock.listen(()=>{if(initialized){updateStats();cleanCart();render()}});
refreshOptions();updateStats();render();
Promise.allSettled([shared.init(),meta.fetchOverrides(true),stock.refresh(true)]).then(()=>{
 initialized=true;applyMeta();adminDisplay();
});
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")Promise.allSettled([shared.loadShared(true),meta.fetchOverrides(true),stock.refresh(true)]).then(applyMeta);
});
setInterval(()=>Promise.allSettled([shared.loadShared(true),meta.fetchOverrides(true),stock.refresh(true)]).then(applyMeta),90000);
})();