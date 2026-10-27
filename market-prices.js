/*
 * Precios de referencia consultados en cada carga a TCGdex y, cuando procede,
 * Pokémon TCG API. NO es un precio de venta garantizado.
 */
(function () {
 "use strict";
 const memo = new Map();
 const fmt = (amount, unit) => new Intl.NumberFormat("es-CO", {
   style: "currency", currency: unit, minimumFractionDigits: 2, maximumFractionDigits: 2
 }).format(amount);
 function valid(value) { return typeof value === "number" && Number.isFinite(value) && value > 0; }
 function tidyDate(value) {
   if (!value) return "";
   const date = typeof value === "number" ? new Date(value < 10000000000 ? value * 1000 : value) : new Date(value);
   return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
 }
 function normalize(data, site, reference) {
   const result = { statuses: [], source: site, reference: !!reference };
   const tcg = data?.pricing?.tcgplayer || data?.tcgplayer || null;
   const cm = data?.pricing?.cardmarket || data?.cardmarket || null;
   if (tcg) {
     const prices = tcg.prices || tcg;
     const labels = { normal: "Normal", holofoil: "Holo", "reverse-holofoil": "Reverso", reverse: "Reverso", "1st-edition": "1.ª edición", "1st-edition-holofoil": "1.ª edición holo", unlimited: "Ilimitada", "unlimited-holofoil": "Ilimitada holo" };
     const entries = Object.entries(prices).filter(([name, variant]) => variant && typeof variant === "object" && !Array.isArray(variant) && (valid(variant.marketPrice) || valid(variant.midPrice)));
     for (const [type, values] of entries) {
       result.statuses.push({
         market: "TCGplayer",
         variant: labels[type] || type,
         price: values.marketPrice ?? values.midPrice,
         unit: tcg.unit || "USD",
         updated: tidyDate(tcg.updated || tcg.updatedAt),
         url: tcg.url || ""
       });
     }
   }
   if (cm) {
     const normal = valid(cm.trend) ? cm.trend : cm.avg;
     const foil = valid(cm["trend-holo"]) ? cm["trend-holo"] : cm["avg-holo"];
     if (valid(normal)) result.statuses.push({ market: "Cardmarket", variant: "Normal / tendencia", price: normal, unit: cm.unit || "EUR", updated: tidyDate(cm.updated || cm.updatedAt), url: cm.url || "" });
     if (valid(foil)) result.statuses.push({ market: "Cardmarket", variant: "Holo / tendencia", price: foil, unit: cm.unit || "EUR", updated: tidyDate(cm.updated || cm.updatedAt), url: cm.url || "" });
   }
   result.statuses = result.statuses.filter(x => valid(x.price));
   return result;
 }
 const cardIdKey = card => [card.id, card.name, card.number, card.set, card.language].join("|");
 async function compute(card) {
   const match = await window.CardImages.resolveCatalog(card);
   if (!match?.catalog?.id) {
     return { statuses: [], reason: "No hay coincidencia verificable de colección y número; no se muestra un precio supuesto." };
   }
   const meta = match.catalog;
   if (meta.kind === "tcgdex") {
     const url = "https://api.tcgdex.net/v2/" + encodeURIComponent(meta.language) + "/cards/" + encodeURIComponent(meta.id);
     const response = await window.CardImages.loadCardJSON(url);
     if (!response) return { statuses: [], reason: "La fuente de precios no respondió." };
     const prices = normalize(response, "TCGdex", meta.editionIsReference);
     prices.cardId = meta.id;
     prices.reason = prices.statuses.length ? "" : "Las fuentes no publican un precio para esta edición.";
     return prices;
   }
   if (meta.kind === "legacy") {
     const response = await window.CardImages.loadCardJSON("https://api.pokemontcg.io/v2/cards/" + encodeURIComponent(meta.id));
     const prices = normalize(response?.data, "Pokémon TCG API", meta.editionIsReference);
     prices.reason = prices.statuses.length ? "" : "Sin precios disponibles para esta carta.";
     return prices;
   }
   return { statuses: [], reason: "No hay precios publicados para esta edición." };
 }
 async function resolve(card) {
   const k = cardIdKey(card);
   if (!memo.has(k)) memo.set(k, compute(card).catch(() => ({ statuses: [], reason: "La consulta de mercado falló temporalmente." })));
   return memo.get(k);
 }
 function reset() { memo.clear(); }
 function display(status) { return fmt(status.price, status.unit); }
 window.CardPrices = { resolve, display, reset };
})();