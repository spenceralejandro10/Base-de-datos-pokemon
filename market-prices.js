/* Oferta destacada real de TCGplayer (Spotlight), con o sin Direct. */
(function () {
  "use strict";
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const number=s=>String(s||"").toUpperCase().replace(/\s/g,"").split("/").map(v=>v.replace(/(^|[A-Z])0+(?=\d)/g,"$1")).join("/");
  const groups={
    "30th celebration":[3,24722],"30th celebration classic collection":[3,24837],
    "journey together":[3,24073],"prismatic evolutions":[3,23821],
    "stellar crown":[3,23537],"twilight masquerade":[3,23473],
    "temporal forces":[3,23381],"paldean fates":[3,23353],
    "paradox rift":[3,23286],"151":[3,23237],
    "obsidian flames":[3,23228],"paldea evolved":[3,23120],
    "scarlet violet promo":[3,22872],"scarlet violet":[3,22873],
    "crown zenith":[3,17688],"lost origin":[3,3118],
    "astral radiance":[3,3040],"sword shield promo":[3,2545],
    "celebrations classic collection":[3,2931],"evolving skies":[3,2848],
    "pokemon card 151":[85,23599],"scarlet ex":[85,23605],
    "violet ex":[85,23606],"crimson haze":[85,23602],
    "shiny treasure ex":[85,23601],"future flash":[85,23611],
    "ruler of the black flame":[85,23609],"special deck set ex svg":[85,23812]
  };
  const names={"energia fuego basica":"basic fire energy","arbol colosal":"grand tree",
    "ondulagua ex":"walking wake ex","estudiante de paldea":"paldean student",
    "cloe":"lacey","e nigma":"iono","ferrocuello":"iron jugulis","furioseta":"brute bonnet",
    "calyrex jinete glacial vmax":"ice rider calyrex vmax"};
  const seed=window.MARKET_SNAPSHOT||{groups:{}};
  const listeners=new Set(),DAY=86400000,HOUR=3600000;
  const offers=new Map(),pending=new Set(),attempts=new Map(),queue=[],watched=new Map();
  let active=0,emitTimer=null;
  const formatCOP=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n)+" COP";
  const formatUSD=n=>"US$"+Number(n).toFixed(2);
  const date=s=>new Date(s).toLocaleDateString("es-CO",{timeZone:"America/Bogota"});
  let fx=seed.fx||null;
  function read(key){try{return JSON.parse(localStorage.getItem("boveda-spotlight-v3-"+key))}catch(_){return null}}
  function save(key,value){try{localStorage.setItem("boveda-spotlight-v3-"+key,JSON.stringify(value))}catch(_){}}
  function emit(){for(const cb of listeners){try{cb()}catch(_){}}}
  function emitSoon(){if(!emitTimer)emitTimer=setTimeout(()=>{emitTimer=null;emit()},200)}
  async function json(url){
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error("Precio no disponible");
    return response.json();
  }
  function groupFor(card){
    const key=norm(card.set);let group=groups[key];
    if(norm(card.language)==="japones"){
      if(key==="151")group=groups["pokemon card 151"];
      if(group?.[0]!==85)return null;
    }else if(group?.[0]===85)return null;
    if(key==="astral radiance"&&/^TG/i.test(card.number))group=[3,3068];
    return group;
  }
  function getGroup(group){
    // TCGCSV blocks browser CORS; consume the shared, server-generated snapshot.
    return seed.source==="spotlight"?seed.groups[group.join("-")]:null;
  }
  const baseName=s=>norm(String(s).replace(/\s*[-–]\s*[A-Z]*\d+(?:\s*\/\s*[A-Z]*\d+)?/i,""));
  function match(card,data){
    const wanted=number(card.number),name=names[norm(card.name)]||norm(card.name);
    const candidates=(data?.products||[]).filter(p=>{
      const candidate=number(p.number),n=baseName(p.name);
      const equal=candidate===wanted||(!wanted.includes("/")&&candidate.split("/")[0]===wanted);
      return equal&&(n===name||n.startsWith(name+" "))&&!/\b(metal|jumbo|oversized|stamped|world championship)\b/.test(n);
    });
    const exact=candidates.filter(p=>baseName(p.name)===name);
    return exact.length?exact:candidates;
  }
  function productFor(card){
    const group=groupFor(card);
    if(!group)return null;
    const data=getGroup(group),matches=match(card,data);
    if(matches.length!==1)return null;
    return {id:matches[0].id,language:norm(card.language)==="japones"?"Japanese":"English"};
  }
  const offerKey=product=>product.id+"|"+product.language;
  function validOffer(value,product){
    return value?.source==="tcgplayer-spotlight"&&Number(value.productId)===product.id&&value.language===product.language&&
      Number.isFinite(value.price)&&value.price>0&&Number.isFinite(Date.parse(value.updatedAt));
  }
  function getOffer(product){
    const key=offerKey(product);
    if(!offers.has(key)){
      const cached=read(key),fallback=seed.offers?.[key];
      const chosen=validOffer(cached,product)&&(!validOffer(fallback,product)||cached.updatedAt>fallback.updatedAt)?cached:fallback;
      offers.set(key,validOffer(chosen,product)?chosen:null);
    }
    return offers.get(key);
  }
  function refreshOffer(product){
    const key=offerKey(product),current=getOffer(product);
    if(pending.has(key)||(current&&Date.now()-Date.parse(current.updatedAt)<HOUR)||Date.now()-(attempts.get(key)||0)<15*60000)return;
    attempts.set(key,Date.now());pending.add(key);queue.push(product);pump();
  }
  function pump(){
    while(active<2&&queue.length){
      const product=queue.shift();active++;
      fetch("https://data.tcgplayer.com/spotlight/search/"+product.id,{
        method:"POST",headers:{"Content-Type":"application/json","x-version":"1.0"},
        body:JSON.stringify(product.language==="Japanese"?{filters:{term:{language:["Japanese"]}}}:{}),
        signal:AbortSignal.timeout(12000)
      }).then(response=>{if(!response.ok)throw Error("Consulta fallida");return response.json()}).then(data=>{
        const item=data.spotlight;
        if(!item||Number(item.productId)!==product.id||item.language!==product.language||!(item.price>0))return;
        const offer={source:"tcgplayer-spotlight",productId:product.id,price:item.price,condition:item.condition,
          printing:item.printing,language:item.language,sellerName:item.sellerName,directSeller:!!item.directSeller,
          shippingPrice:item.shippingPrice,listingId:item.listingId,updatedAt:new Date().toISOString()};
        if(!validOffer(offer,product))return;
        offers.set(offerKey(product),offer);save(offerKey(product),offer);emitSoon();
      }).catch(()=>{}).finally(()=>{pending.delete(offerKey(product));active--;pump()});
    }
  }
  const observer=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      const product=watched.get(entry.target);observer.unobserve(entry.target);watched.delete(entry.target);
      if(product)refreshOffer(product);
    }
  },{rootMargin:"300px"}):null;
  function clearView(){observer?.disconnect();watched.clear()}
  function quote(card){
    const product=productFor(card);
    if(!product)return{status:"missing",reason:"Precio por confirmar"};
    const url="https://www.tcgplayer.com/product/"+product.id,offer=getOffer(product);
    if(!offer)return{status:"missing",reason:"Oferta por confirmar",url};
    const rate=Number(fx?.cop),validRate=rate>0&&Date.now()-Date.parse(fx?.updatedAt)<7*DAY;
    return{status:"ready",min:offer.price,max:offer.price,copMin:validRate?offer.price*rate:null,copMax:validRate?offer.price*rate:null,
      url,updatedAt:offer.updatedAt,stale:Date.now()-Date.parse(offer.updatedAt)>DAY,
      reference:norm(card.language)==="espanol",offer,fx};
  }
  function searchUrl(card) {
    const terms = [card.name, card.number, card.set].map(s => String(s || "").trim()).filter(Boolean);
    return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q="
      + encodeURIComponent(terms.join(" ")) + "&view=grid";
  }
  function amount(q){
    if(q.status!=="ready")return q.reason;
    if(q.copMin===null)return"Conversión COP no disponible";
    return formatCOP(q.copMin)+(q.min!==q.max?" – "+formatCOP(q.copMax):"");
  }
  function element(card){
    const q=quote(card),box=document.createElement("div");box.className="card-market-price";
    const label=document.createElement("small");label.textContent="Oferta TCGplayer · por carta";
    const value=document.createElement("strong");value.textContent=amount(q);box.append(label,value);
    if(q.status==="ready"){
      const detail=document.createElement("small");
      const conditions={"Near Mint":"Casi nueva","Lightly Played":"Poco usada","Moderately Played":"Uso moderado","Heavily Played":"Muy usada","Damaged":"Dañada"};
      detail.textContent=formatUSD(q.min)+" · "+(conditions[q.offer.condition]||q.offer.condition||"");
      const updated=document.createElement("small");updated.textContent=(q.stale?"Último dato: ":"Consulta: ")+date(q.updatedAt)+(q.reference?" · Referencia en inglés":"");
      box.append(detail,updated);
      box.title="Oferta destacada de "+q.offer.sellerName+" · "+q.offer.printing+(q.offer.directSeller?" · TCGplayer Direct":"")+". Sin envío. El estado corresponde a la oferta de referencia; el precio final de tu carta se confirma antes de comprar.";
    }
    const product=productFor(card);
    if(product&&(!q.offer||Date.now()-Date.parse(q.updatedAt)>HOUR)){
      if(observer){watched.set(box,product);observer.observe(box)}else refreshOffer(product);
    }
    return box;
  }
  async function init(){
    const stored=read("fx");if(stored?.cop>0&&(!fx||stored.updatedAt>fx.updatedAt))fx=stored;
    if(fx&&Date.now()-Date.parse(fx.updatedAt)<DAY)return;
    try{
      const d=await json("https://open.er-api.com/v6/latest/USD");
      if(d.result!=="success"||d.base_code!=="USD"||!(d.rates?.COP>0))return;
      fx={cop:d.rates.COP,updatedAt:new Date(d.time_last_update_unix*1000).toISOString()};save("fx",fx);emit();
    }catch(_){}
  }
  function rateText(){return fx?.cop>0?"1 USD = "+formatCOP(fx.cop)+" · cambio del "+date(fx.updatedAt):"Consultando cambio USD/COP…"}
  window.CardPrices={searchUrl,productFor,quote,element,clearView,amount,formatCOP,rateText,init,subscribe:fn=>listeners.add(fn)};
})();
