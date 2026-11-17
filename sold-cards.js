/* Estado de venta visual de Bóveda TCG.
 * Las cartas permanecen en el catálogo, fotos, Excel y base de datos.
 * No se escriben existencias ni se habilitan herramientas de administrador.
 */
(function(){
"use strict";
const normal=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const sold=Object.freeze([{id:383,name:"Dragonair",number:"182/165",set:"Pokémon Card 151",language:"Japonés",status:"Vendida · pendiente de entrega"}]);
const byId=new Map(sold.map(x=>[x.id,x]));
const isSold=card=>{
 if(!card)return false;
 const item=byId.get(Number(card.id));
 return Boolean(item&&["name","number","set","language"].every(field=>normal(item[field])===normal(card[field])));
};
window.BovedaSold=Object.freeze({isSold,status:card=>isSold(card)?byId.get(Number(card.id)).status:null,count:sold.length});
})();
