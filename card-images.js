/*
 * Identificador de imágenes. Nunca edita el inventario fuente.
 * TCGdex ofrece catálogos separados en inglés, español y japonés.
 * Se valida expansión + número (y, cuando es posible, nombre).
 */
(function () {
  "use strict";
  const SETS = {
    "stellar crown": { tcg: "sv07", old: "sv7" },
    "paradox rift": { tcg: "sv04", old: "sv4" },
    "scarlet & violet": { tcg: "sv01", old: "sv1" },
    "prismatic evolutions": { tcg: "sv08.5", old: "sv8pt5" },
    "journey together": { tcg: "sv09", old: "sv9" },
    "darkness ablaze": { tcg: "swsh3", old: "swsh3" },
    "evolving skies": { tcg: "swsh7", old: "swsh7" },
    "lost origin": { tcg: "swsh11", old: "swsh11" },
    "twilight masquerade": { tcg: "sv06", old: "sv6" },
    "obsidian flames": { tcg: "sv03", old: "sv3" },
    "paldea evolved": { tcg: "sv02", old: "sv2" },
    "paldean fates": { tcg: "sv04.5", old: "sv4pt5" },
    "astral radiance": { tcg: "swsh10", old: "swsh10" },
    "151": { tcg: "sv03.5", old: "sv3pt5" },
    "pokemon card 151": { tcg: "sv03.5", old: "sv3pt5" },
    "crown zenith": { tcg: "swsh12.5", old: "swsh12" },
    "shiny treasure ex": { tcg: "sv4a", old: null, japanese: true },
    "scarlet & violet promo": { tcg: "svp", old: "svp" }
  };
  const key = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const setKey = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const cache = new Map();
  let ongoing = 0;
  const pending = [];
  function enqueue(job) {
    return new Promise((resolve, reject) => {
      pending.push({ job, resolve, reject });
      start();
    });
  }
  function start() {
    while (ongoing < 5 && pending.length) {
      const task = pending.shift();
      ongoing++;
      Promise.resolve().then(task.job).then(task.resolve, task.reject).finally(() => {
        ongoing--;
        start();
      });
    }
  }
  async function requestJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 11000);
    try {
      const response = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  function loadJSON(url) {
    if (!cache.has(url)) cache.set(url, enqueue(() => requestJSON(url)));
    return cache.get(url);
  }
  function imageLinks(base) {
    if (!base || !/^https:\/\/assets\.tcgdex\.net\//.test(base)) return [];
    return [base + "/low.webp", base + "/high.webp", base + "/low.png", base + "/high.png"];
  }
  function pack(status, reason, images, source, info) {
    return { status, reason, images: images || [], source: source || "", info: info || "" };
  }
  function numberDetails(card) {
    const raw = String(card.number || "").trim();
    const match = raw.match(/^(\d+)(?:\/(\d+))?$/);
    if (match) return { raw, local: String(Number(match[1])), suffix: match[2] ? Number(match[2]) : null, promo: false };
    const promo = raw.match(/^SWSH\s*0*(\d+)$/i);
    if (promo) return { raw, local: String(Number(promo[1])), suffix: null, promo: true };
    return null;
  }
  function languages(card, japaneseSet) {
    if (japaneseSet || card.language === "Japonés") return ["ja"];
    if (card.language === "Español") return ["es", "en"];
    return ["en"];
  }
  function nameFits(cardName, sourceName, lang) {
    const aliases = {
      "e nigma": ["iono"],
      "cael": ["clive"],
      "estudiante de paldea": ["paldean student"],
      "energia fuego basica": ["basic fire energy", "fire energy"],
      "bill s transfer": ["bill s transfer"]
    };
    const card = key(cardName), source = key(sourceName);
    if (!source) return true;
    if (card === source || (aliases[card] || []).includes(source)) return true;
    // Si son lenguas diferentes, el número y el set son el criterio.
    return lang !== "en" || /[áéíóúñ]/i.test(cardName);
  }
  function listByNumber(setData, details) {
    return (setData.cards || []).find(c => {
      const n = String(c.localId ?? c.id?.split("-").slice(-1)[0] ?? "");
      return /^\d+$/.test(n) && String(Number(n)) === details.local;
    });
  }
  function totalMatches(setData, details) {
    if (details.suffix == null) return true;
    const total = Number(setData.cardCount?.official);
    return !Number.isFinite(total) || !total || total === details.suffix;
  }
  async function viaTCGdex(card, config, details) {
    let mismatch = false;
    for (const lang of languages(card, config.japanese)) {
      const setId = (lang === "ja" && setKey(card.set) === "pokemon card 151") ? "sv2a" : config.tcg;
      const base = "https://api.tcgdex.net/v2/" + lang;
      const setData = await loadJSON(base + "/sets/" + encodeURIComponent(setId));
      if (!setData) continue;
      if (!totalMatches(setData, details)) {
        mismatch = true;
        continue;
      }
      const found = listByNumber(setData, details);
      if (!found) continue;
      if (!nameFits(card.name, found.name, lang)) {
        mismatch = true;
        continue;
      }
      let picture = found.image;
      if (!picture) {
        const detail = await loadJSON(base + "/cards/" + encodeURIComponent(found.id || (setId + "-" + found.localId)));
        picture = detail?.image;
      }
      const images = imageLinks(picture);
      if (images.length) {
        const foreign = (lang === "en" && card.language === "Español");
        return pack("verified", foreign ? "Referencia visual en inglés: mismo número y expansión" : "Imagen localizada por colección y número", images, "TCGdex", found.name);
      }
      return pack("no-art", "La carta existe en el catálogo, pero no tiene imagen digital disponible.", [], "TCGdex", found.name);
    }
    return mismatch ? pack("mismatch", "El nombre o el total de cartas no coincide con la expansión indicada.") : null;
  }
  async function viaLegacy(card, config, details) {
    if (!config.old || card.language === "Japonés") return null;
    const id = config.old + "-" + details.local;
    const data = await loadJSON("https://api.pokemontcg.io/v2/cards/" + encodeURIComponent(id));
    const found = data?.data;
    if (!found || !nameFits(card.name, found.name, "en")) return null;
    if (details.suffix != null && Number(found.set?.printedTotal) && Number(found.set.printedTotal) !== details.suffix) return null;
    const url = found.images?.small || found.images?.large;
    return url ? pack("verified", "Imagen por número y colección", [url, found.images?.large].filter(Boolean), "Pokémon TCG API", found.name) : null;
  }
  async function resolve(card) {
    const info = numberDetails(card);
    if (!info) return pack("incomplete", "Número de carta pendiente o no reconocido.");
    const override = localStorage.getItem("pokemon-image-" + card.id);
    if (override && /^https:\/\//.test(override)) return pack("manual", "Imagen elegida por ti en este navegador", [override], "Manual");
    const baseConfig = SETS[setKey(card.set)];
    if (!baseConfig && !info.promo) return pack("incomplete", "No se ha indicado una colección reconocible.");
    const config = info.promo ? { tcg: "swshp", old: "swshp" } : baseConfig;
    try {
      const first = await viaTCGdex(card, config, info);
      if (first?.images.length) return first;
      const second = await viaLegacy(card, config, info);
      return second || first || pack("not-found", "Sin imagen confirmada para este nombre, número y expansión.");
    } catch (_) {
      return pack("error", "No se pudo consultar la base de datos de imágenes.");
    }
  }
  function setManual(card, url) {
    const text = String(url || "").trim();
    if (text && !/^https:\/\//i.test(text)) throw new Error("La URL debe comenzar por https://");
    if (text) localStorage.setItem("pokemon-image-" + card.id, text);
    else localStorage.removeItem("pokemon-image-" + card.id);
  }
  window.CardImages = { resolve, setManual, setConfig: SETS };
})();
