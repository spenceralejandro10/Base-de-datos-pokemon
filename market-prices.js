/* Bóveda TCG: un enlace a TCGplayer. No se calculan ni publican precios en la vitrina. */
(function () {
  "use strict";
  function searchUrl(card) {
    const terms = [card.name, card.number, card.set].map(s => String(s || "").trim()).filter(Boolean);
    return "https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q="
      + encodeURIComponent(terms.join(" ")) + "&view=grid";
  }
  window.CardPrices = { searchUrl };
})();
