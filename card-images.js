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
    "temporal forces": { tcg: "sv05", old: "sv5" },
    "violet ex": { tcg: "sv1V", old: null, japanese: true },
    "scarlet ex": { tcg: "sv1S", old: null, japanese: true },
    "special deck set ex (svg)": { tcg: "SVG", old: null, japanese: true },
    "obsidian flames": { tcg: "sv03", old: "sv3" },
    "paldea evolved": { tcg: "sv02", old: "sv2" },
    "paldean fates": { tcg: "sv04.5", old: "sv4pt5" },
    "astral radiance": { tcg: "swsh10", old: "swsh10" },
    "151": { tcg: "sv03.5", old: "sv3pt5" },
    "pokemon card 151": { tcg: "sv03.5", old: "sv3pt5" },
    "crown zenith": { tcg: "swsh12.5", old: "swsh12" },
    "shiny treasure ex": { tcg: "sv4a", old: null, japanese: true },
    "scarlet & violet promo": { tcg: "svp", old: "svp" },
    "future flash": { tcg: "SV4M", old: null, japanese: true },
    "ruler of the black flame": { tcg: "SV3", old: null, japanese: true },
    "crimson haze": { tcg: "SV5a", old: null, japanese: true },
    "brilliant stars": { tcg: "swsh9", old: "swsh9" },
    "brilliant stars trainer gallery": { tcg: "swsh9tg", old: null },
    "astral radiance trainer gallery": { tcg: "swsh10tg", old: null },
    "fusion strike": { tcg: "swsh8", old: "swsh8" },
    "30th celebration": { tcg: "30th", old: null },
    "30th celebration - classic collection": { tcg: "30th-c", old: null, matchByUniqueName: true },
    "celebrations (classic collection)": { tcg: "cel25c", old: "cel25c" },
    "celebrations": { tcg: "cel25", old: "cel25" }
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
    const trainer = raw.match(/^TG(\d+)\/TG(\d+)$/i);
    if (trainer) return { raw, local: "TG" + String(Number(trainer[1])).padStart(2,"0"), suffix: Number(trainer[2]), promo: false, trainer: true };
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
      "bill s transfer": ["bill s transfer"],
      "recinto del festival": ["festival grounds"],
      "doble energia turbo": ["double turbo energy"],
      "ferrocuello": ["iron neck"],
      "furioseta": ["brute bonnet"],
      "palkia lv x": ["palkia"]
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
      if (details.promo) return n.toUpperCase().replace(/\s/g, "") === "SWSH" + details.local;
      if (details.trainer) return n.toUpperCase() === details.local.toUpperCase();
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
    let missingArtwork = false;
    for (const lang of languages(card, config.japanese)) {
      const setId = (lang === "ja" && ["pokemon card 151", "151"].includes(setKey(card.set))) ? "SV2a" : config.tcg;
      const base = "https://api.tcgdex.net/v2/" + lang;
      const setData = await loadJSON(base + "/sets/" + encodeURIComponent(setId));
      if (!setData) continue;
      if (!config.matchByUniqueName && !totalMatches(setData, details)) {
        mismatch = true;
        continue;
      }
      // En la colección clásica las cartas conservan su numeración histórica
      // (19/109, 149/147, etc.), mientras el catálogo tiene 001..030.
      // Evitamos confundirlas por número: exigimos un nombre único en este set.
      let found;
      if (config.matchByUniqueName) {
        const names = (setData.cards || []).filter(c => nameFits(card.name, c.name, lang));
        // La carta LEGEND ocupa dos mitades con el mismo nombre: la parte
        // superior es 99/102 (019) y la inferior 100/102 (020).
        if (names.length === 2 && key(card.name) === "darkrai cresselia legend") {
          const first = Number(String(card.number||"").split("/")[0]);
          const local = first === 99 ? 19 : first === 100 ? 20 : null;
          if (local != null) {
            found = names.find(c => Number(c.localId) === local);
          }
        } else if (names.length === 1) {
          found = names[0];
        }
        if (!found) {
          if (names.length > 1) mismatch = true;
          continue;
        }
      } else {
        found = listByNumber(setData, details);
      }
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
        const selected = pack("verified", foreign ? "Referencia visual en inglés: mismo número y expansión" : "Imagen localizada por colección y número", images, "TCGdex", found.name);
        selected.catalog = { kind: "tcgdex", id: found.id || (setId + "-" + found.localId), language: lang, editionIsReference: foreign };
        return selected;
      }
      missingArtwork = true;
      continue;
    }
    return mismatch ? pack("mismatch", "El nombre o el total de cartas no coincide con la expansión indicada.") : (missingArtwork ? pack("no-art", "La carta existe en el catálogo, pero no tiene imagen digital disponible.") : null);
  }
  async function viaLegacy(card, config, details) {
    if (!config.old || card.language === "Japonés") return null;
    const id = config.old + "-" + (details.promo ? "SWSH" + details.local : details.local);
    const data = await loadJSON("https://api.pokemontcg.io/v2/cards/" + encodeURIComponent(id));
    const found = data?.data;
    if (!found || !nameFits(card.name, found.name, "en")) return null;
    if (details.suffix != null && Number(found.set?.printedTotal) && Number(found.set.printedTotal) !== details.suffix) return null;
    const url = found.images?.small || found.images?.large;
    if (!url) return null;
    const selected = pack("verified", "Imagen por número y colección", [url, found.images?.large].filter(Boolean), "Pokémon TCG API", found.name);
    selected.catalog = { kind: "legacy", id, language: "en", editionIsReference: card.language === "Español" };
    return selected;
  }
  async function resolveCatalog(card) {
    const info = numberDetails(card);
    if (!info) return pack("incomplete", "Número de carta pendiente o no reconocido.");
    // Inferencias únicamente para la imagen, respaldadas por la numeración publicada:
    // Venusaur ex 003/165 = expansión 151; Lapras ex 164 = promo SVP.
    const inferred = !card.set && key(card.name) === "venusaur ex" && info.raw === "003/165"
      ? SETS["151"]
      : (!card.set && key(card.name) === "lapras ex" && info.raw === "164" ? SETS["scarlet & violet promo"] : null);
    const baseConfig = SETS[setKey(card.set)] || inferred;
    if (!baseConfig && !info.promo) return pack("incomplete", "No se ha indicado una colección reconocible.");
    const config = info.promo && !baseConfig?.matchByUniqueName ? { tcg: "swshp", old: "swshp" } : baseConfig;
    // El set con 49 cartas es SVG (Special Deck Set ex), no Shiny Treasure ex (190).
    // Este ajuste afecta SOLO a la imagen: el Excel original no se toca.
    const jp49 = card.language === "Japonés" && info.suffix === 49 &&
      ["venusaur ex", "charizard ex", "blastoise ex"].includes(key(card.name)) &&
      setKey(card.set) === "shiny treasure ex";
    try {
      if (jp49) {
        for (const specialId of ["SVG", "svG", "svg"]) {
          const match = await viaTCGdex(card, { tcg: specialId, old: null, japanese: true }, info);
          if (match?.images?.length) {
            match.reason = "Arte de SVG: Venusaur, Charizard & Blastoise Special Deck Set ex (el Excel dice Shiny Treasure ex)";
            match.source = "TCGdex (SVG)";
            return match;
          }
        }
      }
      const first = await viaTCGdex(card, config, info);
      if (first?.images.length) {
        if (inferred) first.reason = "La expansión estaba vacía en el Excel; se identificó por nombre y número sin editar tus datos.";
        return first;
      }
      const second = await viaLegacy(card, config, info);
      if (second && inferred) second.reason = "La expansión estaba vacía en el Excel; se identificó por nombre y número sin editar tus datos.";
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
  async function resolve(card) {
    const shared = window.SharedImages?.getShared(card);
    if (shared) return pack("shared", "Imagen guardada en la base de datos: visible desde cualquier equipo", [shared], "Supabase");
    const override = localStorage.getItem("pokemon-image-" + card.id);
    if (override && /^https:\/\//.test(override)) return pack("local", "Imagen anterior guardada solo en este equipo; sincronízala como propietario", [override], "Local");
    return resolveCatalog(card);
  }
  window.CardImages = { resolve, resolveCatalog, loadCardJSON: loadJSON, setManual, setConfig: SETS };
})();
