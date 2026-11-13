/*
 * Imágenes compartidas de Bóveda TCG.
 * Sin usuarios ni contraseñas: la edición es pública por petición del propietario.
 * La tabla central pokemon_catalog es de solo lectura.
 */
(function(){
"use strict";
const URL_BASE="https://cnivcnexsqobipvqxero.supabase.co";
const KEY="sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU";
const TABLE="pokemon_image_overrides";
const BUCKET="pokemon-gallery-overrides";
const SESSION_KEY="pokemon-gallery-admin-session";
let adminSession=null;
try {adminSession=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null")}catch(_){}
function signedIn(){return Boolean(adminSession?.access_token && adminSession?.refresh_token)}
function saveSession(data){
 const userId=String(data?.user?.id||adminSession?.user_id||"");
 if(!data?.access_token||!data?.refresh_token||!userId)throw Error("Supabase no devolvió una sesión válida.");
 adminSession={access_token:data.access_token,refresh_token:data.refresh_token,
  expires_at:Date.now()+Math.max(60,Number(data.expires_in)||3600)*1000,user_id:userId};
 sessionStorage.setItem(SESSION_KEY,JSON.stringify(adminSession));
 return adminSession;
}
async function signIn(email,password){
 const address=String(email||"").trim();
 if(!address||!password)throw Error("Escribe el correo y la contraseña del administrador.");
 const res=await fetch(URL_BASE+"/auth/v1/token?grant_type=password",{
  method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},
  body:JSON.stringify({email:address,password:String(password)})
 });
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error("No se pudo iniciar sesión. Comprueba el correo y la contraseña del administrador.");
 return saveSession(data);
}
async function authorize(){
 if(!signedIn())throw Error("Para guardar fotos compartidas, inicia sesión como administrador en este editor.");
 if(Date.now() < Number(adminSession.expires_at)-60000)return adminSession;
 const res=await fetch(URL_BASE+"/auth/v1/token?grant_type=refresh_token",{
  method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},
  body:JSON.stringify({refresh_token:adminSession.refresh_token})
 });
 const data=await res.json().catch(()=>({}));
 if(!res.ok){signOut();throw Error("Sesión vencida. Inicia sesión de nuevo para guardar imágenes.")}
 return saveSession(data);
}
function signOut(){adminSession=null;sessionStorage.removeItem(SESSION_KEY)}
function authorizedHeaders(session){return {apikey:KEY,Authorization:"Bearer "+session.access_token}}

let rows=new Map(),imagesById=new Map(),lastError="",lastLoaded=0;
const watchers=new Set();
  function imageKey(card) {
    const clean = text => String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    // La imagen mantiene su identidad aunque el administrador cambie idioma o colección.
    const original = (window.CARDS || []).find(item => Number(item.id) === Number(card.id)) || card;
    return [original.id, clean(original.name), clean(original.number), clean(original.set), clean(original.language)].join("|");
  }
  function updateWatchers() {
    for (const callback of watchers) {
      try { callback(); } catch (_) {}
    }
  }
  async function loadShared(force = false) {
    if (!force && Date.now() - lastLoaded < 25000) return rows;
    const response = await fetch(URL_BASE + "/rest/v1/" + TABLE + "?select=card_key,image_url,updated_at&order=updated_at.desc", {
      headers: { apikey: KEY, Accept: "application/json" },
      cache: "no-store",signal:AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      lastError = "No se puede consultar el catálogo compartido (HTTP " + response.status + ").";
      updateWatchers();
      return rows;
    }
    const json = await response.json();
    const valid = json.filter(x => x.card_key && x.image_url);
    rows = new Map(valid.map(x => [x.card_key, x.image_url]));
    // También identificar la foto por ID inmutable: una corrección del Excel
    // (colección, nombre o idioma) nunca debe hacer desaparecer la imagen manual.
    imagesById = new Map();
    for (const item of valid) {
      const cardId = Number(String(item.card_key).split("|")[0]);
      if (Number.isInteger(cardId) && !imagesById.has(cardId)) {
        imagesById.set(cardId, item.image_url);
      }
    }
    lastLoaded = Date.now();
    lastError = "";
    updateWatchers();
    return rows;
  }
  function getShared(card) {
    const id=Number(card.id);
    // BTCG-0054 era un Alakazam duplicado; su foto anterior corresponde a BTCG-0037.
    return rows.get(imageKey(card)) || imagesById.get(id) ||
      (id===37 ? imagesById.get(54) : null) || null;
  }
  // Catálogo central: lectura pública en Supabase; cards.js sigue como respaldo sin conexión.
  async function loadCatalog() {
    const url = URL_BASE + "/rest/v1/pokemon_catalog?select=id,ordinal,name,card_number,set_name,release_year,language,quantity,language_quantities&order=id.asc";
    const response = await fetch(url, {
      headers: { apikey: KEY, Accept: "application/json" },
      cache: "no-store",signal:AbortSignal.timeout(15000)
    });
    if (!response.ok) throw Error("No se pudo consultar la base de datos del catálogo.");
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) throw Error("El catálogo central no tiene registros.");
    const cards = data.map(row => {
      // El desglose persistido es la fuente de verdad de las cartas multilingües.
      // Al recargar la ficha, no volver a la cantidad del Excel antiguo.
      const raw = row.language_quantities;
      const entries = raw && typeof raw === "object" && !Array.isArray(raw)
        ? Object.entries(raw).filter(([name,qty]) =>
            name.trim() && Number.isSafeInteger(Number(qty)) && Number(qty) > 0)
        : [];
      const preference = name => name === "Inglés" ? 0 : name === "Español" ? 1 : 2;
      entries.sort((a,b)=>preference(a[0])-preference(b[0]) || a[0].localeCompare(b[0],"es"));
      const distribution = entries.length ? Object.fromEntries(entries) : null;
      const total = entries.reduce((n,[,qty])=>n+Number(qty),0);
      return {
        id: Number(row.id),
        ordinal: String(row.ordinal ?? ""),
        name: String(row.name ?? ""),
        number: String(row.card_number ?? ""),
        set: String(row.set_name ?? ""),
        year: String(row.release_year ?? ""),
        language: distribution ? entries.map(([name])=>name).join(" / ") : String(row.language ?? ""),
        quantity: distribution ? total : Number(row.quantity),
        ...(distribution ? {languageQuantities: distribution} : {})
      };
    });
    if (cards.some(c => !Number.isInteger(c.id) || c.id < 1 || !c.name ||
      !Number.isInteger(c.quantity) || c.quantity < 0) ||
      new Set(cards.map(c => c.id)).size !== cards.length) {
      throw Error("El catálogo central contiene registros no válidos.");
    }
    return cards;
  }

async function init(){await loadShared(true)}
async function updateImage(card,imageUrl){
 const session=await authorize();
 const url=String(imageUrl||"").trim();
 let parsed;
 try{parsed=new URL(url)}catch(_){throw Error("Introduce una URL HTTPS válida.")}
 if(parsed.protocol!=="https:"||url.length>2048)throw Error("La imagen debe usar HTTPS y una URL válida.");
 const payload={card_key:imageKey(card),image_url:url,image_source:"manual",updated_by:session.user_id,updated_at:new Date().toISOString()};
 const response=await fetch(URL_BASE+"/rest/v1/"+TABLE+"?on_conflict=card_key",{
  method:"POST",headers:{...authorizedHeaders(session),"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=representation"},
  body:JSON.stringify(payload)
 });
 if(!response.ok){const d=await response.json().catch(()=>({}));throw Error(d.message||"No se pudo guardar la imagen compartida.")}
 rows.set(payload.card_key,url);imagesById.set(Number(card.id),url);
 updateWatchers();
 return url;
}
// Solo añade fotos oficiales verificadas; nunca sustituye una foto guardada a mano.
async function saveCatalogImage(card,imageUrl){
  if(getShared(card)) return false;
  const session=await authorize();
  const url=String(imageUrl||"").trim();
  if(!/^https:\/\/(?:assets\.tcgdex\.net|images\.pokemontcg\.io)\//i.test(url) || url.length>2048){
    throw Error("La imagen automática no procede de un catálogo autorizado.");
  }
  const payload={
    card_key:imageKey(card), image_url:url, image_source:"tcgdex-auto",
    updated_by:session.user_id, updated_at:new Date().toISOString()
  };
  const response=await fetch(URL_BASE+"/rest/v1/"+TABLE+"?on_conflict=card_key",{
    method:"POST",
    headers:{...authorizedHeaders(session),"Content-Type":"application/json",
      Prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify(payload)
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>({}));
    throw Error(detail.message||"No se pudo guardar la foto automática.");
  }
  // La lectura de confirmación se realiza al terminar el lote; sin repintar
  // todas las cartas repetidamente durante cada subida.
  rows.set(payload.card_key,url);
  imagesById.set(Number(card.id),url);
  return true;
}

async function removeImage(card){
 const session=await authorize();
 const id=Number(card.id),primary=imageKey(card);
 const keys=[...rows.keys()].filter(key=>key===primary||Number(key.split("|")[0])===id);
 if(id===37&&imagesById.has(54))keys.push(...[...rows.keys()].filter(key=>Number(key.split("|")[0])===54));
 for(const key of new Set(keys)){
  const response=await fetch(URL_BASE+"/rest/v1/"+TABLE+"?card_key=eq."+encodeURIComponent(key),{
   method:"DELETE",headers:authorizedHeaders(session)
  });
  if(!response.ok)throw Error("No se pudo quitar la imagen compartida.");
  rows.delete(key);
 }
 imagesById.delete(id);
 if(id===37)imagesById.delete(54);
 try{localStorage.removeItem("pokemon-image-"+id)}catch(_){}
 updateWatchers();
}
async function uploadImage(card,file){
 const session=await authorize();
 if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Selecciona una fotografía JPG, PNG o WebP.");
 if(file.size>6291456)throw Error("La imagen supera el máximo de 6 MB.");
 const name=crypto.randomUUID()+"."+(file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg");
 const path="cards/"+name;
 const res=await fetch(URL_BASE+"/storage/v1/object/"+BUCKET+"/"+path,{
  method:"POST",headers:{...authorizedHeaders(session),"Content-Type":file.type,"cache-control":"3600","x-upsert":"false"},
  body:file
 });
 if(!res.ok){const d=await res.json().catch(()=>({}));throw Error(d.message||"No se pudo subir la fotografía.")}
 const url=URL_BASE+"/storage/v1/object/public/"+BUCKET+"/"+path;
 await updateImage(card,url);
 return url;
}
function subscribe(callback){watchers.add(callback);return()=>watchers.delete(callback)}
window.SharedImages={init,loadShared,loadCatalog,getShared,imageKey,updateImage,saveCatalogImage,removeImage,uploadImage,signIn,signOut,signedIn,subscribe,getError:()=>lastError};
})();