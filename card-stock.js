(function() {
"use strict";
const BASE="https://cnivcnexsqobipvqxero.supabase.co";
const KEY="sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU";
let overrides=new Map(), loaded=0, message="";
const subscribers=new Set();
function emit(){for(const fn of subscribers){try{fn()}catch(_){}}}
async function refresh(force=false){
 if(!force&&Date.now()-loaded<25000)return overrides;
 const res=await fetch(BASE+"/rest/v1/pokemon_stock_overrides?select=card_id,quantity_available,is_listed",{headers:{apikey:KEY,Accept:"application/json"},cache:"no-store"});
 if(!res.ok){message="No fue posible consultar las existencias";emit();return overrides;}
 const data=await res.json();
 overrides=new Map(data.map(row=>[Number(row.card_id),row]));
 loaded=Date.now();message="";emit();return overrides;
}
function get(card){const saved=overrides.get(Number(card.id));const q=saved?Number(saved.quantity_available):Number(card.quantity)||0;return {quantity:q,available:q>0&&(saved?!!saved.is_listed:true),override:!!saved,listed:saved?saved.is_listed:true};}
async function save(card,amount,listed){
 if(String(amount).trim()==="")throw Error("Escribe la cantidad exacta de cartas disponibles.");
 const quantity=Number(amount);
 if(!Number.isInteger(quantity)||quantity<0||quantity>100000)throw Error("La cantidad debe ser un número entero entre 0 y 100000.");
 const payload={card_id:Number(card.id),quantity_available:quantity,is_listed:!!listed,updated_by:null,updated_at:new Date().toISOString()};
 const response=await fetch(BASE+"/rest/v1/pokemon_stock_overrides?on_conflict=card_id",{
 method:"POST",
 headers:{apikey:KEY,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=representation"},
 body:JSON.stringify(payload)});
 if(!response.ok){const detail=await response.json().catch(()=>({}));throw Error(detail.message||"Error al guardar existencias.");}
 overrides.set(Number(card.id),payload);emit();return payload;
}
function listen(fn){subscribers.add(fn);return()=>subscribers.delete(fn)}
window.CardStock={refresh,get,save,listen,getError:()=>message};
})();