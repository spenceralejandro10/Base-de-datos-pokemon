/* Estado de venta visual de Bóveda TCG.
 * Las cartas permanecen en el catálogo, fotos, Excel y base de datos.
 * No se escriben existencias ni se habilitan herramientas de administrador.
 */
(function(){
"use strict";
const normal=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const sold=Object.freeze([
 Object.freeze({"id":302,"name":"Garganacl","number":"202/182","set":"Paradox Rift","language":"Inglés"}),
 Object.freeze({"id":262,"name":"Tapu Koko ex","number":"068/182","set":"Paradox Rift","language":"Inglés"}),
 Object.freeze({"id":285,"name":"Skeledirge ex","number":"324/190","set":"Shiny Treasure ex","language":"Japonés"}),
 Object.freeze({"id":151,"name":"Gardevoir ex","number":"328/190","set":"Shiny Treasure ex","language":"Japonés"}),
 Object.freeze({"id":83,"name":"Charmander","number":"004/165","set":"151","language":"Inglés"}),
 Object.freeze({"id":223,"name":"Sprigatito ex","number":"087","set":"Scarlet & Violet Promo","language":"Español"}),
 Object.freeze({id:27, name:"Venusaur ex",number:"001/142",set:"Stellar Crown",language:"Inglés"}),
 Object.freeze({id:272,name:"Wugtrio",number:"224/091",set:"Paldean Fates",language:"Inglés"}),
 Object.freeze({id:80, name:"Pidgeot ex",number:"335/190",set:"Shiny Treasure ex",language:"Japonés"}),
 Object.freeze({id:273,name:"Wigglytuff ex",number:"336/190",set:"Shiny Treasure ex",language:"Japonés"}),
 Object.freeze({id:28, name:"Jynx ex",number:"191/165",set:"151",language:"Inglés"}),
 Object.freeze({id:81, name:"Caterpie",number:"172/165",set:"Pokémon Card 151",language:"Japonés"}),
 Object.freeze({id:241,name:"Omanyte",number:"180/165",set:"Pokémon Card 151",language:"Japonés"}),
 Object.freeze({id:79, name:"Blastoise",number:"2/102",set:"Celebrations (Classic Collection)",language:"Inglés"}),
 Object.freeze({"id":213,"name":"Palafin","number":"124/091","set":"Paldean Fates","language":"Español"}),
 Object.freeze({"id":91,"name":"Scream Tail ex","number":"094/167","set":"Twilight Masquerade","language":"Inglés"}),
 Object.freeze({"id":183,"name":"Pikachu ex","number":"149/128","set":"30th Celebration","language":"Inglés"}),
 Object.freeze({"id":186,"name":"Mew ex","number":"158/128","set":"30th Celebration","language":"Inglés"}),
 Object.freeze({"id":187,"name":"Jirachi ex","number":"155/128","set":"30th Celebration","language":"Inglés"}),
 Object.freeze({"id":188,"name":"Sylveon ex","number":"153/128","set":"30th Celebration","language":"Inglés"}),
 Object.freeze({"id":191,"name":"Mewtwo ex","number":"151/128","set":"30th Celebration","language":"Inglés"}),
 Object.freeze({"id":192,"name":"Gengar ex","number":"154/128","set":"30th Celebration","language":"Inglés"}),
 Object.freeze({"id":193,"name":"Mew ex","number":"152/128","set":"30th Celebration","language":"Inglés"}),
 Object.freeze({"id":182,"name":"Lugia","number":"149/147","set":"30th Celebration - Classic Collection","language":"Inglés"}),
 Object.freeze({"id":185,"name":"Magikarp","number":"203/193","set":"30th Celebration - Classic Collection","language":"Inglés"}),
 Object.freeze({"id":195,"name":"Darkrai & Cresselia LEGEND","number":"100/102","set":"30th Celebration - Classic Collection","language":"Inglés"}),
 Object.freeze({"id":196,"name":"Gengar","number":"94/102","set":"30th Celebration - Classic Collection","language":"Inglés"})
]);
const byId=new Map(sold.map(x=>[x.id,x]));
const isSold=card=>{
 if(!card)return false;
 const item=byId.get(Number(card.id));
 return Boolean(item&&["name","number","set","language"].every(field=>normal(item[field])===normal(card[field])));
};
window.BovedaSold=Object.freeze({isSold,count:sold.length});
})();
