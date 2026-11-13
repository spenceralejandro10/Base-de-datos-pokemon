/* Fresh, dated market snapshots. Never writes inventory or photographs. */
(function () {
  "use strict";
  const core = window.BovedaPricingCore;
  const CACHE_KEY = "boveda-market-v7";
  const REMOTE = "https://raw.githubusercontent.com/spenceralejandro10/Base-de-datos-pokemon/main/market-snapshot.json";
  const listeners = new Set();
  let snapshot = {schemaVersion:1,groups:{},collectr:{cards:{}}}, fx = null;
  let inFlight = null, checkedAt = 0, loading = false, lastError = "";
  const formatCOP = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n) + " COP";
  const formatUSD = n => "US$" + n.toFixed(2);
  const date = s => new Date(s).toLocaleString("es-CO",{timeZone:"America/Bogota",dateStyle:"short",timeStyle:"short"});
  function accept(data) {
    if (data?.schemaVersion !== 1 || !Number.isFinite(Date.parse(data.generatedAt)) ||
      !data.groups || Array.isArray(data.groups) || typeof data.groups !== "object") return false;
    for (const [key,group] of Object.entries(data.groups)) {
      if (!/^\d+-\d+$/.test(key) || !Array.isArray(group?.products) || !Number.isFinite(Date.parse(group.updatedAt))) return false;
      if (group.products.some(p=>!Number.isSafeInteger(p?.id)||p.id<1||typeof p.name!=="string"||
        typeof p.number!=="string"||!Array.isArray(p.prices)||p.prices.some(v=>!core.positive(v?.usd)||typeof v.finish!=="string"))) return false;
    }
    return true;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (accept(saved?.snapshot)) {snapshot=saved.snapshot;fx=saved.fx || snapshot.fx || null;}
  } catch (_) {}
  function save() {try {localStorage.setItem(CACHE_KEY,JSON.stringify({snapshot,fx}));} catch (_) {}}
  function emit() {for (const fn of listeners) {try {fn();} catch (_) {}}}
  async function json(url, timeout=14000) {
    const response = await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(timeout)});
    if (!response.ok) throw Error("HTTP " + response.status);
    return response.json();
  }
  async function refreshSnapshot() {
    let data;
    try {data = await json(REMOTE + "?v=" + Date.now());if (!accept(data)) throw Error("Invalid snapshot");}
    catch (_) {data=await json("./market-snapshot.json?v=" + Date.now());if (!accept(data)) throw Error("Invalid snapshot");}
    if (!snapshot.generatedAt || Date.parse(data.generatedAt) >= Date.parse(snapshot.generatedAt)) snapshot=data;
    if (!core.validFX(fx) && core.validFX(snapshot.fx)) fx=snapshot.fx;
  }
  async function refreshFX() {
    const day = core.bogotaDay(), query = new URLSearchParams({
      $where:"vigenciadesde <= '"+day+"T00:00:00.000' AND vigenciahasta >= '"+day+"T00:00:00.000'",
      $order:"vigenciadesde DESC",$limit:"1"
    });
    try {
      const rows=await json("https://www.datos.gov.co/resource/32sa-8pi3.json?"+query);
      const row=rows?.[0], next={cop:Number(row?.valor),source:"TRM",updatedAt:row?.vigenciadesde,
        validFrom:String(row?.vigenciadesde || "").slice(0,10),validTo:String(row?.vigenciahasta || "").slice(0,10)};
      if (row?.unidad !== "COP" || !core.validFX(next)) throw Error("Invalid TRM");
      fx=next;
    } catch (_) {
      if (core.validFX(fx) && fx.source === "TRM") return;
      const data=await json("https://open.er-api.com/v6/latest/USD");
      const next={cop:data.rates?.COP,source:"ExchangeRate-API",updatedAt:new Date(data.time_last_update_unix*1000).toISOString()};
      if (data.result !== "success" || data.base_code !== "USD" || !core.validFX(next)) throw Error("Invalid FX");
      fx=next;
    }
  }
  function init(force=false) {
    if (inFlight) return inFlight;
    if (!force && Date.now()-checkedAt < 60000) return Promise.resolve();
    loading=true;lastError="";emit();
    inFlight=Promise.allSettled([refreshSnapshot(),refreshFX()]).then(results => {
      lastError=results.some(r=>r.status==="rejected") ? "No se pudo completar la actualización; revisa las fechas." : "";
      if (!core.validFX(fx) && core.validFX(snapshot.fx)) fx=snapshot.fx;
      checkedAt=Date.now();save();
    }).finally(()=>{loading=false;inFlight=null;emit();});
    return inFlight;
  }
  const quote = card => core.quote(card,snapshot,fx);
  function amount(q) {
    if (q.status === "unavailable") return q.reason;
    if (q.copMin === null) return q.min > 0 ? formatUSD(q.min)+" · cambio COP pendiente" : "Cambio COP pendiente";
    return formatCOP(q.copMin);
  }
  function element(card) {
    const q=quote(card),box=document.createElement("div");box.className="card-market-price";
    const label=document.createElement("small"),value=document.createElement("strong");
    label.textContent=q.manual?"Precio fijado por propietario":q.source==="collectr"?"Collectr · Sin gradar":
      q.source==="tcgplayer"?"TCGplayer · Market Price":"Precio pendiente de verificar";
    value.textContent=amount(q);box.append(label,value);
    if (q.status === "unavailable") {
      return box;
    }
    const detail=document.createElement("small"),updated=document.createElement("small");
    detail.textContent=formatUSD(q.min)+" · "+q.variants[0].finish;
    updated.textContent=q.linked?"":q.manual?"Precio indicado por el propietario":
      (q.stale?"Dato vencido: ":"Dato de mercado: ")+date(q.updatedAt)+(q.reference?" · referencia en inglés":"");
    if (q.source === "collectr") updated.textContent+=" · Powered by Collectr";
    if (!q.usable) {const note=document.createElement("small");note.textContent="No incluido en el total hasta verificar la actualización.";box.append(note);}
    box.append(detail);
    if(updated.textContent)box.append(updated);
    box.title=q.manual?"Precio en USD fijado expresamente por el propietario.":
      q.variants.map(v=>v.finish+": "+formatUSD(v.usd)).join(" · ")+". Referencia de mercado sin envío; no certifica condición ni precio de venta.";
    return box;
  }
  function rateText() {
    if (!core.validFX(fx)) return "Cambio USD/COP no vigente; total COP pendiente";
    return "1 USD = "+new Intl.NumberFormat("es-CO",{minimumFractionDigits:2,maximumFractionDigits:6}).format(fx.cop)+" COP · "+(fx.source==="TRM"?"TRM vigente "+fx.validFrom+
      (fx.validTo!==fx.validFrom?" a "+fx.validTo:""):"Cambio de mercado del "+date(fx.updatedAt));
  }
  function statusText() {
    if (loading) return "Actualizando cotizaciones…";
    if (lastError) return lastError;
    return checkedAt?"Última consulta: "+date(checkedAt)+" · precios de publicación diaria":"Consultando cotizaciones…";
  }
  window.CardPrices={searchUrl:core.searchUrl,collectrSearchUrl:core.collectrSearchUrl,quote,element,amount,formatCOP,
    rateText,statusText,init,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void init();});
  window.addEventListener("pageshow",event=>{if(event.persisted)void init(true);});
  window.addEventListener("online",()=>void init(true));
  setInterval(()=>{if(document.visibilityState==="visible")void init();},300000);
})();
