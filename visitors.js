/* Bóveda TCG: contador de visitantes únicos a partir de cero.
 * Se cuenta una sola vez por navegador (no en cada actualización de página).
 * No se guardan nombres, correos electrónicos, ubicaciones ni direcciones IP.
 */
(function () {
  "use strict";
  const label=document.getElementById("visitors");
  if(!label)return;
  const endpoint="https://cnivcnexsqobipvqxero.supabase.co/rest/v1/rpc/boveda_record_visitor";
  const key="sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU";
  const storageKey="boveda-visitante-unico-v1";
  function browserId(){
    try{
      const stored=localStorage.getItem(storageKey);
      if(stored&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored))
        return stored;
      const id=crypto.randomUUID();
      localStorage.setItem(storageKey,id);
      return id;
    }catch(_){
      return null; // Sin almacenamiento persistente, no duplicar conteos por error.
    }
  }
  async function record(){
    const id=browserId();
    if(!id){label.textContent="—";return;}
    try{
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{apikey:key,"Content-Type":"application/json",Accept:"application/json"},
        body:JSON.stringify({p_browser_id:id}),
        cache:"no-store",signal:AbortSignal.timeout(15000)
      });
      if(!response.ok)throw Error("Could not register visit");
      const count=Number(await response.json());
      if(!Number.isSafeInteger(count)||count<0)throw Error("Invalid visit count");
      label.textContent=count.toLocaleString("es-CO");
      label.title="Visitantes únicos registrados desde el 11 de noviembre de 2026. Un navegador cuenta una sola vez.";
    }catch(_){
      label.textContent="—";
      label.title="No se pudo consultar el contador de visitantes";
    }
  }
  void record();
})();
