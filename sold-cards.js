/* Estado de venta visual de Bóveda TCG.
 * Las cartas permanecen en el catálogo, fotos, Excel y base de datos.
 * No se escriben existencias ni se habilitan herramientas de administrador.
 */
(function(){
"use strict";
const normal=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const sold=Object.freeze([
 Object.freeze({id:27, name:"Venusaur ex",number:"001/142",set:"Stellar Crown",language:"Inglés"}),
 Object.freeze({id:272,name:"Wugtrio",number:"224/091",set:"Paldean Fates",language:"Inglés"}),
 Object.freeze({id:80, name:"Pidgeot ex",number:"335/190",set:"Shiny Treasure ex",language:"Japonés"}),
 Object.freeze({id:273,name:"Wigglytuff ex",number:"336/190",set:"Shiny Treasure ex",language:"Japonés"}),
 Object.freeze({id:28, name:"Jynx ex",number:"191/165",set:"151",language:"Inglés"}),
 Object.freeze({id:81, name:"Caterpie",number:"172/165",set:"Pokémon Card 151",language:"Japonés"}),
 Object.freeze({id:241,name:"Omanyte",number:"180/165",set:"Pokémon Card 151",language:"Japonés"}),
 Object.freeze({id:79, name:"Blastoise",number:"2/102",set:"Celebrations (Classic Collection)",language:"Inglés"})
]);
const byId=new Map(sold.map(x=>[x.id,x]));
const isSold=card=>{
 if(!card)return false;
 const item=byId.get(Number(card.id));
 return Boolean(item&&["name","number","set","language"].every(field=>normal(item[field])===normal(card[field])));
};
window.BovedaSold=Object.freeze({isSold,count:sold.length});
})();
