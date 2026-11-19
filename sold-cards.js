/* Todas las cartas del catálogo japonés al 19/11/2026 están vendidas.
 * Se mantienen intactos los IDs, el orden, las imágenes y el stock original.
 */
(function(){
"use strict";
const soldIds=new Set([261,158,268,47,142,143,217,218,224,225,275,276,277,278,279,282,284,219,299,322,323,324,325,326,327,328,329,330,344,345,346,347,348,349,350,351,352,353,354,355,356,358,359,360,361,362,363,364,366,367,368,369,370,371,372,374,375,376,377,378,379,380,381,399,402,405,406,467,468,469,472,473,474]);
const normal=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const previous={id:383,name:"Dragonair",number:"182/165",set:"Pokémon Card 151",language:"Japonés",status:"Vendida · pendiente de entrega"};
const isPrevious=card=>Boolean(card&&Number(card.id)===previous.id&&
 ["name","number","set","language"].every(field=>normal(previous[field])===normal(card[field])));
const isSold=card=>Boolean(card&&(soldIds.has(Number(card.id))||isPrevious(card)));
const status=card=>isPrevious(card)?previous.status:isSold(card)?"Vendida":null;
window.BovedaSold=Object.freeze({isSold,status,count:soldIds.size+1});
})();
