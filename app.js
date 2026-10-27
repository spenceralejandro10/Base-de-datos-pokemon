(function () {
  "use strict";
  const cards = window.CARDS || [];
  const shared = window.SharedImages;
  const byId = id => document.getElementById(id);
  const q = byId("q"), setFilter = byId("set"), langFilter = byId("lang"), view = byId("view"), results = byId("results");
  const stats = { total: byId("total"), copies: byId("copies"), shown: byId("shown") };
  const dialog = byId("editorDialog"), loginPanel = byId("loginPanel"), editPanel = byId("editPanel");
  const info = byId("editorMessage");
  const esc = val => String(val ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  let activeCard = null;
  let generation = 0;
  stats.total.textContent = cards.length;
  stats.copies.textContent = cards.reduce((n,c) => n + Number(c.quantity || 0), 0).toLocaleString("es-CO");

  for (const [select,field] of [[setFilter,"set"],[langFilter,"language"]]) {
    [...new Set(cards.map(c=>c[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")).forEach(value=>{
      const opt=document.createElement("option");
      opt.value=value;
      opt.textContent=value;
      select.append(opt);
    });
  }

  const searchUrl = c => "https://www.google.com/search?tbm=isch&q=" +
    encodeURIComponent(["pokemon tcg",c.name,c.number,c.set,c.language].filter(Boolean).join(" "));
  const setMessage = (message,error=false) => {
    info.textContent=message;
    info.className="editor-message"+(error?" error":"");
  };
  function updateLoginDisplay() {
    const logged=shared.isLoggedIn();
    loginPanel.hidden=logged;
    editPanel.hidden=!logged;
    byId("imageFields").hidden=!logged||!activeCard;
    byId("editingCard").textContent=activeCard?"Editando: "+activeCard.name+" · "+activeCard.number:"Selecciona una carta para cambiar su imagen.";
    byId("editorOwner").textContent=logged?"Sesión activa: "+(shared.getSession()?.user?.email||"propietario"):"";
    byId("ownerAccess").textContent=logged?"Administrar imágenes · conectado":"Administrar imágenes";
    byId("editorTitle").textContent=activeCard?"Imagen de "+activeCard.name:"Administrar imágenes";
    if(activeCard)byId("imageUrl").value=shared.getShared(activeCard)||"";
  }
  function showEditor(card=null) {
    activeCard=card;
    setMessage("");
    updateLoginDisplay();
    if(!dialog.open)dialog.showModal();
  }
  async function withFeedback(action,success) {
    setMessage("Guardando…");
    try{
      await action();
      setMessage(success);
      updateLoginDisplay();
      render();
    }catch(error){setMessage(error.message||"No se pudo guardar el cambio.",true)}
  }
  byId("ownerAccess").addEventListener("click",()=>showEditor());
  byId("closeEditor").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
  byId("sendOwnerLink").addEventListener("click",async()=>{
    setMessage("Solicitando acceso…");
    try{
      await shared.requestLogin(byId("ownerEmail").value);
      setMessage("Revisa tu correo. Abre el enlace de acceso o introduce el código si aparece en el mensaje.");
    }catch(e){setMessage(e.message,true)}
  });
  byId("verifyOwnerCode").addEventListener("click",async()=>{
    setMessage("Verificando código…");
    try {
      await shared.verifyCode(byId("ownerEmail").value,byId("ownerCode").value);
      setMessage("Sesión iniciada. Las modificaciones se guardarán en la base de datos compartida.");
      updateLoginDisplay();
      await migrateLegacy(true);
    }catch(e){setMessage(e.message,true)}
  });
  byId("logoutEditor").addEventListener("click",async()=>withFeedback(()=>shared.logout(),"Sesión cerrada."));
  byId("saveImageUrl").addEventListener("click",()=>{
    if(!activeCard)return;
    const c=activeCard;
    withFeedback(()=>shared.updateImage(c,byId("imageUrl").value),"Imagen guardada para todos los dispositivos.");
  });
  byId("saveImageFile").addEventListener("click",()=>{
    if(!activeCard)return;
    const c=activeCard;
    const f=byId("imageUpload").files[0];
    withFeedback(()=>shared.uploadImage(c,f),"Fotografía subida y guardada para todos los dispositivos.");
  });
  byId("removeImageShared").addEventListener("click",()=>{
    if(!activeCard)return;
    const c=activeCard;
    if(!confirm("¿Quitar la imagen personalizada compartida de "+c.name+"? El catálogo automático seguirá funcionando."))return;
    withFeedback(()=>shared.removeImage(c),"Imagen personalizada eliminada de la base de datos.");
  });
  async function migrateLegacy(silent=false) {
    const list=cards.filter(c=>/^https:\/\//i.test(localStorage.getItem("pokemon-image-"+c.id)||"")&&!shared.getShared(c));
    if(!list.length){if(!silent)setMessage("No hay imágenes antiguas pendientes de sincronizar.");return;}
    if(!silent && !confirm("¿Sincronizar "+list.length+" imágenes antiguas de este navegador con todos los dispositivos?"))return;
    let saved=0;
    const errors=[];
    for(const c of list){
      try{
        await shared.updateImage(c,localStorage.getItem("pokemon-image-"+c.id));
        localStorage.removeItem("pokemon-image-"+c.id);
        saved++;
      }catch(e){errors.push(c.name+": "+e.message)}
    }
    setMessage("Imágenes sincronizadas: "+saved+"/"+list.length+(errors.length?". Algunas fallaron: "+errors.slice(0,2).join("; "):""),!!errors.length);
    render();
  }
  byId("migrateOldImages").addEventListener("click",()=>migrateLegacy());
  byId("refreshMarket").addEventListener("click",()=>location.reload());

  async function loadImage(url){
    return new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>resolve(true);
      image.onerror=()=>resolve(false);
      image.src=url;
    });
  }
  async function placeImage(card,element,placeholder,status,token){
    try{
      const match=await window.CardImages.resolve(card);
      if(token!==generation||!element.isConnected)return;
      for(const url of match.images||[]){
        if(!url)continue;
        if(await loadImage(url)){
          if(token!==generation||!element.isConnected)return;
          element.src=url;
          element.alt="Imagen de "+card.name+", número "+card.number;
          element.hidden=false;
          if(placeholder)placeholder.hidden=true;
          if(status){
            if(match.status==="shared")status.textContent="Imagen guardada para todos";
            else if(match.status==="local")status.textContent="Pendiente: imagen solo en este equipo";
            else if(match.reason.includes("SVG:"))status.textContent="Arte SVG · La colección del Excel es distinta";
            else if(match.reason.includes("expansión estaba vacía"))status.textContent="Expansión identificada por número";
            else status.textContent=match.catalog?.editionIsReference?"Referencia de imagen en inglés":"Imagen de catálogo";
            status.classList.add(match.status==="shared"?"found":"attention");
            status.title=match.reason||"";
          }
          return;
        }
      }
      if(status){
        status.textContent=match.images?.length?"Imagen temporalmente inaccesible":match.reason;
        status.title=match.reason;
      }
      if(placeholder && placeholder.classList?.contains("placeholder"))placeholder.innerHTML='<span class="empty-symbol">◈</span><span>Imagen pendiente</span>';
    }catch(err){if(status)status.textContent="Error al consultar la imagen";}
  }

  function makeImageButton(card){
    const button=document.createElement("button");
    button.type="button";
    button.className="image-button";
    button.textContent="Asignar imagen";
    button.title="Guardar una imagen compartida. Solo el propietario puede editar.";
    button.addEventListener("click",()=>showEditor(card));
    return button;
  }
  function buildPriceLines(prices){
    if(!prices?.statuses?.length)return null;
    const wrap=document.createElement("div");
    wrap.className="price-lines";
    const groups=new Map();
    for(const price of prices.statuses){
      if(!groups.has(price.market))groups.set(price.market,[]);
      groups.get(price.market).push(price);
    }
    for(const [market,variants] of groups){
      const group=document.createElement("div");
      group.className="market-group";
      const name=document.createElement("strong");
      name.textContent=market;
      group.append(name);
      for(const p of variants){
        const line=document.createElement("div");
        line.className="price-line";
        const variant=document.createElement("span");
        variant.textContent=p.variant;
        const amount=document.createElement("b");
        amount.textContent=window.CardPrices.display(p);
        line.append(variant,amount);
        group.append(line);
      }
      const latest=variants.map(x=>x.updated).filter(Boolean)[0];
      if(latest){const foot=document.createElement("small");foot.textContent="Actualizado: "+latest;group.append(foot);}
      wrap.append(group);
    }
    if(prices.reference){
      const warn=document.createElement("small");
      warn.className="reference-warning";
      warn.textContent="Precio de referencia de edición inglesa; la española puede variar.";
      wrap.append(warn);
    }
    return wrap;
  }
  async function placePrices(card,container,token,tableMode=false){
    try{
      const prices=await window.CardPrices.resolve(card);
      if(token!==generation||!container.isConnected)return;
      container.textContent="";
      if(!prices.statuses?.length){
        container.textContent=prices.reason||"Sin precio de mercado disponible.";
        container.classList.add("no-price");
        return;
      }
      const lines=buildPriceLines(prices);
      if(!lines){container.textContent="Sin precios";return;}
      if(tableMode){
        const tcg=prices.statuses.filter(x=>x.market==="TCGplayer");
        const cardmarket=prices.statuses.filter(x=>x.market==="Cardmarket");
        const sourcePrices=container.dataset.market==="tcgplayer"?tcg:cardmarket;
        if(!sourcePrices.length){container.textContent="—";return;}
        sourcePrices.forEach(p=>{
          const line=document.createElement("div");
          line.className="table-price";
          line.textContent=p.variant+": "+window.CardPrices.display(p);
          container.append(line);
        });
        const last=sourcePrices.find(x=>x.updated);
        if(last){const t=document.createElement("small");t.textContent=last.updated;container.append(t)}
      }else container.append(lines);
    }catch(_){container.textContent="Precio no disponible";}
  }

  function galleryCard(card,token){
    const el=document.createElement("article");
    el.className="item";
    el.innerHTML='<div class="art"><div class="placeholder"><span class="loader"></span><span>Buscando imagen…</span></div><img hidden loading="lazy"><span class="pill">×'+esc(card.quantity)+'</span></div><div class="details"><h3>'+esc(card.name)+'</h3><div class="num">'+esc(card.number)+'</div><div class="meta">'+esc(card.set||"Colección no indicada")+' · '+esc(card.language||"Sin idioma")+'<br>'+esc(card.year||"Año no indicado")+'</div><div class="image-status">Consultando imagen…</div><div class="price-section"><div class="price-title">Precios de mercado</div><div class="pricing">Consultando TCGplayer y Cardmarket…</div></div><div class="links"><a target="_blank" rel="noopener noreferrer" href="'+searchUrl(card)+'">Buscar carta</a></div></div>';
    el.querySelector(".links").append(makeImageButton(card));
    const art=el.querySelector(".art");
    placeImage(card,art.querySelector("img"),art.querySelector(".placeholder"),el.querySelector(".image-status"),token);
    placePrices(card,el.querySelector(".pricing"),token,false);
    return el;
  }
  function tableView(filtered,token){
    const wrapper=document.createElement("div");
    wrapper.className="table-scroll";
    const table=document.createElement("table");
    table.className="data-table";
    table.innerHTML="<thead><tr>"+["Imagen","#","Nombre","Número","Colección","Año","Idioma","Cantidad","TCGplayer (USD)","Cardmarket (EUR)"].map(h=>"<th>"+h+"</th>").join("")+"</tr></thead>";
    const body=document.createElement("tbody");
    for(const card of filtered){
      const tr=document.createElement("tr");
      tr.innerHTML='<td class="thumbnail"><div class="mini-art"><img hidden loading="lazy"><span>—</span></div></td>'+[card.ordinal,card.name,card.number,card.set,card.year,card.language,card.quantity].map((x,i)=>'<td'+(i===2?' class="num-col"':"")+'>'+esc(x)+'</td>').join("")+'<td class="table-market" data-market="tcgplayer">Consultando…</td><td class="table-market" data-market="cardmarket">Consultando…</td>';
      const mini=tr.querySelector(".mini-art");
      placeImage(card,mini.querySelector("img"),mini.querySelector("span"),null,token);
      for(const place of tr.querySelectorAll(".table-market"))placePrices(card,place,token,true);
      body.append(tr);
    }
    table.append(body);
    wrapper.append(table);
    return wrapper;
  }
  function getFiltered(){
    const query=q.value.toLocaleLowerCase().trim();
    return cards.filter(c=>(!setFilter.value||c.set===setFilter.value)&&(!langFilter.value||c.language===langFilter.value)&&[c.name,c.number,c.set,c.language,c.year,c.ordinal].join(" ").toLocaleLowerCase().includes(query));
  }
  function render(){
    generation++;
    const token=generation;
    const filtered=getFiltered();
    stats.shown.textContent=filtered.length;
    results.replaceChildren();
    results.className=view.value==="table"?"table-container":"grid";
    if(!filtered.length){
      results.innerHTML='<div class="no-results">No hay cartas que coincidan con la búsqueda.</div>';
      return;
    }
    if(view.value==="table")results.append(tableView(filtered,token));
    else{
      const fragment=document.createDocumentFragment();
      filtered.forEach(card=>fragment.append(galleryCard(card,token)));
      results.append(fragment);
    }
  }
  [q,setFilter,langFilter,view].forEach(el=>el.addEventListener("input",render));
  let firstLoad=false;
  shared.subscribe(()=>{
    const status=byId("sharedConnection");
    status.textContent=shared.getError()?"No se pudo conectar la base de datos compartida":"Imágenes compartidas activadas";
    updateLoginDisplay();
    if(firstLoad)render();
  });
  render();
  shared.init().then(()=>{
    firstLoad=true;
    updateLoginDisplay();
    render();
    if(shared.isLoggedIn())migrateLegacy(true).catch(()=>{});
  }).catch(error=>{
    byId("sharedConnection").textContent="Sin conexión con imágenes compartidas";
    console.warn("Catálogo compartido:",error.message);
    firstLoad=true;
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible")shared.loadShared(true).catch(()=>{});
  });
  setInterval(()=>shared.loadShared(true).catch(()=>{}),90000);
})();