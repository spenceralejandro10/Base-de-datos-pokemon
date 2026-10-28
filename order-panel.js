/* Visual checklist for received customer orders. No public database writes. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const bridge=window.BovedaOrderBridge;
const market=window.CardPrices,images=window.CardImages,stock=window.CardStock;
const BASE="https://cnivcnexsqobipvqxero.supabase.co";
const APIKEY="sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU";
const ORDER_KEY="boveda-client-order-v1", AUTH_KEY="boveda-sale-owner-session-v1";
const money=value=>Number(value).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});
const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const normNumber=value=>String(value??"").toUpperCase().replace(/\s+/g,"").split("/").map(v=>v.replace(/(^|[A-Z])0+(?=\d)/g,"$1")).join("/");
const keyFor=c=>[normalize(c.name),normNumber(c.number),normalize(c.set),normalize(c.language)].join("|");
const safeInt=(v,defaultValue=0)=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):defaultValue;
const createId=()=>crypto.randomUUID();
const modal=$("orderDialog"),verifyModal=$("orderStockDialog");
let items=[],auth=null,inFlight=false,verificationKey=null,prefillToken="",lastLoad=0;

function notify(message,bad=false){
 const p=$("orderMessage");p.textContent=message;p.classList.toggle("error",bad);
}
function authStatus(message,bad=false){
 const p=$("orderAuthStatus");p.textContent=message;p.classList.toggle("error",bad);
}
function persist(){
 try{localStorage.setItem(ORDER_KEY,JSON.stringify(items))}catch(_){notify("Este navegador no pudo guardar el pedido localmente.",true)}
}
function saveAuth(){try{if(auth)sessionStorage.setItem(AUTH_KEY,JSON.stringify(auth));else sessionStorage.removeItem(AUTH_KEY)}catch(_){}}
function start(){
 try{
  const saved=JSON.parse(localStorage.getItem(ORDER_KEY)||"[]");
  if(Array.isArray(saved)) items=saved.filter(i=>i&&typeof i==="object"&&typeof i.key==="string")
  .map(i=>({...i,quantity:Math.min(100000,safeInt(i.quantity,1)),soldQty:safeInt(i.soldQty),
    removed:!!i.removed,packed:!!i.packed,unitPrice:i.unitPrice==null?null:safeInt(i.unitPrice),
    pendingSale:i.pendingSale||null}));
 }catch(_){items=[]}
 try{const s=JSON.parse(sessionStorage.getItem(AUTH_KEY)||"null");if(s?.access_token&&s?.refresh_token)auth=s}catch(_){}
 readMagicLink();
 refreshAuthUI();
 render();
}
function readMagicLink(){
 const hash=new URLSearchParams(location.hash.replace(/^#/,""));
 if(hash.get("access_token")&&hash.get("refresh_token")){
  auth={access_token:hash.get("access_token"),refresh_token:hash.get("refresh_token"),
   expires_at:Math.floor(Date.now()/1000)+safeInt(hash.get("expires_in"),3600)};
  saveAuth();history.replaceState(null,"",location.pathname+location.search);
 }
}
async function responseJSON(response){
 let obj=null;try{obj=await response.json()}catch(_){}
 if(!response.ok)throw Error(obj?.message||obj?.msg||obj?.error_description||obj?.error||"No se pudo completar la operación.");
 return obj;
}
async function renew(){
 if(!auth)return null;
 if(auth.expires_at&&auth.expires_at>Date.now()/1000+40)return auth;
 try{
  const r=await fetch(BASE+"/auth/v1/token?grant_type=refresh_token",{
   method:"POST",headers:{apikey:APIKEY,"Content-Type":"application/json"},
   body:JSON.stringify({refresh_token:auth.refresh_token})
  });
  const data=await responseJSON(r);
  auth={access_token:data.access_token,refresh_token:data.refresh_token,
   expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
  saveAuth();refreshAuthUI();return auth;
 }catch(_){auth=null;saveAuth();refreshAuthUI();return null}
}
function refreshAuthUI(){
 const signed=!!auth;
 $("orderSignOut").hidden=!signed;
 $("orderSendOtp").disabled=signed;
 $("orderVerifyOtp").disabled=signed;
 if(signed)authStatus("Sesión de ventas iniciada. Los descuentos requieren autorización del propietario.");
}
async function sendCode(){
 const email=$("orderEmail").value.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){authStatus("Escribe el correo autorizado.",true);return}
 $("orderSendOtp").disabled=true;
 try{
  const r=await fetch(BASE+"/auth/v1/otp?redirect_to="+encodeURIComponent(location.origin+location.pathname),{
   method:"POST",headers:{apikey:APIKEY,"Content-Type":"application/json"},
   body:JSON.stringify({email,create_user:false})
  });
  await responseJSON(r);
  authStatus("Revisa el correo. Introduce el código recibido o abre el enlace de acceso en este mismo navegador.");
 }catch(e){authStatus(e.message,true)}
 finally{$("orderSendOtp").disabled=!!auth}
}
async function verifyCode(){
 const email=$("orderEmail").value.trim().toLowerCase(),token=$("orderOtp").value.replace(/\s/g,"");
 if(!email||!token){authStatus("Introduce el correo y el código de verificación.",true);return}
 $("orderVerifyOtp").disabled=true;
 try{
  const r=await fetch(BASE+"/auth/v1/verify",{
   method:"POST",headers:{apikey:APIKEY,"Content-Type":"application/json"},
   body:JSON.stringify({email,token,type:"email"})
  });
  const data=await responseJSON(r);
  if(!data.access_token||!data.refresh_token)throw Error("No se recibió una sesión válida.");
  auth={access_token:data.access_token,refresh_token:data.refresh_token,
   expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
  saveAuth();refreshAuthUI();authStatus("Acceso verificado. Ahora puedes confirmar ventas.");
 }catch(e){authStatus(e.message,true)}
 finally{$("orderVerifyOtp").disabled=!!auth}
}
async function logout(){
 const previous=auth;auth=null;saveAuth();refreshAuthUI();
 $("orderSendOtp").disabled=false;$("orderVerifyOtp").disabled=false;
 authStatus("Sesión cerrada. El pedido sigue guardado en este dispositivo.");
 if(previous?.access_token)try{await fetch(BASE+"/auth/v1/logout",{method:"POST",headers:{apikey:APIKEY,Authorization:"Bearer "+previous.access_token}})}catch(_){}
}
function allCards(){return bridge.cards()}
function exactCard(parts,code){
 const desired={name:parts[1],number:parts[2],set:parts[3],language:parts[4]};
 const all=allCards(),expectedKey=keyFor(desired);
 const matches=all.filter(c=>keyFor(c)===expectedKey);
 const byCode=all.find(c=>bridge.code(c).toUpperCase()===code.toUpperCase());
 if(matches.length===1){
  const card=matches[0];
  return{card,warning:byCode&&byCode.id!==card.id?
    "El código BTCG ha cambiado; se verificó el nombre, número, colección e idioma.":""};
 }
 if(matches.length>1)return{card:null,warning:"Hay dos referencias idénticas; no se puede elegir automáticamente."};
 if(byCode)return{card:null,warning:"El código corresponde ahora a "+byCode.name+" "+byCode.number+
   ". Revisa la lista; no se reemplazó la carta del cliente."};
 return{card:null,warning:"No se encontró una coincidencia exacta en el inventario."};
}
function parseOrder(text){
 const result=[],notes=[];
 const lines=text.split(/\r?\n/);
 for(const raw of lines){
  const line=raw.trim();if(!line||/^CARTAS SELECCIONADAS$/i.test(line))continue;
  const parts=line.split("|").map(t=>t.trim());
  const code=parts[0].match(/BTCG-\d{1,6}/i)?.[0]?.toUpperCase()||"";
  if(!code&&!line.includes("|")){notes.push("Se omitió una línea sin datos de carta: "+line.slice(0,65));continue}
  if(parts.length<5){result.push({key:createId(),source:line,code,name:parts[1]||"Sin identificar",
    number:"",set:"",language:"",cardId:null,unitPrice:null,quantity:1,soldQty:0,packed:false,removed:false,
    warning:"La línea no contiene nombre, número, colección e idioma."});continue}
  const rawPrice=line.match(/Referencia por carta:\s*\$?\s*([\d.,\s\u00a0]+)\s*COP/i)?.[1];
  const price=rawPrice?Number(rawPrice.replace(/[^\d]/g,"")):null;
  const rawQty=line.match(/Unidades solicitadas:\s*(\d+)/i)?.[1];
  const qty=rawQty?Number(rawQty):1;
  if(!Number.isSafeInteger(qty)||qty<1||qty>100000){
   notes.push("Cantidad inválida en "+code+". Revisa el mensaje original.");continue
  }
  const match=exactCard(parts,code);
  const existing=result.find(i=>i.cardId!=null&&match.card&&i.cardId===match.card.id&&
   i.unitPrice===price&&!i.removed);
  if(existing){existing.quantity+=qty;continue}
  result.push({key:createId(),source:line,code,name:parts[1],number:parts[2],
   set:parts[3],language:parts[4],cardId:match.card?.id??null,
   warning:match.warning,unitPrice:Number.isFinite(price)?price:null,quantity:qty,soldQty:0,
   packed:false,removed:false,pendingSale:null});
 }
 return{result,notes};
}
function getCard(entry){return entry.cardId==null?null:allCards().find(c=>c.id===entry.cardId)||null}
function unitPrice(entry){
 if(entry.unitPrice!=null)return entry.unitPrice;
 const card=getCard(entry);
 const q=card?market.quote(card):null;
 return q?.status==="ready"&&Number.isFinite(q.copMin)?Math.round(q.copMin):null;
}
function remaining(entry){return Math.max(0,entry.quantity-entry.soldQty)}
function totalSummary(){
 let pending=0,sold=0,pendingUnits=0,unresolved=0,unpriced=0;
 for(const i of items){
  const unit=unitPrice(i),left=i.removed?0:remaining(i);
  pendingUnits+=left;
  if(!i.cardId&&!i.removed)unresolved++;
  if(unit==null&&left)unpriced+=left;
  if(unit!=null){pending+=unit*left;sold+=unit*i.soldQty;}
 }
 return {pending,sold,pendingUnits,unresolved,unpriced};
}
function node(tag,cls="",textContent=""){
 const n=document.createElement(tag);if(cls)n.className=cls;if(textContent)n.textContent=textContent;return n
}
function button(label,cls,fn){
 const x=node("button",cls,label);x.type="button";x.addEventListener("click",fn);return x
}
function infoText(entry,card){
 const tag=node("div","order-card-code",card?bridge.code(card):entry.code||"Sin coincidencia");
 return tag;
}
function appendImage(card,container){
 const img=node("img","order-card-image");
 img.alt=card.name+" "+card.number;img.loading="lazy";img.referrerPolicy="no-referrer";img.hidden=true;
 const placeholder=node("div","order-image-placeholder","Buscando imagen…");
 container.append(img,placeholder);
 (async()=>{
  try{
   async function tryImages(match){
    for(const src of match?.images||[]){
     if(!img.isConnected)return false;
     const ok=await new Promise(resolve=>{
      const test=new Image();let done=false;
      const timer=setTimeout(()=>finish(false),8000);
      function finish(success){if(done)return;done=true;clearTimeout(timer);resolve(success)}
      test.onload=()=>finish(true);test.onerror=()=>finish(false);
      test.referrerPolicy="no-referrer";test.src=src;
     });
     if(ok&&img.isConnected){img.src=src;img.hidden=false;placeholder.hidden=true;
      if(match.catalog?.editionIsReference)img.title="Imagen de referencia en otro idioma";
      return true}
    }return false
   }
   let match=await images.resolve(card);
   if(await tryImages(match))return;
   if(match.status==="local"||match.status==="shared"){
     match=await images.resolveCatalog(card);
     if(await tryImages(match))return;
   }
   if(placeholder.isConnected)placeholder.textContent="Imagen no disponible";
  }catch(_){if(placeholder.isConnected)placeholder.textContent="Imagen no disponible"}
 })();
}
function stageRank(entry){
 if(entry.cardId==null)return 2;
 if(remaining(entry)===0)return 3;
 if(entry.packed)return 1;
 return 0;
}
function sortItems(list){
 const order=$("orderSort").value;
 return list.sort((a,b)=>{
  if(order!=="original"){const diff=stageRank(a)-stageRank(b);if(diff)return diff}
  if(order==="original")return items.indexOf(a)-items.indexOf(b);
  const ac=getCard(a),bc=getCard(b);
  const group=order==="name"?(ac?.name||a.name):(ac?.set||a.set);
  const other=order==="name"?(bc?.name||b.name):(bc?.set||b.set);
  return group.localeCompare(other,"es",{sensitivity:"base"})||
    (ac?.name||a.name).localeCompare(bc?.name||b.name,"es",{sensitivity:"base"})||
    (ac?.number||a.number).localeCompare(bc?.number||b.number,"es");
 });
}
function cardView(entry){
 const card=getCard(entry),left=remaining(entry);
 const wrapper=node("article","order-card"+(left===0?" is-sold":"")+(entry.packed&&left>0?" is-packed":""));
 const art=node("div","order-card-art");
 if(card)appendImage(card,art);
 else art.append(node("div","order-image-placeholder","Por identificar"));
 wrapper.append(art);
 const body=node("div","order-card-body");
 body.append(infoText(entry,card),node("h3","",card?.name||entry.name),
   node("p","order-card-identity",(card?.number||entry.number)+" · "+(card?.set||entry.set)+" · "+(card?.language||entry.language)));
 if(entry.warning)body.append(node("p","order-warning",entry.warning));
 const unit=unitPrice(entry);
 const prices=node("div","order-card-prices");
 prices.append(node("strong","",unit==null?"Precio por confirmar":money(unit)+" / unidad"));
 prices.append(node("span","",unit==null?"Total sin precio":money(unit*left)+" pendiente"));
 if(entry.soldQty)prices.append(node("span","",money(unit==null?0:unit*entry.soldQty)+" vendido"));
 body.append(prices);
 const state=left===0?"Vendida":entry.packed?"Empacada":"Por buscar";
 body.append(node("div","order-card-state",state+" · "+entry.soldQty+" vendida(s) / "+entry.quantity+" solicitada(s)"));
 const available=card?bridge.availability(card):null;
 if(available)body.append(node("p","order-stock-line","En la página: "+available.quantity+" ud. "+
  (available.available?"disponibles":"no disponibles")));
 const actions=node("div","order-card-buttons");
 if(left>0){
  actions.append(button(entry.packed?"Volver a pendiente":"Empacada", "order-muted",()=>{
    entry.packed=!entry.packed;persist();render();
  }));
  actions.append(button("Vendida · descontar 1","order-sell",()=>{void sellOne(entry)}));
 }
 actions.append(button("−","order-small",()=>{if(entry.quantity>Math.max(1,entry.soldQty)){
  entry.quantity--;persist();render()}},));
 actions.append(button("+","order-small",()=>{if(entry.quantity<100000){entry.quantity++;persist();render()}}));
 actions.append(button("Quitar","order-remove",()=>{
  const msg=entry.soldQty?
    "Esta carta ya tiene "+entry.soldQty+" venta(s) confirmadas. Quitarla de la lista NO devolverá esas unidades al inventario. ¿Ocultar del pedido?":
    "¿Quitar esta carta del pedido? No se cambiarán existencias.";
  if(confirm(msg)){entry.removed=true;persist();render()}
 }));
 if(card&&left>0&&available)actions.append(button("Revisar stock","order-stock-btn",()=>openStockCheck(entry)));
 body.append(actions);
 if(!card)body.append(node("p","order-warning","No se pueden registrar ventas sin una coincidencia exacta."));
 wrapper.append(body);return wrapper;
}
function render(){
 const workspace=$("orderWorkspace");
 workspace.hidden=!items.length;
 if(!items.length)return;
 const totals=totalSummary();
 $("orderPendingTotal").textContent=money(totals.pending)+(totals.unpriced?" + pendientes sin precio":"");
 $("orderSoldTotal").textContent=money(totals.sold);
 $("orderPendingCount").textContent=String(totals.pendingUnits);
 $("orderNotFoundCount").textContent=String(totals.unresolved);
 const filter=$("orderFilter").value;
 const showing=items.filter(x=>!x.removed).filter(x=>
  filter==="all"||(filter==="pending"&&remaining(x)>0&&!x.packed)||
  (filter==="packed"&&remaining(x)>0&&x.packed)||
  (filter==="sold"&&x.soldQty>0));
 const container=$("orderCards");container.replaceChildren();
 if(!showing.length)container.append(node("p","order-empty","No hay cartas en esta vista."));
 for(const entry of sortItems(showing))container.append(cardView(entry));
 const gone=items.filter(i=>i.removed);
 $("orderRemovedPanel").hidden=!gone.length;
 $("orderRemovedCount").textContent=gone.length;
 const removed=$("orderRemovedCards");removed.replaceChildren();
 gone.forEach(i=>{
  const el=node("div","order-removed-row",(getCard(i)?.name||i.name)+" · "+
   i.number+" · "+i.quantity+" unidad(es)");
  el.append(button("Restaurar","order-muted",()=>{i.removed=false;persist();render()}));
  removed.append(el);
 });
}
function importList(){
 const raw=$("orderPaste").value;
 const parsed=parseOrder(raw);
 if(!parsed.result.length){notify("No encontré líneas de cartas. Pega el mensaje completo del cliente.",true);return}
 if(items.length&&!confirm("¿Reemplazar el pedido actual por la nueva lista? Las ventas ya confirmadas no se revierten."))return;
 items=parsed.result;persist();render();
 const ok=items.filter(i=>i.cardId!=null).length;
 const missing=items.length-ok;
 notify(ok+" referencias localizadas, "+missing+" por revisar. "+items.reduce((n,i)=>n+i.quantity,0)+" unidades solicitadas."+
  (parsed.notes.length?" "+parsed.notes.join(" "):""),!!missing||parsed.notes.length>0);
}
function openStockCheck(entry){
 const card=getCard(entry);if(!card){notify("La carta no tiene una referencia confirmada.",true);return}
 verificationKey=entry.key;
 $("orderStockTitle").textContent="Verificar "+card.name;
 const quantity=bridge.availability(card).quantity;
 $("orderStockText").textContent="El inventario muestra "+quantity+" unidad(es) de "+card.name+
  " ("+card.number+"). Confirma cuántas hay físicamente antes de descontar una venta.";
 $("orderRealStock").value=String(Math.max(1,quantity));
 $("orderStockError").textContent="";
 verifyModal.showModal();
}
async function sellOne(entry,realStock=null){
 const card=getCard(entry);
 if(!card){notify("No se puede vender una carta sin verificar su edición.",true);return}
 if(entry.removed||remaining(entry)<1||inFlight)return;
 if(!auth){$("orderAuth").open=true;authStatus("Inicia sesión como propietario para confirmar la venta.",true);
  notify("El pedido está listo, pero las ventas requieren autorización del propietario.",true);return}
 if(!await renew()){notify("Tu sesión caducó. Identifícate de nuevo para registrar ventas.",true);
  $("orderAuth").open=true;return}
 inFlight=true;
 try{
  await stock.refresh(true);
  const actual=bridge.availability(card).quantity;
  if(actual<=1&&realStock===null){inFlight=false;openStockCheck(entry);return}
  if(realStock!==null&&(!Number.isInteger(realStock)||realStock<1||realStock>100000)){
   throw Error("Introduce el número real de unidades disponibles, incluida la que vas a vender.");
  }
  // A stable transaction UUID prevents double deduction after a network timeout.
  const tx=entry.pendingSale||{saleId:createId(),cardId:card.id,count:1,expected:actual,realCount:realStock};
  // Preserve the retry UUID, but attach a newly verified physical stock count.
  if(realStock!==null&&tx.realCount==null)tx.realCount=realStock;
  entry.pendingSale=tx;persist();
  notify("Registrando venta y descontando una unidad…");
  const resp=await fetch(BASE+"/rest/v1/rpc/pokemon_register_sale",{
   method:"POST",
   headers:{apikey:APIKEY,Authorization:"Bearer "+auth.access_token,
    "Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({p_sale_id:tx.saleId,p_card_id:tx.cardId,p_count:tx.count,
    p_expected:tx.expected,p_real_count:tx.realCount})
  });
  const data=await responseJSON(resp);
  if(!Array.isArray(data)||data.length!==1)throw Error("La venta no devolvió una confirmación verificable.");
  entry.soldQty=Math.min(entry.quantity,entry.soldQty+1);
  entry.pendingSale=null;
  entry.packed=entry.soldQty<entry.quantity&&entry.packed;
  persist();
  await stock.refresh(true);
  notify("Venta confirmada: "+card.name+" · quedan "+data[0].quantity_after+
    " unidad(es) disponibles en Bóveda TCG.");
  if(verifyModal.open)verifyModal.close();
  render();
 }catch(e){
  notify("No se confirmó el descuento: "+e.message+" Si reintentas se usa el mismo identificador.",true);
  if(verifyModal.open)$("orderStockError").textContent=e.message;
  if(!auth&&verifyModal.open)verifyModal.close();
  // Retain pendingSale for safe replay. If stock changed independently,
  // a new request can be started after reviewing the correct stock.
  if(/Las existencias cambiaron/i.test(e.message)||
     /Comprueba las unidades físicas/i.test(e.message)||
     /Solo el propietario puede registrar ventas/i.test(e.message)){
    entry.pendingSale=null;persist();
  }
 }finally{inFlight=false}
}
function confirmStockSale(){
 const entry=items.find(i=>i.key===verificationKey);
 const value=Number($("orderRealStock").value);
 if(!entry){$("orderStockError").textContent="No encuentro la carta en el pedido.";return}
 if(!Number.isInteger(value)||value<1||value>100000){
  $("orderStockError").textContent="Introduce la cantidad real (mínimo 1).";return
 }
 void sellOne(entry,value);
}
$("orderOpen").addEventListener("click",()=>{
 modal.showModal();render();
});
$("orderClose").addEventListener("click",()=>modal.close());
modal.addEventListener("click",e=>{if(e.target===modal)modal.close()});
$("orderImport").addEventListener("click",importList);
$("orderClear").addEventListener("click",()=>{
 if(items.length&&!confirm("¿Comenzar un pedido nuevo? Las ventas ya confirmadas NO se revierten en el inventario."))return;
 items=[];$("orderPaste").value="";persist();render();notify("Pedido nuevo listo.");
});
$("orderSort").addEventListener("change",render);
$("orderFilter").addEventListener("change",render);
$("orderStockClose").addEventListener("click",()=>verifyModal.close());
$("orderCancelStockSale").addEventListener("click",()=>verifyModal.close());
$("orderConfirmStockSale").addEventListener("click",confirmStockSale);
$("orderSendOtp").addEventListener("click",()=>{void sendCode()});
$("orderVerifyOtp").addEventListener("click",()=>{void verifyCode()});
$("orderSignOut").addEventListener("click",()=>{void logout()});
if(bridge&&market&&images&&stock)start();
else $("orderOpen").disabled=true;
window.BovedaOrderParser=Object.freeze({parse:parseOrder,normalize,keyFor});
})();